import { MemoryStore, NoShowClient, RedisStore, type Store } from "@noshow/core";
import { privateKeyToAccount } from "viem/accounts";
import type { Address, Hex } from "viem";

/**
 * The service's single NoShowClient.
 *
 * Built once at module scope so the x402 server's `initialize()` — which fetches
 * the facilitator's /supported to learn the address that must be bound into every
 * Permit2 witness — happens once per instance, not once per request.
 */

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set.`);
  return value;
}

/**
 * Redis when configured, memory otherwise.
 *
 * The fallback is not a convenience, it is a trap with a warning on it: on
 * serverless, an in-memory store loses every hold at each cold start, so a
 * check-in is real on chain while the settlement silently never runs. Fine for
 * local development; never for a deployment.
 */
function buildStore(): Store {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (url && token) return new RedisStore({ url, token });

  if (process.env.NODE_ENV === "production") {
    console.warn(
      "[noshow] KV_REST_API_URL / KV_REST_API_TOKEN are not set, so holds are " +
        "in memory. On serverless they will not survive a cold start and " +
        "settlements will be skipped. Configure a KV store.",
    );
  }
  return new MemoryStore();
}

export const store = buildStore();

export const REGISTRY = (process.env.NEXT_PUBLIC_REGISTRY_ADDRESS ??
  "0x1d3eDAfc7d029f51eb208E1d28FD2ce3a17b8112") as Address;

export const BASE_URL =
  process.env.NEXT_PUBLIC_BASE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

/**
 * The organiser signer.
 *
 * Only ever used for createEvent, finalize and payout. Attendees sign their own
 * register and checkIn from their wallet, so this key can never move an attendee's
 * funds — the worst it can do is mismanage events it created.
 */
function organiserAccount() {
  const key = process.env.ORGANISER_PRIVATE_KEY;
  if (!key) return undefined;
  return privateKeyToAccount(key.startsWith("0x") ? (key as Hex) : (`0x${key}` as Hex));
}

export const noshow = new NoShowClient({
  registry: REGISTRY,
  store,
  organiser: organiserAccount(),
  baseUrl: BASE_URL,
  holdAmount: Number(process.env.HOLD_AMOUNT ?? "0.5"),
});

/** Hash an API key for lookup. The key itself is never stored. */
export async function hashApiKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Resolve `Authorization: Bearer <key>` to a tenant.
 *
 * Returns null rather than throwing so routes can answer 401 in one shape.
 */
export async function tenantFromRequest(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return store.findTenantByApiKeyHash(await hashApiKey(header.slice(7).trim()));
}

export function json(body: unknown, init?: ResponseInit) {
  return Response.json(body, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function errorJson(message: string, status = 400) {
  return json({ error: message }, { status });
}
