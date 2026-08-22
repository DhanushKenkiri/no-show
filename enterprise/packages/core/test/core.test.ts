import assert from "node:assert/strict";
import { test } from "node:test";
import {
  MemoryStore,
  blocksLeftInWindow,
  challengeAtBlock,
  deriveEventId,
  signWebhook,
  toBaseUnits,
  venueChallenge,
  verifyWebhook,
  windowOf,
  type Hold,
} from "../dist/index.js";

const EVENT = deriveEventId("tenant-a", "event-1");

test("event ids are namespaced per tenant", () => {
  const a = deriveEventId("tenant-a", "same-external-id");
  const b = deriveEventId("tenant-b", "same-external-id");
  assert.notEqual(a, b, "two tenants collided on one external id");
  assert.equal(a, deriveEventId("tenant-a", "same-external-id"), "not deterministic");
});

test("challenge is stable within a window and rotates across one", () => {
  // A window is three blocks, so 300, 301 and 302 share a code.
  assert.equal(challengeAtBlock(EVENT, 300n), challengeAtBlock(EVENT, 301n));
  assert.equal(challengeAtBlock(EVENT, 301n), challengeAtBlock(EVENT, 302n));
  assert.notEqual(challengeAtBlock(EVENT, 302n), challengeAtBlock(EVENT, 303n));
});

test("a challenge from four blocks ago is always stale", () => {
  // Four exceeds the window width, so it can never still be current.
  for (let base = 300n; base < 320n; base++) {
    assert.notEqual(
      challengeAtBlock(EVENT, base),
      challengeAtBlock(EVENT, base + 4n),
      `block ${base} still matched four blocks later`,
    );
  }
});

test("one event's challenge never matches another's", () => {
  const other = deriveEventId("tenant-b", "event-1");
  assert.notEqual(challengeAtBlock(EVENT, 300n), challengeAtBlock(other, 300n));
});

test("blocksLeftInWindow counts down 3, 2, 1", () => {
  assert.equal(blocksLeftInWindow(300n), 3);
  assert.equal(blocksLeftInWindow(301n), 2);
  assert.equal(blocksLeftInWindow(302n), 1);
  assert.equal(blocksLeftInWindow(303n), 3);
});

test("the venue display leads by exactly one window", () => {
  // The whole point of the lead: a scan now becomes a transaction that mines
  // about three blocks later, which must be the window being displayed.
  const shown = venueChallenge(EVENT, 300n);
  assert.equal(shown, challengeAtBlock(EVENT, 303n), "lead did not land on the next window");
  assert.notEqual(shown, challengeAtBlock(EVENT, 300n), "display showed the live window");
  assert.equal(windowOf(303n), windowOf(300n) + 1n);
});

test("toBaseUnits does not lose precision at 18 decimals", () => {
  // 0.5 * 10**18 via floating point is where a naive implementation drifts.
  assert.equal(toBaseUnits(0.5, 18), 500_000_000_000_000_000n);
  assert.equal(toBaseUnits(2, 6), 2_000_000n);
  assert.equal(toBaseUnits(0.1, 18), 100_000_000_000_000_000n);
  assert.equal(toBaseUnits(1.5, 18), 1_500_000_000_000_000_000n);
});

test("webhook signatures round-trip", () => {
  const body = JSON.stringify({ type: "attendance.confirmed", data: { who: "0xabc" } });
  const header = signWebhook(body, "shh");
  assert.deepEqual(verifyWebhook(body, header, "shh"), { valid: true });
});

test("webhook verification rejects a tampered body", () => {
  const body = JSON.stringify({ amount: 1 });
  const header = signWebhook(body, "shh");
  const result = verifyWebhook(JSON.stringify({ amount: 1000 }), header, "shh");
  assert.equal(result.valid, false);
});

test("webhook verification rejects the wrong secret and a stale timestamp", () => {
  const body = "{}";
  assert.equal(verifyWebhook(body, signWebhook(body, "right"), "wrong").valid, false);

  const old = Math.floor(Date.now() / 1000) - 3600;
  assert.equal(verifyWebhook(body, signWebhook(body, "shh", old), "shh").valid, false);

  assert.equal(verifyWebhook(body, null, "shh").valid, false);
  assert.equal(verifyWebhook(body, "garbage", "shh").valid, false);
});

test("MemoryStore indexes holds by payer and by event", async () => {
  const store = new MemoryStore();
  const hold: Hold = {
    intentId: "i-1",
    tenantId: "t",
    eventId: EVENT,
    payer: "0xA02f986810602163f078e38488C6FE6756De606e",
    state: "AUTHORIZED",
    createdAt: new Date().toISOString(),
    expiresAt: new Date().toISOString(),
  };
  await store.putHold(hold);

  assert.equal((await store.getHold("i-1"))?.intentId, "i-1");
  // Lookup must be case-insensitive on the address, since callers pass whatever
  // casing their wallet gave them.
  const found = await store.findHoldByPayer(EVENT, "0xa02f986810602163f078e38488c6fe6756de606e");
  assert.equal(found?.intentId, "i-1");
  assert.equal((await store.listHolds(EVENT)).length, 1);

  await store.deleteHold("i-1");
  assert.equal(await store.getHold("i-1"), null);
});

test("MemoryStore keeps events separate", async () => {
  const store = new MemoryStore();
  const other = deriveEventId("tenant-b", "event-1");
  const base = { tenantId: "t", state: "PENDING" as const, createdAt: "", expiresAt: "" };

  await store.putHold({ ...base, intentId: "a", eventId: EVENT });
  await store.putHold({ ...base, intentId: "b", eventId: other });

  assert.equal((await store.listHolds(EVENT)).length, 1);
  assert.equal((await store.listHolds(other)).length, 1);
});
