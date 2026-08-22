import { decodePaymentSignatureHeader, encodePaymentRequiredHeader } from "@x402/core/http";
import type { PaymentPayload } from "@x402/core/types";
import { NextResponse } from "next/server";
import { getAddress, isAddress, type Hex } from "viem";
import {
  authorizationReference,
  getHold,
  normalizedPayer,
  putHold,
} from "@/lib/holds";
import {
  getPaymentRequired,
  HOLD_PRICE_USDC,
  verifyRegistration,
} from "@/lib/x402";

export const runtime = "nodejs";

const BYTES32 = /^0x[\da-fA-F]{64}$/;

type RegisterBody = { eventId?: unknown };

function validEventId(value: unknown): value is Hex {
  return typeof value === "string" && BYTES32.test(value);
}

async function jsonBody(request: Request): Promise<RegisterBody | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" ? (value as RegisterBody) : null;
  } catch {
    return null;
  }
}

async function paymentRequired(request: Request, error?: string) {
  const required = await getPaymentRequired(request, error);

  return NextResponse.json(required, {
    status: 402,
    headers: {
      "payment-required": encodePaymentRequiredHeader(required),
      "cache-control": "no-store",
    },
  });
}

/**
 * Intake an `upto` authorization. This route deliberately verifies but does
 * not settle: the signed maximum stays a hold until /api/checkin releases it
 * for $0, or until the organizer finalizes the event.
 */
export async function POST(request: Request) {
  const paymentHeader = request.headers.get("payment-signature");
  if (!paymentHeader) return paymentRequired(request);

  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = decodePaymentSignatureHeader(paymentHeader);
  } catch {
    return paymentRequired(request, "Malformed PAYMENT-SIGNATURE header.");
  }

  const body = await jsonBody(request);
  if (!body || !validEventId(body.eventId)) {
    return NextResponse.json(
      { error: "eventId must be a 32-byte hex value." },
      { status: 400 },
    );
  }

  let verified;
  try {
    verified = await verifyRegistration(paymentPayload);
  } catch (cause) {
    // A facilitator rejection is retriable with a fresh authorization, and the
    // canonical x402 response tells a compliant client how to sign one. But pass
    // the actual reason through — the commonest cause by far is that the payer
    // holds no testnet USDC, and a generic message hides that completely.
    const reason = cause instanceof Error ? cause.message : "unknown";
    return paymentRequired(request, `Authorization rejected: ${reason}`);
  }

  if (!verified || !isAddress(verified.payer)) {
    return paymentRequired(
      request,
      "No payment requirement matched this authorization.",
    );
  }

  const eventId = body.eventId.toLowerCase() as Hex;
  const payer = normalizedPayer(verified.payer);
  // A hold can already exist when the attendee authorised, then had their on-chain
  // register() rejected or dropped. Hand the same authRef back rather than erroring:
  // the client needs it to retry the transaction, and a 409 would strand them.
  const existing = getHold(eventId, payer);
  if (existing) {
    return NextResponse.json(
      {
        registered: true,
        reused: true,
        payer: getAddress(payer),
        authRef: existing.authRef,
        holdUsdc: Math.floor(HOLD_PRICE_USDC * 1_000_000).toString(),
        settlement: "pending",
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const authRef = authorizationReference(paymentPayload);
  putHold({
    eventId,
    payer,
    authRef,
    paymentPayload,
    paymentRequirements: verified.paymentRequirements,
    createdAt: new Date().toISOString(),
    state: "AUTHORIZED",
  });

  return NextResponse.json(
    {
      registered: true,
      payer: getAddress(payer),
      authRef,
      holdUsdc: Math.floor(HOLD_PRICE_USDC * 1_000_000).toString(),
      settlement: "pending",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
