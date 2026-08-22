import { verifyWebhook, type HoldIntent, type NoShowClient } from "@noshow/core";
import type { Hex } from "viem";

/**
 * Generic adapter, for platforms with no API of their own.
 *
 * This is the path for something like Unstop, which publishes no developer API at
 * all — only third-party scrapers exist. It is a first-class surface rather than a
 * fallback, because most event systems in the world are in that position: an
 * in-house registration table and no webhook infrastructure.
 *
 * The integration is two lines on their side:
 *
 *   1. On registration, POST to our endpoint with the guest and event ids.
 *   2. Redirect the guest to the returned `holdUrl`, or open it in an iframe.
 *
 * Signing is optional but recommended. When a secret is configured, requests must
 * carry the same `t=,v1=` header @noshow/core uses everywhere else. When it is not,
 * the caller is responsible for authenticating some other way — an API key on the
 * route, or a private network.
 */

export type GenericRegistration = {
  /** The platform's own event identifier. Namespaced per tenant on our side. */
  eventId: string;
  /** The platform's own guest identifier, echoed back on attendance webhooks. */
  guestId?: string;
  email?: string;
  name?: string;
  metadata?: Record<string, string>;
};

export type GenericAdapterConfig = {
  noshow: NoShowClient;
  tenantId: string;
  /** When set, incoming requests must be signed. Strongly recommended. */
  webhookSecret?: string;
};

export class GenericAdapter {
  constructor(private readonly config: GenericAdapterConfig) {}

  /** Verify a signed request. Returns valid when no secret is configured. */
  verify(rawBody: string, signatureHeader: string | null | undefined) {
    if (!this.config.webhookSecret) return { valid: true as const };
    return verifyWebhook(rawBody, signatureHeader, this.config.webhookSecret);
  }

  /**
   * Create a hold intent from a registration payload.
   *
   * Like the Luma path, this touches neither the chain nor the facilitator: the
   * attendee is not present to sign, so there is nothing to wait for.
   */
  async register(input: GenericRegistration): Promise<HoldIntent> {
    if (!input.eventId) throw new Error("eventId is required.");

    const eventId = this.config.noshow.eventIdFor(this.config.tenantId, input.eventId);

    return this.config.noshow.createHoldIntent({
      tenantId: this.config.tenantId,
      eventId,
      externalId: input.guestId,
      metadata: {
        source: "generic",
        externalEventId: input.eventId,
        ...(input.email ? { email: input.email } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...input.metadata,
      },
    });
  }

  /** Parse and handle a raw request body in one step. */
  async handle(rawBody: string): Promise<HoldIntent> {
    let parsed: GenericRegistration;
    try {
      parsed = JSON.parse(rawBody) as GenericRegistration;
    } catch {
      throw new Error("Request body was not JSON.");
    }
    return this.register(parsed);
  }

  eventIdFor(externalEventId: string): Hex {
    return this.config.noshow.eventIdFor(this.config.tenantId, externalEventId);
  }
}
