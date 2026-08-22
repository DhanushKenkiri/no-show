import type { Address } from "viem";

/**
 * Shared x402 identifiers.
 *
 * These live apart from lib/x402.ts because that module imports `@x402/core/server`
 * and the facilitator client, which must never reach the browser bundle. The
 * constants themselves are needed on both sides.
 *
 * Values are from X402.md, which is ground truth.
 */
export const MONAD_X402_NETWORK = "eip155:10143" as const;

/** Testnet USDC. Not in the SDK's built-in asset table — hence the money parser. */
export const MONAD_TESTNET_USDC: Address =
  "0x534b2f3A21130d7a60830c2Df862319e593943A3";

export const MONAD_FACILITATOR_URL = "https://x402-facilitator.molandak.org";

/** A registration is a $2 maximum, not a $2 payment. */
export const HOLD_PRICE_USDC = 2;
