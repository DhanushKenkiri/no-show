import { decodePaymentSignatureHeader, encodePaymentRequiredHeader } from "@x402/core/http";
import { errorJson, json, noshow, store } from "@/lib/noshow";

export const runtime = "nodejs";

/**
 * The x402 handshake for one hold intent.
 *
 * No header  -> 402 with the payment requirements.
 * With header -> verify with the facilitator and attach the authorisation.
 *
 * Nothing settles here. The point of `upto` is that the money stays where it is
 * until check-in resolves it at zero, or finalize charges it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ intentId: string }> },
) {
  const { intentId } = await params;

  const hold = await store.getHold(intentId);
  if (!hold) return errorJson("Unknown or expired hold intent.", 404);

  const header = request.headers.get("payment-signature");

  if (!header) {
    const required = await noshow.paymentRequirementsFor(intentId, request.url);
    return json(required, {
      status: 402,
      headers: { "payment-required": encodePaymentRequiredHeader(required) },
    });
  }

  try {
    const payload = decodePaymentSignatureHeader(header);
    const updated = await noshow.acceptAuthorization(intentId, payload);
    return json({
      authorized: true,
      payer: updated.payer,
      authRef: updated.authRef,
      eventId: updated.eventId,
      registry: noshow.registry,
    });
  } catch (cause) {
    // Pass the facilitator's own reason through. Replacing it with something
    // generic is how "the payer holds no balance" becomes an afternoon of
    // debugging.
    const reason = cause instanceof Error ? cause.message : "unknown";
    const required = await noshow.paymentRequirementsFor(
      intentId,
      request.url,
      `Authorization rejected: ${reason}`,
    );
    return json(required, {
      status: 402,
      headers: { "payment-required": encodePaymentRequiredHeader(required) },
    });
  }
}
