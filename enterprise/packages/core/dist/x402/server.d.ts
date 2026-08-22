import type { Network, PaymentPayload, PaymentRequirements, PaymentRequired } from "@x402/core/types";
import type { Address } from "viem";
import type { AssetConfig } from "../config.js";
/**
 * The x402 resource-server half: build payment requirements, verify an
 * authorisation, settle it.
 *
 * VERSION PINNING IS LOAD-BEARING. @x402/core, @x402/evm and @x402/fetch must all
 * sit on exactly 2.22.0. @x402/evm@2.22.0 depends on @x402/core@~2.22.0 while the
 * 2.23 line depends on ~2.23.0; mixing them installs two copies of the core
 * registry, and a scheme registered into one is invisible to the other. The
 * failure is silent — payments fail at settlement with no clear error — so it will
 * not show up in a build or a typecheck. Never `npm update` these.
 */
export type X402Options = {
    /** x402 network id, e.g. "eip155:10143". */
    network: Network;
    facilitatorUrl: string;
    asset: AssetConfig;
    payTo: Address;
    price: number;
    timeoutSeconds: number;
};
export type X402Server = {
    requirements: () => Promise<PaymentRequirements[]>;
    paymentRequired: (resourceUrl: string, description: string, error?: string) => Promise<PaymentRequired>;
    verify: (payload: PaymentPayload) => Promise<{
        payer: Address;
        requirements: PaymentRequirements;
    }>;
    settle: (payload: PaymentPayload, requirements: PaymentRequirements, amount: bigint) => Promise<unknown>;
};
/**
 * Convert a decimal price into base units without going through floating point.
 *
 * `amount * 10 ** 18` silently loses precision above 2^53, which would produce an
 * authorisation for a subtly wrong number — the kind of bug that only shows up in
 * settlement.
 */
export declare function toBaseUnits(amount: number, decimals: number): bigint;
export declare function createX402Server(options: X402Options): X402Server;
