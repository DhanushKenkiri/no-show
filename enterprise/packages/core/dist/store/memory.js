import { getAddress } from "viem";
/**
 * In-process store.
 *
 * Correct for tests and for a single long-lived server. NOT correct on serverless:
 * each cold start gets an empty Map, so a hold created by one invocation is
 * invisible to the next. Use RedisStore there. This is exported rather than hidden
 * so tests need no infrastructure.
 */
export class MemoryStore {
    holds = new Map();
    tenants = new Map();
    static payerKey(eventId, payer) {
        return `${eventId.toLowerCase()}:${payer.toLowerCase()}`;
    }
    async getHold(intentId) {
        return this.holds.get(intentId) ?? null;
    }
    async putHold(hold) {
        this.holds.set(hold.intentId, hold);
    }
    async deleteHold(intentId) {
        this.holds.delete(intentId);
    }
    async findHoldByPayer(eventId, payer) {
        const wanted = MemoryStore.payerKey(eventId, getAddress(payer));
        for (const hold of this.holds.values()) {
            if (!hold.payer)
                continue;
            if (MemoryStore.payerKey(hold.eventId, getAddress(hold.payer)) === wanted) {
                return hold;
            }
        }
        return null;
    }
    async listHolds(eventId) {
        const target = eventId.toLowerCase();
        return [...this.holds.values()].filter((h) => h.eventId.toLowerCase() === target);
    }
    async getTenant(tenantId) {
        return this.tenants.get(tenantId) ?? null;
    }
    async putTenant(tenant) {
        this.tenants.set(tenant.tenantId, tenant);
    }
    async findTenantByApiKeyHash(hash) {
        for (const tenant of this.tenants.values()) {
            if (tenant.apiKeyHash === hash)
                return tenant;
        }
        return null;
    }
}
