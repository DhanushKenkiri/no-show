import { getAddress } from "viem";
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
export class RedisStore {
    url;
    token;
    ttlSeconds;
    constructor(opts) {
        if (!opts.url || !opts.token) {
            throw new Error("RedisStore needs url and token. On Vercel these arrive as " +
                "KV_REST_API_URL and KV_REST_API_TOKEN.");
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
    async command(args) {
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
        const body = (await response.json());
        if (body.error)
            throw new Error(`Redis ${args[0]} failed: ${body.error}`);
        return body.result;
    }
    static payerKey(eventId, payer) {
        return `payer:${eventId.toLowerCase()}:${getAddress(payer).toLowerCase()}`;
    }
    async getHold(intentId) {
        const raw = await this.command(["GET", `hold:${intentId}`]);
        return raw ? JSON.parse(raw) : null;
    }
    async putHold(hold) {
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
    async deleteHold(intentId) {
        const hold = await this.getHold(intentId);
        await this.command(["DEL", `hold:${intentId}`]);
        if (hold) {
            await this.command(["SREM", `event:${hold.eventId.toLowerCase()}`, intentId]);
            if (hold.payer)
                await this.command(["DEL", RedisStore.payerKey(hold.eventId, hold.payer)]);
        }
    }
    async findHoldByPayer(eventId, payer) {
        const intentId = await this.command([
            "GET",
            RedisStore.payerKey(eventId, payer),
        ]);
        return intentId ? this.getHold(intentId) : null;
    }
    async listHolds(eventId) {
        const ids = await this.command(["SMEMBERS", `event:${eventId.toLowerCase()}`]);
        if (!ids?.length)
            return [];
        const holds = await Promise.all(ids.map((id) => this.getHold(id)));
        return holds.filter((h) => h !== null);
    }
    async getTenant(tenantId) {
        const raw = await this.command(["GET", `tenant:${tenantId}`]);
        return raw ? JSON.parse(raw) : null;
    }
    async putTenant(tenant) {
        // Tenants have no TTL; they are not ephemeral the way holds are.
        await this.command(["SET", `tenant:${tenant.tenantId}`, JSON.stringify(tenant)]);
        await this.command(["SET", `apikey:${tenant.apiKeyHash}`, tenant.tenantId]);
    }
    async findTenantByApiKeyHash(hash) {
        const tenantId = await this.command(["GET", `apikey:${hash}`]);
        return tenantId ? this.getTenant(tenantId) : null;
    }
}
