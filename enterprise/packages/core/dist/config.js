import { defineChain } from "viem";
import { monadTestnet } from "viem/chains";
/**
 * Network and asset configuration.
 *
 * Everything here is overridable through `NoShowClient`, because an SDK that
 * hardcodes one chain is not an SDK. The defaults are Monad Testnet, which is what
 * has actually been tested end to end.
 */
export const MONAD_TESTNET_RPC = "https://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_WS = "wss://testnet-rpc.monad.xyz";
export const MONAD_TESTNET_EXPLORER = "https://testnet.monadvision.com";
/**
 * viem ships a `monadTestnet` whose chain id, RPC and Multicall3 address already
 * match Monad's published values, so it is extended rather than redefined. The one
 * disagreement is the explorer, where MonadVision is used.
 */
export const monadTestnetChain = defineChain({
    ...monadTestnet,
    blockExplorers: {
        default: { name: "MonadVision", url: MONAD_TESTNET_EXPLORER },
    },
});
/** x402 network identifier for Monad Testnet. */
export const MONAD_TESTNET_X402 = "eip155:10143";
/** The Monad Foundation's x402 facilitator. It pays gas on settle. */
export const MONAD_FACILITATOR_URL = "https://x402-facilitator.molandak.org";
/**
 * The hold asset defaults to Wrapped MON, not USDC.
 *
 * `upto` settles through Permit2, and Permit2 moves any ERC-20, so the asset is
 * not fixed by the protocol. WMON is the default because the Monad faucet hands
 * out MON freely while testnet USDC is rate-limited to 1 per pair every two hours —
 * an integration nobody can fund is not an integration. Verified against the live
 * facilitator: an `upto` authorisation for WMON returns isValid.
 *
 * Point `holdAsset` at testnet USDC (0x534b2f3A21130d7a60830c2Df862319e593943A3,
 * 6 decimals) if that suits your users better.
 */
export const WRAPPED_MON = "0xFb8bf4c1CC7a94c73D209a149eA2AbEa852BC541";
export const MONAD_TESTNET_USDC = "0x534b2f3A21130d7a60830c2Df862319e593943A3";
/** Permit2 is the same canonical address on every chain that has it. */
export const PERMIT2 = "0x000000000022d473030f116ddee9f6b43ac78ba3";
export const WMON_ASSET = {
    address: WRAPPED_MON,
    symbol: "MON",
    decimals: 18,
    wrapsNative: true,
};
export const USDC_ASSET = {
    address: MONAD_TESTNET_USDC,
    symbol: "USDC",
    decimals: 6,
    wrapsNative: false,
};
/**
 * Must match CHALLENGE_BLOCKS in NoShowRegistry.sol. Changing it here without
 * changing the contract silently breaks every check-in.
 */
export const CHALLENGE_BLOCKS = 3n;
/**
 * How many windows ahead the venue display should aim.
 *
 * This exists because of a measurement, not a preference. A check-in sent with no
 * gas estimation, a pre-warmed nonce and a local key that signs instantly still
 * mined three blocks after the block its challenge came from — and the window is
 * three blocks wide, so it reverted StaleChallenge with the full gas limit charged.
 * Every public Monad RPC measures 275-300ms round trip, so there is no faster
 * endpoint to escape to.
 *
 * Showing the next window fixes it: a scan during window `w` becomes a transaction
 * that mines about three blocks later, which is exactly window `w + 1`. The
 * contract is unchanged and still only accepts a three-block window; the display is
 * aiming at the window the transaction will actually land in.
 */
export const DEFAULT_VENUE_LEAD_WINDOWS = 1n;
/** Block tags map to Monad's commit states: Proposed, Voted, Finalized. */
export const COMMIT_STATES = ["latest", "safe", "finalized"];
