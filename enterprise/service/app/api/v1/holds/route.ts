import { GenericAdapter } from "@noshow/adapters";
import { errorJson, json, noshow, tenantFromRequest } from "@/lib/noshow";

export const runtime = "nodejs";

/**
 * Create a hold intent for one guest.
 *
 * This is the whole integration for a platform with no API of its own: POST here
 * on registration, then send the guest to `holdUrl`.
 *
 * It touches neither the chain nor the facilitator. The attendee is not present
 * to sign, so there is nothing to wait for, and callers on a webhook budget
 * cannot afford a round trip anyway.
 */
export async function POST(request: Request) {
  const tenant = await tenantFromRequest(request);
  if (!tenant) return errorJson("Unknown or missing API key.", 401);

  const raw = await request.text();
  const adapter = new GenericAdapter({ noshow, tenantId: tenant.tenantId });

  try {
    const intent = await adapter.handle(raw);
    return json({
      intentId: intent.intentId,
      eventId: intent.eventId,
      holdUrl: intent.holdUrl,
      expiresAt: intent.expiresAt,
    });
  } catch (cause) {
    return errorJson(cause instanceof Error ? cause.message : "Could not create a hold.");
  }
}
