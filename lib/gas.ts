/**
 * Hardcoded gas limits. Every write path in this app reads its limit from here.
 *
 * WHY THIS FILE EXISTS
 *
 * Monad charges the gas LIMIT, not the gas used: the total deducted from the
 * sender is `value + gas_bid * gas_limit`, and there is no refund of the
 * difference. On Ethereum an over-generous limit is free; here you pay for every
 * unit you reserve. So a limit is a real cost, not a safety margin.
 *
 * The consequence is that `eth_estimateGas` must never appear in a user-facing
 * path (CLAUDE.md, "Hard constraints"). It costs a network round trip on a public
 * RPC that rate-limits it to 25 rps, it can fail or return a stale answer under
 * load, and during a live demo that is a hang on the one screen everybody is
 * watching. We measure once, add ~20% headroom, and commit the number.
 *
 * HOW TO FILL THIS IN
 *
 * After the contract is deployed, run the call once against testnet, read the
 * `gasUsed` from the receipt, multiply by 1.2, round up, and record it below with
 * the date it was measured and the contract address it was measured against.
 * Re-measure whenever NoShow.sol is redeployed — a changed storage layout or a
 * changed branch changes the number, and a limit that is now too low reverts
 * out-of-gas mid-demo while still charging the full limit.
 *
 * Measured against: (not yet deployed)
 * Measured on:      (not yet measured)
 */
export const GAS = {} as const satisfies Record<string, bigint>;
