"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { WagmiProvider } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

/**
 * RainbowKit's theme takes CSS colour strings, so the accent is handed straight
 * through as a token reference rather than a literal hex. The late visual pass
 * stays a one-file edit (CLAUDE.md, "Visual work").
 */
const theme = darkTheme({
  accentColor: "var(--accent)",
  accentColorForeground: "var(--text)",
  borderRadius: "medium",
  overlayBlur: "small",
});

export function Providers({ children }: { children: React.ReactNode }) {
  // Created in state so the cache is not shared between requests on the server.
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={theme} modalSize="compact">
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
