import { errorJson, json, noshow, tenantFromRequest } from "@/lib/noshow";

export const runtime = "nodejs";

/**
 * Create an event on chain.
 *
 * Idempotent: calling it again for the same external id returns the existing
 * event rather than reverting, because a platform retrying a failed request
 * should not have to care whether the first attempt landed.
 */
export async function POST(request: Request) {
  const tenant = await tenantFromRequest(request);
  if (!tenant) return errorJson("Unknown or missing API key.", 401);

  let body: { eventId?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson("Body must be JSON.");
  }
  if (!body.eventId) return errorJson("eventId is required (your own identifier).");

  const eventId = noshow.eventIdFor(tenant.tenantId, body.eventId);

  try {
    const result = await noshow.createEvent(eventId);
    return json({
      eventId,
      externalEventId: body.eventId,
      alreadyExisted: result.alreadyExisted,
      txHash: result.txHash ?? null,
      displayUrl: `${noshow.baseUrl}/e/${eventId}/display`,
    });
  } catch (cause) {
    return errorJson(cause instanceof Error ? cause.message : "createEvent failed.", 502);
  }
}
