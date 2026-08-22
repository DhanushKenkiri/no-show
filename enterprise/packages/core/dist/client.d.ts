import { type Account, type Address, type Chain, type Hex, type PublicClient } from "viem";
import { type AssetConfig } from "./config.js";
import type { Hold, Store } from "./store/index.js";
import type { Network as X402Network } from "@x402/core/types";
export type NoShowConfig = {
    /** Deployed NoShowRegistry. */
    registry: Address;
    store: Store;
    /**
     * Signs organiser-side transactions: createEvent, finalize, payout.
     * Attendees sign their own register and checkIn from their wallet, so this key
     * never touches an attendee's funds.
     */
    organiser?: Account;
    /** Base URL where the hosted hold page lives, used to build holdUrl. */
    baseUrl: string;
    chain?: Chain;
    rpcUrl?: string;
    x402Network?: X402Network;
    facilitatorUrl?: string;
    asset?: AssetConfig;
    /** Hold size in whole units of the asset. Default 0.5. */
    holdAmount?: number;
    /** How long an authorisation stays valid. Default 24h. */
    holdTimeoutSeconds?: number;
};
export type HoldIntent = {
    intentId: string;
    eventId: Hex;
    /** Send the attendee here. Works as a redirect target or an iframe src. */
    holdUrl: string;
    expiresAt: string;
};
/**
 * The one object an integrator needs.
 *
 * Everything Monad-, x402- or Permit2-specific lives behind this. A platform calls
 * `createEvent` once, `createHoldIntent` per registration, and `verifyCheckIn`
 * when someone scans. It never has to know what Permit2 is.
 */
export declare class NoShowClient {
    readonly registry: Address;
    readonly store: Store;
    readonly publicClient: PublicClient;
    readonly baseUrl: string;
    readonly asset: AssetConfig;
    readonly holdAmount: number;
    private readonly chain;
    private readonly organiser?;
    private readonly x402;
    constructor(config: NoShowConfig);
    /** Namespaced event id. Two tenants using the same external id do not collide. */
    eventIdFor(tenantId: string, externalEventId: string): Hex;
    /**
     * The hold amount as the contract records it.
     *
     * The registry stores a uint40, which tops out around 1.1e12 — so an 18-decimal
     * amount cannot fit and never could. The on-chain figure is a human-readable
     * record at 6dp; the authoritative amount lives in the x402 authorisation.
     */
    private holdAmount6dp;
    private requireOrganiser;
    private write;
    /** Open an event on chain. Idempotent: an existing event is left alone. */
    createEvent(eventId: Hex): Promise<{
        eventId: Hex;
        txHash?: Hex;
        alreadyExisted: boolean;
    }>;
    /**
     * Create a pending hold and return a URL to send the attendee to.
     *
     * This never touches the chain or the facilitator, because the two places it is
     * called from cannot afford to wait: a Luma webhook must answer within five
     * seconds, and the attendee is not present to sign anyway. The signature happens
     * later, when they open `holdUrl`.
     */
    createHoldIntent(input: {
        tenantId: string;
        eventId: Hex;
        externalId?: string;
        metadata?: Record<string, string>;
        ttlSeconds?: number;
    }): Promise<HoldIntent>;
    /** The 402 body for an intent — hand this straight back with status 402. */
    paymentRequirementsFor(intentId: string, resourceUrl: string, error?: string): Promise<import("@x402/core/types").PaymentRequired>;
    /**
     * Verify a signed authorisation and attach it to the intent.
     *
     * Nothing settles here. The point of `upto` is that the money stays put until
     * either check-in resolves it at zero or finalize charges it.
     */
    acceptAuthorization(intentId: string, paymentPayload: unknown): Promise<Hold>;
    /**
     * Confirm a mined check-in and release the hold for zero.
     *
     * The attendee's own wallet sent the transaction, so `msg.sender` is genuinely
     * them and no server ever holds an attendee key. Note the client sends it and
     * posts the hash: MetaMask does not implement `eth_signTransaction`, so a
     * browser cannot hand over a detached signed transaction to be broadcast.
     */
    verifyCheckIn(input: {
        eventId: Hex;
        challenge: Hex;
        txHash: Hex;
    }): Promise<{
        payer: Address;
        blockNumber: bigint;
        settled: boolean;
        settlement?: unknown;
        warning?: string;
    }>;
    /** Charge every hold that never checked in, and close the event. */
    finalize(eventId: Hex): Promise<{
        txHash: Hex;
        charged: Address[];
    }>;
    /** Record that attendees who showed were paid their share. */
    payout(eventId: Hex, amountEach: number): Promise<{
        txHash: Hex;
        paid: Address[];
    }>;
    /** Everything a venue display needs, without a contract read per block. */
    venueState(eventId: Hex): Promise<{
        blockNumber: bigint;
        challenge: `0x${string}`;
        blocksLeft: number;
    }>;
    /** Aggregate counts, read from contract state rather than reconstructed from logs. */
    eventStats(eventId: Hex): Promise<{
        info: {
            organiser: Address;
            holdAmount: number;
            closed: boolean;
        };
        registered: number;
        checkedIn: number;
        challenge: Hex;
    }>;
    /** Base units of the configured asset, for balance checks. */
    holdAmountBaseUnits(): bigint;
}
