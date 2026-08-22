"use client";

import { connectorsForWallets, getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  injectedWallet,
  metaMaskWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { chain, RPC_URL } from "./chain";
import { WC_PROJECT_ID, WC_PROJECT_ID_MISSING } from "./config";

/**
 * Monad Testnet only. A single chain means RainbowKit shows the network switcher
 * already correct rather than offering a menu somebody can pick mainnet from
 * mid-demo.
 *
 * ssr: true is required under the App Router — without it wagmi touches
 * localStorage during prerender and the build fails.
 *
 * WHY THERE ARE TWO CONFIGS
 *
 * `getDefaultConfig` always installs the WalletConnect connector, and WalletConnect
 * with a missing project id does not fail quietly: it fetches
 * api.web3modal.org/appkit/v1/config (403), posts to pulse.walletconnect.org (400),
 * and fills the console with Reown errors before falling back to defaults. None of
 * that is needed to talk to a browser extension.
 *
 * So without a project id we build the connector list by hand with the injected
 * connector only. MetaMask's extension is an injected provider, so it is fully
 * supported — what is lost is WalletConnect QR pairing, which is the only thing
 * the project id was ever for.
 */
const injectedOnly = connectorsForWallets(
  [
    {
      groupName: "Installed",
      wallets: [injectedWallet, metaMaskWallet],
    },
  ],
  {
    appName: "No-Show",
    // Unused by the injected connector, but the signature requires a string.
    projectId: WC_PROJECT_ID,
  },
);

export const wagmiConfig = WC_PROJECT_ID_MISSING
  ? createConfig({
      chains: [chain],
      connectors: injectedOnly,
      transports: { [chain.id]: http(RPC_URL) },
      ssr: true,
    })
  : getDefaultConfig({
      appName: "No-Show",
      projectId: WC_PROJECT_ID,
      chains: [chain],
      ssr: true,
    });
