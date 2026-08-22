import { errorJson, hashApiKey, json, store } from "@/lib/noshow";

export const runtime = "nodejs";

/**
 * Provision a tenant.
 *
 * Gated by ADMIN_SECRET rather than an API key, because this is the endpoint that
 * mints API keys. The key is returned exactly once and only its SHA-256 is stored,
 * so losing it means rotating rather than looking it up.
 */
export async function POST(request: Request) {
  const secret = process.env.ADMIN_SECRET;
  if (!secret) return errorJson("ADMIN_SECRET is not configured on this deployment.", 503);
  if (request.headers.get("x-admin-secret") !== secret) return errorJson("Forbidden.", 403);

  let body: { tenantId?: string; name?: string; webhookUrl?: string; lumaWebhookSecret?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson("Body must be JSON.");
  }
  if (!body.tenantId) return errorJson("tenantId is required.");

  const apiKey = `nsk_${crypto.randomUUID().replace(/-/g, "")}`;
  const webhookSecret = `whsec_${crypto.randomUUID().replace(/-/g, "")}`;

  await store.putTenant({
    tenantId: body.tenantId,
    name: body.name ?? body.tenantId,
    apiKeyHash: await hashApiKey(apiKey),
    webhookUrl: body.webhookUrl,
    webhookSecret,
    lumaWebhookSecret: body.lumaWebhookSecret,
    createdAt: new Date().toISOString(),
  });

  return json({
    tenantId: body.tenantId,
    apiKey,
    webhookSecret,
    note: "Store both now. Only a hash of the API key is kept, so it cannot be shown again.",
  });
}
