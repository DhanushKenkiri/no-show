import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { MemoryStore, NoShowClient, signWebhook } from "@noshow/core";
import { GenericAdapter, LumaAdapter } from "../dist/index.js";

const REGISTRY = "0x1d3eDAfc7d029f51eb208E1d28FD2ce3a17b8112";
const SECRET = "whsec_test";

function client() {
  return new NoShowClient({
    registry: REGISTRY,
    store: new MemoryStore(),
    baseUrl: "https://noshow.example",
  });
}

test("Luma signature verification matches a hand-computed HMAC", () => {
  // Computed independently of the implementation, so this catches a change in the
  // signing scheme rather than just agreeing with itself.
  const body = JSON.stringify({ type: "guest.registered", data: {} });
  const timestamp = Math.floor(Date.now() / 1000);
  const expected = createHmac("sha256", SECRET).update(`${timestamp}.${body}`).digest("hex");

  const adapter = new LumaAdapter({ noshow: client(), tenantId: "t", webhookSecret: SECRET });
  assert.equal(adapter.verify(body, `t=${timestamp},v1=${expected}`).valid, true);
});

test("Luma verification rejects a tampered body and a wrong secret", () => {
  const adapter = new LumaAdapter({ noshow: client(), tenantId: "t", webhookSecret: SECRET });
  const body = JSON.stringify({ type: "guest.registered", data: { a: 1 } });
  const header = signWebhook(body, SECRET);

  assert.equal(adapter.verify(JSON.stringify({ type: "guest.registered", data: { a: 2 } }), header).valid, false);
  assert.equal(adapter.verify(body, signWebhook(body, "other")).valid, false);
  assert.equal(adapter.verify(body, null).valid, false);
});

test("Luma ingestion creates a hold intent for guest.registered", async () => {
  const noshow = client();
  const adapter = new LumaAdapter({ noshow, tenantId: "acme", webhookSecret: SECRET });

  const body = JSON.stringify({
    type: "guest.registered",
    data: { guest: { api_id: "gst-1", email: "a@b.co", event_api_id: "evt-1" } },
  });

  const result = await adapter.handle(body);
  assert.ok(result, "no intent created");
  assert.match(result.intent.holdUrl, /^https:\/\/noshow\.example\/hold\//);
  assert.equal(result.intent.eventId, noshow.eventIdFor("acme", "evt-1"));

  const stored = await noshow.store.getHold(result.intent.intentId);
  assert.equal(stored?.state, "PENDING");
  assert.equal(stored?.externalId, "gst-1");
  assert.equal(stored?.metadata?.email, "a@b.co");
});

test("Luma ingestion ignores event types we do not act on", async () => {
  const adapter = new LumaAdapter({ noshow: client(), tenantId: "t", webhookSecret: SECRET });
  // Returning null rather than throwing matters: Luma retries anything that is
  // not 2xx, and retrying an event we deliberately ignore is pure noise.
  assert.equal(await adapter.handle(JSON.stringify({ type: "event.updated", data: {} })), null);
});

test("Luma accepts the spaced event name Luma shows in its UI", async () => {
  const adapter = new LumaAdapter({ noshow: client(), tenantId: "t", webhookSecret: SECRET });
  const body = JSON.stringify({
    type: "Guest Registered",
    data: { guest: { api_id: "g", event_api_id: "e" } },
  });
  assert.ok(await adapter.handle(body), "spaced form was not recognised");
});

test("the generic adapter registers without any platform API", async () => {
  const noshow = client();
  const adapter = new GenericAdapter({ noshow, tenantId: "unstop", webhookSecret: SECRET });

  const intent = await adapter.register({ eventId: "hack-42", guestId: "u-9", name: "Dev" });
  assert.equal(intent.eventId, noshow.eventIdFor("unstop", "hack-42"));

  const stored = await noshow.store.getHold(intent.intentId);
  assert.equal(stored?.externalId, "u-9");
  assert.equal(stored?.metadata?.source, "generic");
});

test("two tenants using the same external event id stay separate", async () => {
  const noshow = client();
  const a = new GenericAdapter({ noshow, tenantId: "tenant-a" });
  const b = new GenericAdapter({ noshow, tenantId: "tenant-b" });

  const ia = await a.register({ eventId: "shared-id" });
  const ib = await b.register({ eventId: "shared-id" });
  assert.notEqual(ia.eventId, ib.eventId, "tenants collided on one external id");
});
