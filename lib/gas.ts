/**
 * Hardcoded gas limits. Every write path in this app reads its limit from here.
 *
 * WHY THIS FILE EXISTS
 *
 * Monad charges the gas LIMIT, not the gas used: the total deducted is
 * `value + gas_bid * gas_limit`, with no refund of the difference. A limit is a
 * real cost, not a free safety margin.
 *
 * This was confirmed the hard way on 2026-08-22. A `checkIn` sent with
 * `--gas-limit 200000` reverted, and the receipt reported `gasUsed: 200000` — the
 * entire limit consumed and charged for a transaction that did nothing.
 *
 * Worse, `eth_estimateGas` is not merely discouraged here, it is unusable.
 * `cast send` estimates before broadcasting, and that single extra round trip took
 * long enough that the check-in challenge went stale — three attempts in a row
 * failed with `StaleChallenge` before the transaction was even signed. The 3-block
 * window is 1.2 seconds; an estimate round trip does not fit inside it.
 *
 * MEASUREMENTS
 *
 * Measured against: 0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2 (Monad Testnet)
 * Measured on:      2026-08-22
 *
 *   register  91_543  observed on chain, real transaction, block 55888240
 *   checkIn   74_382  `forge test --gas-report` max
 *   finalize  65_382  same, for a single-address batch
 *   payout    37_259  same, for a single-address batch
 *
 * `forge test` reported `register` at 90_813 against 91_543 measured on chain, so
 * the report runs under 1% light. Limits below are the measurement plus ~20%
 * headroom, per MONAD.md.
 *
 * Re-measure whenever NoShow.sol is redeployed. A limit that has become too low
 * reverts out-of-gas mid-demo and still charges the full amount.
 */
export const GAS = {
  /** Attendee-signed. 91_543 measured + 20%. */
  REGISTER: 110_000n,

  /**
   * Attendee-signed, and the one that must never be estimated. 74_382 + 20%,
   * rounded up. Kept tight because the attendee pays this whether it is used
   * or not.
   *
   * Validated on chain: a real checkIn at this exact limit succeeded in block
   * 55899229. Note that a Monad receipt reports `gasUsed` equal to the LIMIT
   * rather than the consumption, so the receipt cannot tell you your margin —
   * a successful transaction at a given limit is the only real evidence.
   */
  CHECK_IN: 90_000n,

  /**
   * Organiser-signed batches. Both loop over addresses, so these are per-call
   * bases; add PER_ADDRESS for each entry beyond the first.
   */
  FINALIZE_BASE: 80_000n,
  PAYOUT_BASE: 45_000n,
  PER_ADDRESS: 30_000n,
} as const satisfies Record<string, bigint>;

/** Gas limit for a batch call over `count` addresses. */
export function batchGas(base: bigint, count: number): bigint {
  return base + GAS.PER_ADDRESS * BigInt(Math.max(0, count - 1));
}
