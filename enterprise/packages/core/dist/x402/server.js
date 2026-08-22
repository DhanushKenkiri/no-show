import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import { UptoEvmScheme } from "@x402/evm/upto/server";
/**
 * Convert a decimal price into base units without going through floating point.
 *
 * `amount * 10 ** 18` silently loses precision above 2^53, which would produce an
 * authorisation for a subtly wrong number — the kind of bug that only shows up in
 * settlement.
 */
export function toBaseUnits(amount, decimals) {
    const scale = 10n ** BigInt(decimals);
    const whole = BigInt(Math.floor(amount));
    const fraction = BigInt(Math.round((amount - Math.floor(amount)) * 1e6));
    return whole * scale + (fraction * scale) / 1000000n;
}
export function createX402Server(options) {
    const facilitator = new HTTPFacilitatorClient({ url: options.facilitatorUrl });
    const server = new x402ResourceServer(facilitator);
    // Testnet assets are never in the SDK's built-in table, so the money parser
    // declares the asset explicitly.
    const scheme = new UptoEvmScheme();
    scheme.registerMoneyParser(async (amount, network) => {
        if (network !== options.network)
            return null;
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
            return x402.createPaymentRequiredResponse(await requirements(), { url: resourceUrl, description, mimeType: "application/json" }, error);
        },
        async verify(payload) {
            const x402 = await ready;
            const matched = x402.findMatchingRequirements(await requirements(), payload);
            if (!matched)
                throw new Error("No payment requirement matched this authorization.");
            const result = await x402.verifyPayment(payload, matched);
            if (!result.isValid || !result.payer) {
                // Surface the facilitator's own reason. Swallowing it turns "the payer
                // holds no balance" into an unfalsifiable "could not be verified", which
                // is the most expensive kind of error message to debug.
                throw new Error(result.invalidReason ?? "The facilitator rejected the authorization.");
            }
            return { payer: result.payer, requirements: matched };
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
