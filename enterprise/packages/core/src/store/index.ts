import type { Address, Hex } from "viem";

/**
 * Where holds live between registration and check-in.
 *
 * This is an interface rather than a concrete store because the demo taught the
 * lesson the hard way: a module-level Map does not survive a serverless cold
 * start, so a hold created by one invocation is invisible to the next, and the
 * check-in is real on chain while the settlement silently never happens.
 *
 * Implementations: `MemoryStore` for tests and single-process deployments,
 * `RedisStore` for anything serverless.
 */

export type HoldState =
  /** Intent created, attendee has not signed yet. */
  | "PENDING"
  /** Authorisation signed and verified by the facilitator. */
  | "AUTHORIZED"
  /** Settlement in flight. */
  | "RELEASING"
  /** Settled for zero — the attendee showed up. */
  | "RELEASED"
  /** Settlement outcome unknown after a timeout. Never silently retried. */
  | "UNKNOWN"
  /** Charged at the full amount — the attendee did not show. */
  | "CHARGED";

export type Hold = {
  intentId: string;
  tenantId: string;
  eventId: Hex;
  /** The platform's own id for this guest, so results can be mapped back. */
  externalId?: string;
  payer?: Address;
  authRef?: Hex;
  /** Opaque x402 payload, stored verbatim so settlement can replay it. */
  paymentPayload?: unknown;
  paymentRequirements?: unknown;
  settlement?: unknown;
  state: HoldState;
  createdAt: string;
  expiresAt: string;
  metadata?: Record<string, string>;
};

export interface Store {
  getHold(intentId: string): Promise<Hold | null>;
  putHold(hold: Hold): Promise<void>;
  deleteHold(intentId: string): Promise<void>;

  /**
   * Find the hold for one wallet at one event.
   *
   * Check-in arrives knowing the payer and the event but not the intent id, so
   * this index is not optional.
   */
  findHoldByPayer(eventId: Hex, payer: Address): Promise<Hold | null>;

  /** Every hold for an event, for dashboards and finalize. */
  listHolds(eventId: Hex): Promise<Hold[]>;

  getTenant(tenantId: string): Promise<Tenant | null>;
  putTenant(tenant: Tenant): Promise<void>;
  /** Resolve an API key to its tenant. Keys are stored hashed, never in the clear. */
  findTenantByApiKeyHash(hash: string): Promise<Tenant | null>;
}

export type Tenant = {
  tenantId: string;
  name: string;
  /** SHA-256 of the API key. The key itself is shown once at creation and never stored. */
  apiKeyHash: string;
  /** Where to POST attendance events. */
  webhookUrl?: string;
  /** Secret used to sign our outbound webhooks to this tenant. */
  webhookSecret?: string;
  /** Secret Luma signs ITS webhooks to us with, if this tenant uses Luma. */
  lumaWebhookSecret?: string;
  createdAt: string;
};

export { MemoryStore } from "./memory.js";
export { RedisStore } from "./redis.js";
