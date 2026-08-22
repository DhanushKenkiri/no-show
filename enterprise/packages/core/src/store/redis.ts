import { getAddress, type Address, type Hex } from "viem";
import type { Hold, Store, Tenant } from "./index.js";

/**
 * Upstash Redis over its REST API.
 *
 * Deliberately implemented with `fetch` and no client dependency: the REST surface
 * is small and stable, and an SDK that drags a Redis client into every consumer's
 * bundle is a worse SDK. Works unchanged on Vercel, Cloudflare Workers and Node.
 *
 * Keys:
 *   hold:{intentId}                 the hold record
 *   payer:{eventId}:{payer}         intentId, so check-in can find a hold by wallet
 *   event:{eventId}                 set of intentIds, for dashboards and finalize
 *   tenant:{tenantId}               the tenant record
 *   apikey:{sha256}                 tenantId
 *
 * Holds carry a TTL so abandoned intents expire instead of accumulating forever.
 */
export class RedisStore implements Store {
  private readonly url: string;
  private readonly token: string;
  private readonly ttlSeconds: number;

  constructor(opts: { url: string; token: string; ttlSeconds?: number }) {
    if (!opts.url || !opts.token) {
      throw new Error(
        "RedisStore needs url and token. On Vercel these arrive as " +
          "KV_REST_API_URL and KV_REST_API_TOKEN.",
      );
    }
    this.url = opts.url.replace(/\/$/, "");
    this.token = opts.token;
    // 30 days: long enough to outlive any event, short enough to self-clean.
    this.ttlSeconds = opts.ttlSeconds ?? 60 * 60 * 24 * 30;
  }

  /**
   * Upstash's REST API takes a command as a JSON array, which avoids having to
   * URL-encode values that may contain slashes or colons.
   */
  private async command<T>(args: (string | number)[]): Promise<T> {
    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(args),
    });

    if (!response.ok) {
      throw new Error(`Redis ${args[0]} failed: ${response.status} ${await response.text()}`);
    }
    const body = (await response.json()) as { result: T; error?: string };
    if (body.error) throw new Error(`Redis ${args[0]} failed: ${body.error}`);
    return body.result;
  }

  private static payerKey(eventId: Hex, payer: Address): string {
    return `payer:${eventId.toLowerCase()}:${getAddress(payer).toLowerCase()}`;
  }

  async getHold(intentId: string): Promise<Hold | null> {
    const raw = await this.command<string | null>(["GET", `hold:${intentId}`]);
    return raw ? (JSON.parse(raw) as Hold) : null;
  }

  async putHold(hold: Hold): Promise<void> {
    await this.command(["SET", `hold:${hold.intentId}`, JSON.stringify(hold), "EX", this.ttlSeconds]);
    await this.command(["SADD", `event:${hold.eventId.toLowerCase()}`, hold.intentId]);

    // The payer index only exists once the attendee has actually signed.
    if (hold.payer) {
      await this.command([
        "SET",
        RedisStore.payerKey(hold.eventId, hold.payer),
        hold.intentId,
        "EX",
        this.ttlSeconds,
      ]);
    }
  }

  async deleteHold(intentId: string): Promise<void> {
    const hold = await this.getHold(intentId);
    await this.command(["DEL", `hold:${intentId}`]);
    if (hold) {
      await this.command(["SREM", `event:${hold.eventId.toLowerCase()}`, intentId]);
      if (hold.payer) await this.command(["DEL", RedisStore.payerKey(hold.eventId, hold.payer)]);
    }
  }

  async findHoldByPayer(eventId: Hex, payer: Address): Promise<Hold | null> {
    const intentId = await this.command<string | null>([
      "GET",
      RedisStore.payerKey(eventId, payer),
    ]);
    return intentId ? this.getHold(intentId) : null;
  }

  async listHolds(eventId: Hex): Promise<Hold[]> {
    const ids = await this.command<string[]>(["SMEMBERS", `event:${eventId.toLowerCase()}`]);
    if (!ids?.length) return [];
    const holds = await Promise.all(ids.map((id) => this.getHold(id)));
    return holds.filter((h): h is Hold => h !== null);
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    const raw = await this.command<string | null>(["GET", `tenant:${tenantId}`]);
    return raw ? (JSON.parse(raw) as Tenant) : null;
  }

  async putTenant(tenant: Tenant): Promise<void> {
    // Tenants have no TTL; they are not ephemeral the way holds are.
    await this.command(["SET", `tenant:${tenant.tenantId}`, JSON.stringify(tenant)]);
    await this.command(["SET", `apikey:${tenant.apiKeyHash}`, tenant.tenantId]);
  }

  async findTenantByApiKeyHash(hash: string): Promise<Tenant | null> {
    const tenantId = await this.command<string | null>(["GET", `apikey:${hash}`]);
    return tenantId ? this.getTenant(tenantId) : null;
  }
}
