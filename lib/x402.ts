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

/** Monad's x402 identifiers. This app deliberately never offers another chain. */
export const MONAD_X402_NETWORK: Network = "eip155:10143";
export const MONAD_TESTNET_USDC =
  "0x534b2f3A21130d7a60830c2Df862319e593943A3";
export const MONAD_FACILITATOR_URL = "https://x402-facilitator.molandak.org";

/** A registration is a $2 maximum, not a $2 payment. */
export const HOLD_PRICE_USDC = 2;

/**
 * The authorization must last through the event and its organizer finalization.
 * An unused authorization simply expires; no funds were moved, so no refund is
 * needed (X402.md).
 */
const HOLD_TIMEOUT_SECONDS = 60 * 60 * 24;

const facilitator = new HTTPFacilitatorClient({ url: MONAD_FACILITATOR_URL });
const server = new x402ResourceServer(facilitator);

// Monad testnet USDC is not in the SDK's built-in asset table. Keep this parser
// byte-for-byte equivalent in behaviour to the one prescribed in X402.md: Monad
// USDC has 6 decimals and uses the EIP-712 domain "USDC" / version "2".
const monadScheme = new UptoEvmScheme();
monadScheme.registerMoneyParser(async (amount: number, network: string) => {
  if (network === "eip155:10143") {
    return {
      amount: Math.floor(amount * 1_000_000).toString(),
      asset: "0x534b2f3A21130d7a60830c2Df862319e593943A3",
      extra: { name: "USDC", version: "2" },
    };
  }
  return null;
});
server.register("eip155:10143", monadScheme);

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
    price: HOLD_PRICE_USDC,
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
      description: "Authorize a $2 No-Show event-registration hold",
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

  if (!verification.isValid || !verification.payer) return null;

  return {
    payer: verification.payer,
    paymentPayload,
    paymentRequirements,
  };
}
