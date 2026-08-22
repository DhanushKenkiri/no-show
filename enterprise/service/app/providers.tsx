"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { monadTestnetChain, MONAD_TESTNET_RPC } from "@noshow/core";
import { useState } from "react";
import { http, createConfig, WagmiProvider } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * Wallet plumbing, deliberately minimal.
 *
 * Only the injected connector. The hold page is frequently rendered inside an
 * iframe on someone else's site, where a full wallet-selection modal is hostile —
 * and WalletConnect without a project id is worse than useless: it fetches
 * api.web3modal.org (403), posts to pulse.walletconnect.org (400) and fills the
 * console with errors before falling back. MetaMask and every other extension are
 * injected providers, so nothing is lost.
 */
const config = createConfig({
  chains: [monadTestnetChain],
  connectors: [injected()],
  transports: { [monadTestnetChain.id]: http(MONAD_TESTNET_RPC) },
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
