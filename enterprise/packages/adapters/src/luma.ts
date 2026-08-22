import { verifyWebhook, type NoShowClient, type HoldIntent } from "@noshow/core";
import type { Hex } from "viem";

/**
 * Luma adapter.
 *
 * Built against Luma's live OpenAPI spec and webhook documentation, not guesswork.
 * Three of their constraints shape everything here:
 *
 * 1. THERE IS NO CHECK-IN ENDPOINT. Their API exposes guests/list, guests/add,
 *    guests/update-status and guests/update-tickets; nothing records attendance.
 *    Check-in on Luma is a *host role* for a human with a laptop. So attendance is
 *    never written back — our contract is the system of record, and Luma keeps
 *    owning the guest list. We fill a hole rather than competing.
 *
 * 2. A WEBHOOK MUST ANSWER IN FIVE SECONDS, with 3 retries on failure and a 410
 *    permanently pausing the endpoint. So ingestion writes a hold intent and
 *    returns. It never awaits the chain or the facilitator.
 *
 * 3. AUTH IS AN API KEY PER CALENDAR (`x-luma-api-key`), with no OAuth. Multi-tenant
 *    means storing a customer's key, so treat it like a password.
 */

export const LUMA_API_BASE = "https://public-api.luma.com";

/** Webhook event types Luma sends. */
export type LumaEventType =
  | "guest.registered"
  | "guest.updated"
  | "ticket.registered"
  | "event.created"
  | "event.updated"
  | "event.canceled";

export type LumaWebhookBody = {
  type: string;
  data?: Record<string, unknown>;
};

export type LumaGuest = {
  api_id?: string;
  email?: string;
  name?: string;
  approval_status?: string;
  event_api_id?: string;
  /** Answers to the event's registration questions. */
  registration_answers?: { label?: string; answer?: string }[];
};

export type LumaAdapterConfig = {
  noshow: NoShowClient;
  tenantId: string;
  /** Secret from Luma's Settings → Developer page, used to verify their signature. */
  webhookSecret: string;
  /** Calendar-scoped API key, only needed for syncGuests. */
  apiKey?: string;
};

export class LumaAdapter {
  constructor(private readonly config: LumaAdapterConfig) {}

  /**
   * Verify a Luma webhook.
   *
   * Their scheme: `Webhook-Signature: t=<unix>,v1=<hmac>`, HMAC-SHA256 over
   * `{timestamp}.{raw_body}`, constant-time compare. It is byte-identical to the
   * one @noshow/core uses for its own outbound webhooks, so this is a thin call.
   *
   * Pass the RAW request body. Parsing and re-serialising can reorder keys and the
   * signature will never match.
   */
  verify(rawBody: string, signatureHeader: string | null | undefined) {
    return verifyWebhook(rawBody, signatureHeader, this.config.webhookSecret);
  }

  /**
   * Turn a verified webhook into a hold intent.
   *
   * Returns null for event types we do not act on, so a caller can respond 2xx
   * without branching — Luma retries anything that is not 2xx, and there is no
   * point retrying an event we deliberately ignore.
   */
  async handle(rawBody: string): Promise<{ intent: HoldIntent; guest: LumaGuest } | null> {
    let body: LumaWebhookBody;
    try {
      body = JSON.parse(rawBody) as LumaWebhookBody;
    } catch {
      throw new Error("Webhook body was not JSON.");
    }

    // Luma writes these as "Guest Registered" in the UI and dotted names on the
    // wire; accept both rather than guessing which one arrives.
    const type = String(body.type ?? "").toLowerCase().replace(/\s+/g, ".");
    if (type !== "guest.registered" && type !== "ticket.registered") return null;

    const guest = (body.data?.guest ?? body.data ?? {}) as LumaGuest;
    const externalEventId = String(
      guest.event_api_id ?? (body.data?.event as Record<string, unknown>)?.api_id ?? "",
    );
    if (!externalEventId) throw new Error("Webhook carried no event id.");

    const eventId = this.config.noshow.eventIdFor(this.config.tenantId, externalEventId);

    // No chain call, no facilitator call. Five seconds is not much.
    const intent = await this.config.noshow.createHoldIntent({
      tenantId: this.config.tenantId,
      eventId,
      externalId: guest.api_id,
      metadata: {
        source: "luma",
        lumaEventId: externalEventId,
        ...(guest.email ? { email: guest.email } : {}),
        ...(guest.name ? { name: guest.name } : {}),
      },
    });

    return { intent, guest };
  }

  /**
   * Pull the current guest list.
   *
   * Useful for reconciliation, since a webhook can always be missed. Luma's rate
   * limit is 200 requests per minute per calendar, so this paginates rather than
   * hammering.
   */
  async syncGuests(externalEventId: string): Promise<LumaGuest[]> {
    if (!this.config.apiKey) {
      throw new Error("syncGuests needs a calendar-scoped Luma API key.");
    }

    const guests: LumaGuest[] = [];
    let cursor: string | undefined;

    do {
      const url = new URL("/v1/events/guests/list", LUMA_API_BASE);
      url.searchParams.set("event_api_id", externalEventId);
      if (cursor) url.searchParams.set("pagination_cursor", cursor);

      const response = await fetch(url, {
        headers: { "x-luma-api-key": this.config.apiKey, accept: "application/json" },
      });
      if (!response.ok) {
        throw new Error(`Luma guests/list failed: ${response.status} ${await response.text()}`);
      }

      const page = (await response.json()) as {
        entries?: { guest?: LumaGuest }[];
        has_more?: boolean;
        next_cursor?: string;
      };

      for (const entry of page.entries ?? []) {
        if (entry.guest) guests.push(entry.guest);
      }
      cursor = page.has_more ? page.next_cursor : undefined;
    } while (cursor);

    return guests;
  }

  /**
   * Derive the on-chain event id for a Luma event.
   *
   * Exposed because the venue display and the dashboard both need it, and callers
   * should never construct it by hand.
   */
  eventIdFor(externalEventId: string): Hex {
    return this.config.noshow.eventIdFor(this.config.tenantId, externalEventId);
  }
}
