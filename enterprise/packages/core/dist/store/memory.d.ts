import { type Address, type Hex } from "viem";
import type { Hold, Store, Tenant } from "./index.js";
/**
 * In-process store.
 *
 * Correct for tests and for a single long-lived server. NOT correct on serverless:
 * each cold start gets an empty Map, so a hold created by one invocation is
 * invisible to the next. Use RedisStore there. This is exported rather than hidden
 * so tests need no infrastructure.
 */
export declare class MemoryStore implements Store {
    private holds;
    private tenants;
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
