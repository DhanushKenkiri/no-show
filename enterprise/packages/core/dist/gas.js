/**
 * Hardcoded gas limits. Every write path reads its limit from here.
 *
 * WHY THIS FILE EXISTS
 *
 * Monad charges the gas LIMIT, not the gas used: the total deducted is
 * `value + gas_bid * gas_limit`, with no refund of the difference. A limit is a
 * real cost, not a free safety margin.
 *
 * This was confirmed the hard way. A `checkIn` sent with `--gas-limit 200000`
 * reverted, and the receipt reported `gasUsed: 200000` — the entire limit consumed
 * and charged for a transaction that did nothing. Note also that a Monad receipt
 * reports `gasUsed` equal to the limit rather than the consumption, so a receipt
 * cannot tell you your margin; a successful transaction at a given limit is the
 * only real evidence.
 *
 * Worse, `eth_estimateGas` is not merely discouraged on the check-in path, it is
 * unusable. `cast send` estimates before broadcasting, and that single extra round
 * trip took long enough that the challenge went stale — three attempts in a row
 * failed with StaleChallenge before the transaction was even signed. The window is
 * about a second; an estimate round trip does not fit inside it.
 *
 * MEASUREMENTS  (`forge test --gas-report`, NoShowRegistry)
 *
 *   createEvent   53_541
 *   register      91_078
 *   checkIn       74_623
 *   finalize      48_664   single-address batch
 *   payout        45_617   single-address batch
 *
 * The report runs slightly light against real transactions — a measured on-chain
 * register on the single-event contract came in at 91_543 against a reported
 * 90_813 — so the limits below add roughly 20% on top, as Monad's own guidance
 * suggests. CHECK_IN at 90_000 has been validated by a real successful check-in.
 *
 * Re-measure whenever the contract is redeployed. A limit that has drifted too low
 * reverts out-of-gas mid-event and still charges the full amount.
 */
export const GAS = {
    /** Organiser-signed, once per event. */
    CREATE_EVENT: 70000n,
    /** Attendee-signed. */
    REGISTER: 110000n,
    /**
     * Attendee-signed, and the one that must never be estimated. Kept tight because
     * the attendee pays this whether it is used or not.
     */
    CHECK_IN: 90000n,
    /** Organiser-signed batches. Add PER_ADDRESS for each entry beyond the first. */
    FINALIZE_BASE: 80000n,
    PAYOUT_BASE: 70000n,
    PER_ADDRESS: 30000n,
    /** Wrapping native token into its ERC-20 form. */
    WRAP: 60000n,
    /** One-time Permit2 approval. */
    APPROVE: 60000n,
};
/** Gas limit for a batch call over `count` addresses. */
export function batchGas(base, count) {
    return base + GAS.PER_ADDRESS * BigInt(Math.max(0, count - 1));
}
