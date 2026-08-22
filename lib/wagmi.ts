"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { chain } from "./chain";
import { WC_PROJECT_ID, WC_PROJECT_ID_MISSING } from "./config";

if (WC_PROJECT_ID_MISSING) {
  console.warn(
    "[no-show] NEXT_PUBLIC_WC_PROJECT_ID is not set. Injected wallets will still " +
      "work, but WalletConnect (every mobile wallet) will not. Get one free at " +
      "https://cloud.walletconnect.com and set it in .env.local and on Vercel.",
  );
}

/**
 * Monad Testnet only. Passing a single chain means RainbowKit shows the network
 * switcher in an already-correct state rather than offering a menu somebody can
 * pick mainnet from mid-demo.
 *
 * ssr: true is required under the App Router — without it wagmi touches
 * localStorage during prerender and the build fails.
 */
export const wagmiConfig = getDefaultConfig({
  appName: "No-Show",
  projectId: WC_PROJECT_ID,
  chains: [chain],
  ssr: true,
});
