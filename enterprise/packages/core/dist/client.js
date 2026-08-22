import { createPublicClient, decodeEventLog, getAddress, http, } from "viem";
import { noShowRegistryAbi } from "./abi.js";
import { challengeAtBlock, deriveEventId } from "./challenge.js";
import { CHALLENGE_BLOCKS, MONAD_FACILITATOR_URL, MONAD_TESTNET_RPC, MONAD_TESTNET_X402, WMON_ASSET, monadTestnetChain, } from "./config.js";
import { GAS, batchGas } from "./gas.js";
import { createX402Server, toBaseUnits } from "./x402/server.js";
/**
 * The one object an integrator needs.
 *
 * Everything Monad-, x402- or Permit2-specific lives behind this. A platform calls
 * `createEvent` once, `createHoldIntent` per registration, and `verifyCheckIn`
 * when someone scans. It never has to know what Permit2 is.
 */
export class NoShowClient {
    registry;
    store;
    publicClient;
    baseUrl;
    asset;
    holdAmount;
    chain;
    organiser;
    x402;
    constructor(config) {
        this.registry = config.registry;
        this.store = config.store;
        this.baseUrl = config.baseUrl.replace(/\/$/, "");
        this.chain = config.chain ?? monadTestnetChain;
        this.organiser = config.organiser;
        this.asset = config.asset ?? WMON_ASSET;
        this.holdAmount = config.holdAmount ?? 0.5;
        this.publicClient = createPublicClient({
            chain: this.chain,
            transport: http(config.rpcUrl ?? MONAD_TESTNET_RPC),
            batch: { multicall: true },
        });
        this.x402 = createX402Server({
            network: config.x402Network ?? MONAD_TESTNET_X402,
            facilitatorUrl: config.facilitatorUrl ?? MONAD_FACILITATOR_URL,
            asset: this.asset,
            payTo: config.organiser?.address ?? config.registry,
            price: this.holdAmount,
            timeoutSeconds: config.holdTimeoutSeconds ?? 60 * 60 * 24,
        });
    }
    /** Namespaced event id. Two tenants using the same external id do not collide. */
    eventIdFor(tenantId, externalEventId) {
        return deriveEventId(tenantId, externalEventId);
    }
    /**
     * The hold amount as the contract records it.
     *
     * The registry stores a uint40, which tops out around 1.1e12 — so an 18-decimal
     * amount cannot fit and never could. The on-chain figure is a human-readable
     * record at 6dp; the authoritative amount lives in the x402 authorisation.
     */
    holdAmount6dp() {
        return Math.round(this.holdAmount * 1_000_000);
    }
    requireOrganiser() {
        if (!this.organiser) {
            throw new Error("This call signs a transaction and needs an `organiser` account. " +
                "Attendee-side calls (register, checkIn) are signed by the attendee's wallet.");
        }
        return this.organiser;
    }
    async write(functionName, args, gas) {
        const account = this.requireOrganiser();
        // Gas is always explicit. Monad charges the limit, and estimating on a
        // user-facing path does not fit inside the check-in window.
        const { request } = await this.publicClient.simulateContract({
            account,
            address: this.registry,
            abi: noShowRegistryAbi,
            functionName: functionName,
            args: args,
            gas,
        });
        // @ts-expect-error viem's writeContract lives on a wallet client; the account
        // is a local signer so the public client's transport can carry it.
        return this.publicClient.writeContract(request);
    }
    // --- organiser side -----------------------------------------------------
    /** Open an event on chain. Idempotent: an existing event is left alone. */
    async createEvent(eventId) {
        const existing = await this.publicClient.readContract({
            address: this.registry,
            abi: noShowRegistryAbi,
            functionName: "events",
            args: [eventId],
        });
        // events() returns [organiser, holdAmount, closed].
        const organiser = existing[0];
        if (organiser && organiser !== "0x0000000000000000000000000000000000000000") {
            return { eventId, alreadyExisted: true };
        }
        const txHash = await this.write("createEvent", [eventId, this.holdAmount6dp()], GAS.CREATE_EVENT);
        await this.publicClient.waitForTransactionReceipt({ hash: txHash });
        return { eventId, txHash, alreadyExisted: false };
    }
    // --- registration -------------------------------------------------------
    /**
     * Create a pending hold and return a URL to send the attendee to.
     *
     * This never touches the chain or the facilitator, because the two places it is
     * called from cannot afford to wait: a Luma webhook must answer within five
     * seconds, and the attendee is not present to sign anyway. The signature happens
     * later, when they open `holdUrl`.
     */
    async createHoldIntent(input) {
        const intentId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + (input.ttlSeconds ?? 60 * 60 * 24 * 14) * 1000).toISOString();
        const hold = {
            intentId,
            tenantId: input.tenantId,
            eventId: input.eventId,
            externalId: input.externalId,
            state: "PENDING",
            createdAt: new Date().toISOString(),
            expiresAt,
            metadata: input.metadata,
        };
        await this.store.putHold(hold);
        return { intentId, eventId: input.eventId, holdUrl: `${this.baseUrl}/hold/${intentId}`, expiresAt };
    }
    /** The 402 body for an intent — hand this straight back with status 402. */
    async paymentRequirementsFor(intentId, resourceUrl, error) {
        const hold = await this.store.getHold(intentId);
        if (!hold)
            throw new Error("Unknown hold intent.");
        return this.x402.paymentRequired(resourceUrl, `Authorize a ${this.holdAmount} ${this.asset.symbol} hold for this event`, error);
    }
    /**
     * Verify a signed authorisation and attach it to the intent.
     *
     * Nothing settles here. The point of `upto` is that the money stays put until
     * either check-in resolves it at zero or finalize charges it.
     */
    async acceptAuthorization(intentId, paymentPayload) {
        const hold = await this.store.getHold(intentId);
        if (!hold)
            throw new Error("Unknown hold intent.");
        const { payer, requirements } = await this.x402.verify(paymentPayload);
        const updated = {
            ...hold,
            payer: getAddress(payer),
            authRef: intentIdToAuthRef(intentId),
            paymentPayload,
            paymentRequirements: requirements,
            state: "AUTHORIZED",
        };
        await this.store.putHold(updated);
        return updated;
    }
    // --- check-in -----------------------------------------------------------
    /**
     * Confirm a mined check-in and release the hold for zero.
     *
     * The attendee's own wallet sent the transaction, so `msg.sender` is genuinely
     * them and no server ever holds an attendee key. Note the client sends it and
     * posts the hash: MetaMask does not implement `eth_signTransaction`, so a
     * browser cannot hand over a detached signed transaction to be broadcast.
     */
    async verifyCheckIn(input) {
        const receipt = await this.publicClient.waitForTransactionReceipt({
            hash: input.txHash,
            confirmations: 1,
            timeout: 30_000,
        });
        if (receipt.status !== "success")
            throw new Error("The check-in transaction reverted on chain.");
        if (!receipt.to || getAddress(receipt.to) !== getAddress(this.registry)) {
            throw new Error("That transaction did not call the NoShow registry.");
        }
        // Re-derive the challenge from the block that actually executed the call. The
        // contract already made this comparison; repeating it stops a receipt from
        // somebody else's valid check-in being replayed to release this hold.
        const expected = challengeAtBlock(input.eventId, receipt.blockNumber);
        if (expected.toLowerCase() !== input.challenge.toLowerCase()) {
            throw new Error("The submitted challenge was stale when the transaction mined.");
        }
        const payer = getAddress(receipt.from);
        const emitted = receipt.logs.some((log) => {
            if (getAddress(log.address) !== getAddress(this.registry))
                return false;
            try {
                const decoded = decodeEventLog({ abi: noShowRegistryAbi, data: log.data, topics: log.topics });
                return (decoded.eventName === "CheckedIn" &&
                    String(decoded.args.eventId).toLowerCase() === input.eventId.toLowerCase() &&
                    getAddress(String(decoded.args.who)) === payer);
            }
            catch {
                return false;
            }
        });
        if (!emitted)
            throw new Error("That transaction did not emit a CheckedIn event.");
        const hold = await this.store.findHoldByPayer(input.eventId, payer);
        if (!hold?.paymentPayload || !hold.paymentRequirements) {
            // The check-in is real and on chain; only the settlement cannot happen.
            // Say that precisely rather than implying the check-in failed.
            return {
                payer,
                blockNumber: receipt.blockNumber,
                settled: false,
                warning: "Checked in on chain, but no stored authorization was found for this wallet.",
            };
        }
        if (hold.state === "RELEASED") {
            return { payer, blockNumber: receipt.blockNumber, settled: true, settlement: hold.settlement };
        }
        if (hold.state === "UNKNOWN") {
            throw new Error("A previous settlement timed out; its outcome is unknown.");
        }
        await this.store.putHold({ ...hold, state: "RELEASING" });
        try {
            // Zero. This is the line the whole product rests on: settling an `upto`
            // authorisation at zero moves no money and writes no transaction.
            const settlement = await this.x402.settle(hold.paymentPayload, hold.paymentRequirements, 0n);
            await this.store.putHold({ ...hold, state: "RELEASED", settlement });
            return { payer, blockNumber: receipt.blockNumber, settled: true, settlement };
        }
        catch (cause) {
            // A timeout is indeterminate: retrying could race a settlement the
            // facilitator already accepted. Preserve that distinction.
            await this.store.putHold({ ...hold, state: "UNKNOWN" });
            throw cause;
        }
    }
    // --- settlement ---------------------------------------------------------
    /** Charge every hold that never checked in, and close the event. */
    async finalize(eventId) {
        const holds = await this.store.listHolds(eventId);
        const noShows = holds
            .filter((h) => h.state === "AUTHORIZED" && h.payer)
            .map((h) => getAddress(h.payer));
        const txHash = await this.write("finalize", [eventId, noShows], batchGas(GAS.FINALIZE_BASE, noShows.length));
        await this.publicClient.waitForTransactionReceipt({ hash: txHash });
        for (const hold of holds) {
            if (hold.payer && noShows.includes(getAddress(hold.payer))) {
                await this.store.putHold({ ...hold, state: "CHARGED" });
            }
        }
        return { txHash, charged: noShows };
    }
    /** Record that attendees who showed were paid their share. */
    async payout(eventId, amountEach) {
        const holds = await this.store.listHolds(eventId);
        const recipients = holds
            .filter((h) => h.state === "RELEASED" && h.payer)
            .map((h) => getAddress(h.payer));
        const txHash = await this.write("payout", [eventId, recipients, Math.round(amountEach * 1_000_000)], batchGas(GAS.PAYOUT_BASE, recipients.length));
        await this.publicClient.waitForTransactionReceipt({ hash: txHash });
        return { txHash, paid: recipients };
    }
    // --- reads --------------------------------------------------------------
    /** Everything a venue display needs, without a contract read per block. */
    async venueState(eventId) {
        const blockNumber = await this.publicClient.getBlockNumber({ cacheTime: 0 });
        return {
            blockNumber,
            challenge: challengeAtBlock(eventId, blockNumber),
            blocksLeft: Number(CHALLENGE_BLOCKS - (blockNumber % CHALLENGE_BLOCKS)),
        };
    }
    /** Aggregate counts, read from contract state rather than reconstructed from logs. */
    async eventStats(eventId) {
        const result = await this.publicClient.readContract({
            address: this.registry,
            abi: noShowRegistryAbi,
            functionName: "eventScreen",
            args: [eventId],
        });
        const [info, registered, checkedIn, challenge] = result;
        return {
            info: info,
            registered: Number(registered),
            checkedIn: Number(checkedIn),
            challenge: challenge,
        };
    }
    /** Base units of the configured asset, for balance checks. */
    holdAmountBaseUnits() {
        return toBaseUnits(this.holdAmount, this.asset.decimals);
    }
}
/**
 * A bytes32 reference to the authorisation, recorded on chain.
 *
 * Derived from the intent id so a row on chain can be traced back to a stored
 * authorisation without putting anything identifying on a public ledger.
 */
function intentIdToAuthRef(intentId) {
    const hex = intentId.replace(/-/g, "");
    return `0x${hex.padEnd(64, "0")}`;
}
