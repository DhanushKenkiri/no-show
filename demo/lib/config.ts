import { keccak256, toHex, type Address } from "viem";

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
 * WalletConnect Cloud project id.
 *
 * OPTIONAL. Injected wallets — the MetaMask extension, or the site opened inside
 * MetaMask mobile's in-app browser — do not need it. Without one, lib/wagmi.ts
 * drops the WalletConnect connector entirely rather than letting it fail noisily.
 * Set it only if you want WalletConnect QR pairing.
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

/**
 * The event this build demos. A bytes32 id, derived so the client, the server and
 * scripts/smoke.ts can never disagree about which event they are talking about.
 *
 * The venue display derives the challenge from this plus the block number, exactly
 * as NoShow.currentChallenge does, so no contract read is needed per block.
 */
export const EVENT_ID = keccak256(toHex("monad-blitz-hyderabad-v3"));

/** Must match CHALLENGE_BLOCKS in NoShow.sol. At ~400ms blocks this is 1.2s. */
export const CHALLENGE_BLOCKS = 3n;

/**
 * How many windows ahead the venue display shows.
 *
 * This exists because of a measured fact, not a preference. A check-in sent from
 * Hyderabad with no gas estimation, a pre-warmed nonce and a local key that signs
 * instantly still mined THREE blocks after the block its challenge was derived
 * from — and the window is three blocks wide, so it reverted StaleChallenge with
 * the full gas limit charged. All three public RPCs measure 275-300ms round trip,
 * so there is no faster endpoint to escape to.
 *
 * Showing the next window fixes it exactly. A scan during window `w` produces a
 * transaction that mines around three blocks later, which is precisely window
 * `w + 1`. The contract is unchanged and still only accepts a three-block window;
 * the display is simply aiming at the window the transaction will actually land in.
 *
 * Tune with NEXT_PUBLIC_VENUE_LEAD if the venue's network is faster or slower —
 * `0` reverts to showing the live window.
 */
export const VENUE_LEAD_WINDOWS = BigInt(
  process.env.NEXT_PUBLIC_VENUE_LEAD || "1",
);

/**
 * $2.00 at USDC's 6 decimals. Must match HOLD_PRICE_USDC in lib/x402.ts.
 *
 * A `number`, not a bigint: NoShow.register takes `uint40`, and viem maps integer
 * types narrower than 48 bits to `number` because they fit exactly.
 */
export const HOLD_USDC_6DP = 2_000_000;
