import { LumaAdapter } from "@noshow/adapters";
import { deliverWebhook } from "@noshow/core";
import { errorJson, json, noshow, store } from "@/lib/noshow";

export const runtime = "nodejs";

/**
 * Luma webhook ingestion.
 *
 * Register this URL under Settings -> Developer on the calendar, and enable
 * "Guest Registered".
 *
 * Answer fast. Luma allows five seconds, retries three times with backoff, and
 * treats a 410 as "stop sending". So this verifies the signature, writes an
 * intent, and returns — the outbound notification is fired without awaiting it.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string }> },
) {
  const { tenantId } = await params;

  const tenant = await store.getTenant(tenantId);
  if (!tenant?.lumaWebhookSecret) return errorJson("Unknown tenant or no Luma secret configured.", 404);

  // The RAW body, not a re-serialised object: parse-then-stringify can reorder
  // keys and the HMAC would never match.
  const raw = await request.text();

  const adapter = new LumaAdapter({
    noshow,
    tenantId,
    webhookSecret: tenant.lumaWebhookSecret,
  });

  const verified = adapter.verify(raw, request.headers.get("webhook-signature"));
  if (!verified.valid) return errorJson(`Signature rejected: ${verified.reason}`, 401);

  try {
    const result = await adapter.handle(raw);
    // Not a guest registration. 200 rather than an error: Luma retries anything
    // that is not 2xx, and retrying an event we ignore on purpose is noise.
    if (!result) return json({ ignored: true });

    if (tenant.webhookUrl && tenant.webhookSecret) {
      void deliverWebhook({
        url: tenant.webhookUrl,
        secret: tenant.webhookSecret,
        event: "hold.pending",
        data: { intentId: result.intent.intentId, holdUrl: result.intent.holdUrl, guest: result.guest },
      });
    }

    return json({ intentId: result.intent.intentId, holdUrl: result.intent.holdUrl });
  } catch (cause) {
    return errorJson(cause instanceof Error ? cause.message : "Ingestion failed.", 400);
  }
}
