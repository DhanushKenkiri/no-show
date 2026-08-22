import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The SDK packages ship as ESM built by tsc. Transpiling them here means a
  // change to a package shows up without a separate rebuild step in development.
  transpilePackages: ["@noshow/core", "@noshow/adapters", "@noshow/react"],
  webpack: (config) => {
    /**
     * wagmi's Coinbase connector reaches @coinbase/cdp-sdk, which imports
     * @x402/svm — the SOLANA x402 package — from a module we never execute.
     *
     * It cannot be installed: @x402/svm depends on @x402/core@~2.23.0 while
     * @x402/evm is pinned to 2.22.0 and needs ~2.22.0. Two copies of @x402/core
     * in one tree means a scheme registered into one registry is invisible to the
     * other, which is a silent settlement failure. So the leaf is stubbed.
     */
    config.resolve.alias = { ...config.resolve.alias, "@x402/svm/exact/client": false };
    return config;
  },
};

export default nextConfig;
