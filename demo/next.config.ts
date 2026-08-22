import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    /**
     * RainbowKit pulls in wagmi's Coinbase Base Account connector, which pulls in
     * @coinbase/cdp-sdk, which imports @x402/svm — the SOLANA x402 package — from
     * a module we never execute.
     *
     * We cannot install it. @x402/svm@2.23.0 depends on @x402/core@~2.23.0, and
     * @x402/evm is pinned to 2.22.0 which needs @x402/core@~2.22.0. Installing it
     * would put two copies of @x402/core in the tree, and a scheme registered
     * into one registry is invisible to the other — the exact silent settlement
     * failure X402.md warns about. It would also add the whole Solana toolchain
     * to a Monad app.
     *
     * So the leaf module is resolved to an empty stub. The only code path that
     * reaches it is Coinbase smart-account payments on Solana, which this app
     * never uses.
     */
    config.resolve.alias = {
      ...config.resolve.alias,
      "@x402/svm/exact/client": false,
    };
    return config;
  },
};

export default nextConfig;
