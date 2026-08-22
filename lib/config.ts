import type { Address } from "viem";

/**
 * The organiser account.
 *
 * This is the address the faucet funded (5 MON, confirmed on MonadVision at block
 * 55855040). It wears three hats in this build, which is a deliberate hackathon
 * simplification and belongs in the README's limitations:
 *
 *   1. deployer of NoShow.sol
 *   2. contract `admin` / organiser — the only address that may call finalize
 *   3. x402 payee — attendees' `upto` holds are authorised TO this address, and
 *      after finalize it pays the collected no-show holds back OUT to the
 *      attendees who actually showed up
 *
 * Because the authorisation cryptographically binds the recipient, this address
 * being wrong is not a security hole — it is a settlement that simply fails. But
 * it must match the deployer, or finalize reverts NotOrganiser.
 */
export const ORGANISER_ADDRESS: Address =
  "0xA02f986810602163f078e38488C6FE6756De606e";

/**
 * WalletConnect Cloud project id, required by RainbowKit.
 *
 * Free, from https://cloud.walletconnect.com. Set NEXT_PUBLIC_WC_PROJECT_ID in
 * .env.local AND in the Vercel project settings — a missing value there is a
 * silent "no wallets appear" on the deployed site, which is a horrible thing to
 * discover on stage.
 */
// `||`, deliberately not `??`. An unset variable is undefined, but a variable that
// is present and blank — `NEXT_PUBLIC_WC_PROJECT_ID=` in .env.local, or an empty
// field in the Vercel dashboard — is "". `??` passes "" straight through, and
// RainbowKit then throws "No projectId found" during prerender, which fails the
// whole build rather than degrading. Ask how I know.
export const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WC_PROJECT_ID || "MISSING_WC_PROJECT_ID";

/** True when no real project id is configured, so the UI can say so out loud. */
export const WC_PROJECT_ID_MISSING = WC_PROJECT_ID === "MISSING_WC_PROJECT_ID";
