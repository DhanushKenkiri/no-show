import { type Address, type Hex } from "viem";
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
export declare class RedisStore implements Store {
    private readonly url;
    private readonly token;
    private readonly ttlSeconds;
    constructor(opts: {
        url: string;
        token: string;
        ttlSeconds?: number;
    });
    /**
     * Upstash's REST API takes a command as a JSON array, which avoids having to
     * URL-encode values that may contain slashes or colons.
     */
    private command;
    private static payerKey;
    getHold(intentId: string): Promise<Hold | null>;
    putHold(hold: Hold): Promise<void>;
    deleteHold(intentId: string): Promise<void>;
    findHoldByPayer(eventId: Hex, payer: Address): Promise<Hold | null>;
    listHolds(eventId: Hex): Promise<Hold[]>;
    getTenant(tenantId: string): Promise<Tenant | null>;
    putTenant(tenant: Tenant): Promise<void>;
    findTenantByApiKeyHash(hash: string): Promise<Tenant | null>;
}
