import { createPublicClient, defineChain, http } from "viem";
import { monadTestnet } from "viem/chains";

/**
 * Monad Testnet — values are from MONAD.md, which is ground truth for this repo.
 *
 * viem ships a built-in `monadTestnet` whose chain id (10143), RPC and Multicall3
 * address already match MONAD.md, so we extend it rather than redefine it. The one
 * disagreement is the block explorer: viem points at monadexplorer.com, MONAD.md
 * lists MonadVision. MONAD.md wins.
 *
 * Testnet was reset from genesis on 2025-12-16. Any address or block number from
 * before that date is gone.
 */
export const RPC_URL = "https://testnet-rpc.monad.xyz";
export const WS_URL = "wss://testnet-rpc.monad.xyz";
export const EXPLORER_URL = "https://testnet.monadvision.com";

export const chain = defineChain({
  ...monadTestnet,
  blockExplorers: {
    default: { name: "MonadVision", url: EXPLORER_URL },
  },
});

/**
 * Read client.
 *
 * `batch.multicall` is on because the public RPC caps eth_call at 25 rps and the
 * venue display polls every block (~400ms). Batching keeps the screen under the cap.
 */
export const publicClient = createPublicClient({
  chain,
  transport: http(RPC_URL),
  batch: { multicall: true },
});

/**
 * Block tags map to Monad's commit states (MONAD.md). Use `latest` for read-heavy
 * UI and `finalized` for anything presented as settled — the CommitPill in
 * DESIGN.md §4.13 reads all three at once to show the gap.
 */
export const COMMIT_STATES = ["latest", "safe", "finalized"] as const;
export type CommitState = (typeof COMMIT_STATES)[number];
