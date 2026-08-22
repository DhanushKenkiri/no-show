import type { Address } from "viem";

/**
 * Shared x402 identifiers.
 *
 * These live apart from lib/x402.ts because that module imports `@x402/core/server`
 * and the facilitator client, which must never reach the browser bundle. The
 * constants themselves are needed on both sides.
 */
export const MONAD_X402_NETWORK = "eip155:10143" as const;

export const MONAD_FACILITATOR_URL = "https://x402-facilitator.molandak.org";

/**
 * THE HOLD IS DENOMINATED IN WRAPPED MON, NOT USDC.
 *
 * X402.md describes testnet USDC, and that is what this originally used. It was
 * changed for one practical reason: testnet USDC only comes from
 * faucet.circle.com at 1 USDC per pair every two hours, and MON is what the Monad
 * faucet actually hands out. A demo nobody can fund is not a demo.
 *
 * `upto` settles through Permit2, and Permit2 works with any ERC-20 — so the asset
 * is not fixed to USDC by the protocol. This was verified against the live Monad
 * facilitator rather than assumed: an `upto` authorisation for WMON came back
 * `isValid: true` from POST /verify.
 *
 * WMON is the canonical wrapper from MONAD.md. Note 18 decimals, not USDC's 6.
 */
export const HOLD_ASSET: Address =
  "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541";
export const HOLD_ASSET_SYMBOL = "MON";
export const HOLD_ASSET_DECIMALS = 18;

/** The hold: a maximum the attendee signs for, never a payment. */
export const HOLD_PRICE = 0.5;

/** The same amount in base units, for balance comparisons. */
export const HOLD_AMOUNT_WEI = 500_000_000_000_000_000n; // 0.5 * 1e18

/**
 * What gets recorded on chain.
 *
 * NoShow.register takes a `uint40`, which tops out around 1.1e12 — so 0.5e18 does
 * not fit and never could. The contract field is a human-readable record, not the
 * authorisation itself, so the amount is stored at 6dp (500_000 = 0.5) and the UI
 * formats it back with 6 decimals. The real amount lives in the x402 authorisation.
 */
export const HOLD_DISPLAY_6DP = 500_000;

/** "0.5 MON", for UI copy that must never drift from the constants above. */
export const HOLD_LABEL = `${HOLD_PRICE} ${HOLD_ASSET_SYMBOL}`;
