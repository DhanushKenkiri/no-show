import { getAddress, type Address, type Hex } from "viem";
import type { Hold, Store, Tenant } from "./index.js";

/**
 * In-process store.
 *
 * Correct for tests and for a single long-lived server. NOT correct on serverless:
 * each cold start gets an empty Map, so a hold created by one invocation is
 * invisible to the next. Use RedisStore there. This is exported rather than hidden
 * so tests need no infrastructure.
 */
export class MemoryStore implements Store {
  private holds = new Map<string, Hold>();
  private tenants = new Map<string, Tenant>();

  private static payerKey(eventId: Hex, payer: Address): string {
    return `${eventId.toLowerCase()}:${payer.toLowerCase()}`;
  }

  async getHold(intentId: string): Promise<Hold | null> {
    return this.holds.get(intentId) ?? null;
  }

  async putHold(hold: Hold): Promise<void> {
    this.holds.set(hold.intentId, hold);
  }

  async deleteHold(intentId: string): Promise<void> {
    this.holds.delete(intentId);
  }

  async findHoldByPayer(eventId: Hex, payer: Address): Promise<Hold | null> {
    const wanted = MemoryStore.payerKey(eventId, getAddress(payer));
    for (const hold of this.holds.values()) {
      if (!hold.payer) continue;
      if (MemoryStore.payerKey(hold.eventId, getAddress(hold.payer)) === wanted) {
        return hold;
      }
    }
    return null;
  }

  async listHolds(eventId: Hex): Promise<Hold[]> {
    const target = eventId.toLowerCase();
    return [...this.holds.values()].filter((h) => h.eventId.toLowerCase() === target);
  }

  async getTenant(tenantId: string): Promise<Tenant | null> {
    return this.tenants.get(tenantId) ?? null;
  }

  async putTenant(tenant: Tenant): Promise<void> {
    this.tenants.set(tenant.tenantId, tenant);
  }

  async findTenantByApiKeyHash(hash: string): Promise<Tenant | null> {
    for (const tenant of this.tenants.values()) {
      if (tenant.apiKeyHash === hash) return tenant;
    }
    return null;
  }
}
