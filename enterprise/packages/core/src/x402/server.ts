import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  PaymentRequired,
} from "@x402/core/types";
import { UptoEvmScheme } from "@x402/evm/upto/server";
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
  verify: (payload: PaymentPayload) => Promise<{ payer: Address; requirements: PaymentRequirements }>;
  settle: (
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    amount: bigint,
  ) => Promise<unknown>;
};

/**
 * Convert a decimal price into base units without going through floating point.
 *
 * `amount * 10 ** 18` silently loses precision above 2^53, which would produce an
 * authorisation for a subtly wrong number — the kind of bug that only shows up in
 * settlement.
 */
export function toBaseUnits(amount: number, decimals: number): bigint {
  const scale = 10n ** BigInt(decimals);
  const whole = BigInt(Math.floor(amount));
  const fraction = BigInt(Math.round((amount - Math.floor(amount)) * 1e6));
  return whole * scale + (fraction * scale) / 1_000_000n;
}

export function createX402Server(options: X402Options): X402Server {
  const facilitator = new HTTPFacilitatorClient({ url: options.facilitatorUrl });
  const server = new x402ResourceServer(facilitator);

  // Testnet assets are never in the SDK's built-in table, so the money parser
  // declares the asset explicitly.
  const scheme = new UptoEvmScheme();
  scheme.registerMoneyParser(async (amount: number, network: string) => {
    if (network !== options.network) return null;
    return {
      amount: toBaseUnits(amount, options.asset.decimals).toString(),
      asset: options.asset.address,
      extra: { name: options.asset.symbol, version: "1" },
    };
  });
  server.register(options.network, scheme);

  // `initialize` fetches /supported, which is where the facilitator address the
  // upto client must bind into its Permit2 witness comes from. Awaited once and
  // shared, not per request.
  const ready = server.initialize().then(() => server);

  const requirements = async () => {
    const x402 = await ready;
    return x402.buildPaymentRequirements({
      scheme: "upto",
      network: options.network,
      payTo: options.payTo,
      price: options.price,
      maxTimeoutSeconds: options.timeoutSeconds,
    });
  };

  return {
    requirements,

    async paymentRequired(resourceUrl, description, error) {
      const x402 = await ready;
      return x402.createPaymentRequiredResponse(
        await requirements(),
        { url: resourceUrl, description, mimeType: "application/json" },
        error,
      );
    },

    async verify(payload) {
      const x402 = await ready;
      const matched = x402.findMatchingRequirements(await requirements(), payload);
      if (!matched) throw new Error("No payment requirement matched this authorization.");

      const result = await x402.verifyPayment(payload, matched);
      if (!result.isValid || !result.payer) {
        // Surface the facilitator's own reason. Swallowing it turns "the payer
        // holds no balance" into an unfalsifiable "could not be verified", which
        // is the most expensive kind of error message to debug.
        throw new Error(result.invalidReason ?? "The facilitator rejected the authorization.");
      }
      return { payer: result.payer as Address, requirements: matched };
    },

    async settle(payload, requirements, amount) {
      const x402 = await ready;
      const result = await x402.settlePayment(payload, requirements, undefined, undefined, {
        amount: amount.toString(),
      });
      if (!result.success) {
        throw new Error(result.errorMessage ?? "Settlement failed.");
      }
      return result;
    },
  };
}
