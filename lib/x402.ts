import {
  HTTPFacilitatorClient,
  x402ResourceServer,
} from "@x402/core/server";
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  PaymentRequired,
} from "@x402/core/types";
import { UptoEvmScheme } from "@x402/evm/upto/server";
import { ORGANISER_ADDRESS } from "@/lib/config";
import {
  HOLD_ASSET,
  HOLD_ASSET_DECIMALS,
  HOLD_ASSET_SYMBOL,
  HOLD_LABEL,
  HOLD_PRICE,
  MONAD_FACILITATOR_URL,
  MONAD_X402_NETWORK,
} from "@/lib/x402-constants";

export {
  MONAD_X402_NETWORK,
  MONAD_FACILITATOR_URL,
  HOLD_ASSET,
  HOLD_PRICE,
  HOLD_DISPLAY_6DP,
  HOLD_LABEL,
} from "@/lib/x402-constants";

/**
 * The authorization must last through the event and its organizer finalization.
 * An unused authorization simply expires; no funds were moved, so no refund is
 * needed (X402.md).
 */
const HOLD_TIMEOUT_SECONDS = 60 * 60 * 24;

const facilitator = new HTTPFacilitatorClient({ url: MONAD_FACILITATOR_URL });
const server = new x402ResourceServer(facilitator);

// The hold asset is not in the SDK's built-in table — it never is for a testnet —
// so the money parser declares it explicitly, exactly as X402.md prescribes. The
// only departures from that example are the asset and its decimals: WMON has 18,
// USDC has 6. See lib/x402-constants.ts for why the asset changed.
//
// The multiplication is done in BigInt. `amount * 10 ** 18` in floating point
// silently loses precision above 2^53, which would produce an authorisation for a
// subtly wrong number.
const monadScheme = new UptoEvmScheme();
monadScheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network !== MONAD_X402_NETWORK) return null;

  const scale = 10n ** BigInt(HOLD_ASSET_DECIMALS);
  const whole = BigInt(Math.floor(amount));
  const fraction = BigInt(Math.round((amount - Math.floor(amount)) * 1e6));

  return {
    amount: (whole * scale + (fraction * scale) / 1_000_000n).toString(),
    asset: HOLD_ASSET,
    extra: { name: HOLD_ASSET_SYMBOL, version: "1" },
  };
});
server.register(MONAD_X402_NETWORK, monadScheme);

// `initialize` fetches /supported. In particular, it obtains the facilitator
// address that the upto client must bind into its Permit2 witness.
const initializedServer = server.initialize().then(() => server);

export async function getX402Server() {
  return initializedServer;
}

export async function getRegistrationRequirements(): Promise<
  PaymentRequirements[]
> {
  const x402 = await getX402Server();

  return x402.buildPaymentRequirements({
    scheme: "upto",
    network: MONAD_X402_NETWORK,
    payTo: ORGANISER_ADDRESS,
    price: HOLD_PRICE,
    maxTimeoutSeconds: HOLD_TIMEOUT_SECONDS,
  });
}

/** Build the canonical x402 v2 response for an unpaid or invalid request. */
export async function getPaymentRequired(
  request: Request,
  error?: string,
): Promise<PaymentRequired> {
  const x402 = await getX402Server();
  const requirements = await getRegistrationRequirements();

  return x402.createPaymentRequiredResponse(
    requirements,
    {
      url: request.url,
      description: `Authorize a ${HOLD_LABEL} No-Show event-registration hold`,
      mimeType: "application/json",
    },
    error,
  );
}

export type VerifiedRegistration = {
  payer: string;
  paymentPayload: PaymentPayload;
  paymentRequirements: PaymentRequirements;
};

/**
 * Decode and verify an upto authorization without settling it. Registration is
 * specifically an authorization intake: its funds remain untouched until either
 * check-in ($0) or organizer finalization (the hold amount).
 */
export async function verifyRegistration(
  paymentPayload: PaymentPayload,
): Promise<VerifiedRegistration | null> {
  const x402 = await getX402Server();
  const requirements = await getRegistrationRequirements();
  const paymentRequirements = x402.findMatchingRequirements(
    requirements,
    paymentPayload,
  );

  if (!paymentRequirements) return null;

  const verification = await x402.verifyPayment(
    paymentPayload,
    paymentRequirements,
  );

  if (!verification.isValid || !verification.payer) {
    // Surface the facilitator's own reason. Swallowing it turns "the payer holds
    // no balance" into an unfalsifiable "could not be verified", which is the
    // single most expensive kind of error message to debug.
    throw new Error(
      verification.invalidReason ?? "The facilitator rejected the authorization.",
    );
  }

  return {
    payer: verification.payer,
    paymentPayload,
    paymentRequirements,
  };
}
