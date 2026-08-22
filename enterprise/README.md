# No-Show — enterprise

The product: an SDK and hosted service so an events platform can offer deposit-free
RSVP with on-chain proof of attendance, **without its engineers learning Monad,
x402, Permit2 or wallets.**

> Want to see the idea working first? That's [`../demo/`](../demo/README.md).

| | |
|---|---|
| Registry contract | [`0x1d3eDAfc7d029f51eb208E1d28FD2ce3a17b8112`](https://testnet.monadvision.com/address/0x1d3eDAfc7d029f51eb208E1d28FD2ce3a17b8112) |
| Network | Monad Testnet (`10143`) |
| Verification | Sourcify `exact_match` |
| Status | Packages complete and tested. Hosted service built, deployment pending. |

---

## Three ways to integrate

Pick the one that matches what you already have.

### 1. In code — `@noshow/core`

Framework-agnostic. No React, no Next, no bundler assumptions. Any Node service can
use it.

```bash
npm i @noshow/core
```

```ts
import { NoShowClient, RedisStore } from "@noshow/core";
import { privateKeyToAccount } from "viem/accounts";

const noshow = new NoShowClient({
  registry: "0x1d3eDAfc7d029f51eb208E1d28FD2ce3a17b8112",
  store: new RedisStore({ url: KV_URL, token: KV_TOKEN }),
  organiser: privateKeyToAccount(process.env.ORGANISER_KEY),
  baseUrl: "https://your-app.example",
});

// once per event
const eventId = noshow.eventIdFor("your-tenant", "summer-summit");
await noshow.createEvent(eventId);

// on each registration
const intent = await noshow.createHoldIntent({ tenantId: "your-tenant", eventId });
// → send the guest to intent.holdUrl

// when someone scans at the door
await noshow.verifyCheckIn({ eventId, challenge, txHash });
```

### 2. Over HTTP — for platforms with no API of their own

Two calls and a redirect. This is the path for something like Unstop, which
publishes no developer API at all.

```bash
# on registration
curl -X POST https://your-service/api/v1/holds \
  -H "authorization: Bearer $API_KEY" \
  -d '{"eventId":"summer-summit","guestId":"g-1"}'

# → { "holdUrl": "https://your-service/hold/..." }
```

Send the guest to `holdUrl`, or open it in an iframe. Wallet, wrapping, Permit2 and
signing all happen there.

### 3. In your own frontend — `@noshow/react`

```bash
npm i @noshow/react
```

```tsx
import { RegistrationCard, Scanner, useHold } from "@noshow/react";
import "@noshow/react/styles.css";

const { status, register, checkIn, progress, error } = useHold({
  registry, eventId, intentId,
});
```

Every value is a CSS custom property, so you restyle by overriding tokens rather
than forking components:

```css
:root { --ns-accent: #ff5722; --ns-r-md: 4px; }
```

Or ignore the components entirely and use `useHold` headlessly with your own markup.

---

## Layout

```
enterprise/
├── packages/
│   ├── core/          @noshow/core      the engine — client, store, x402, gas
│   ├── adapters/      @noshow/adapters  Luma + generic REST
│   └── react/         @noshow/react     card, scanner, venue display, commit pill
├── service/           hosted multi-tenant API and hold page
└── contracts/         NoShowRegistry.sol — many events, many organisers
```

```bash
npm install          # workspaces; packages build on install
npm test             # core + adapter suites
```

---

## How it fits together

The one constraint that shapes everything: **a hold needs the attendee's
signature**, so it can never be created inside a webhook. The attendee isn't there,
and Luma gives you five seconds to respond anyway.

```
  platform registration
          │
          ▼
   webhook or REST call
          │
          ▼
   createHoldIntent()  ──►  { holdUrl }        ← no chain, no facilitator, instant
          │
          ▼
   attendee opens holdUrl
     connect · wrap · approve Permit2 once · sign the hold · register() on chain
          │
          ▼
     venue display shows a code, rotating every ~1.2s
          │
          ▼
     attendee scans → checkIn() → settles for ZERO
          │
          ▼
   attendance.confirmed webhook back to the platform
```

---

## Adapters

Adapters are thin on purpose — they map a payload onto `createHoldIntent`, so
writing one for whatever system you run is a short file, not a project.

### Luma

Built against their live OpenAPI spec, not guesswork. Point a webhook at
`/api/webhooks/luma/{tenantId}` with **Guest Registered** enabled.

```ts
const adapter = new LumaAdapter({ noshow, tenantId, webhookSecret });
if (!adapter.verify(rawBody, req.headers["webhook-signature"]).valid) return 401;
const result = await adapter.handle(rawBody);
```

Three of their constraints shaped this:

- **There is no check-in endpoint.** `guests/list`, `guests/add`,
  `guests/update-status` and `guests/update-tickets` exist; nothing records
  attendance. Check-in on Luma is a *host role* for a human with a laptop. So
  nothing is written back and our contract is the record — we fill a hole rather
  than compete.
- **Five seconds, three retries, and a 410 pauses the endpoint.** Ingestion writes
  an intent and returns without touching chain or facilitator.
- **API key per calendar, no OAuth.** Multi-tenant means storing a customer's key,
  so treat it like a password.

Pass the **raw** body. Parsing and re-serialising can reorder keys, and the HMAC
will never match.

### Generic

```ts
const adapter = new GenericAdapter({ noshow, tenantId, webhookSecret });
const intent = await adapter.register({ eventId: "hack-42", guestId: "u-9" });
```

---

## Service API

| Method | Path | Auth |
|---|---|---|
| `POST` | `/api/v1/tenants` | `x-admin-secret` |
| `POST` | `/api/v1/events` | `Bearer <api key>` |
| `POST` | `/api/v1/holds` | `Bearer <api key>` |
| `POST` | `/api/v1/holds/{intentId}/authorize` | none — x402 handshake |
| `POST` | `/api/v1/checkin` | none — the tx hash is the credential |
| `POST` | `/api/webhooks/luma/{tenantId}` | Luma signature |
| `GET` | `/hold/{intentId}` | the hosted hold page |
| `GET` | `/e/{eventId}/display` | the venue display |

Check-in needs no API key because the transaction hash *is* the credential: it is
verified against the registry, must emit `CheckedIn` for its own sender, and must
carry a challenge that was current in the block it mined in.

### Environment

| Variable | Required | Why |
|---|---|---|
| `NEXT_PUBLIC_REGISTRY_ADDRESS` | yes | deployed `NoShowRegistry` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | yes in production | holds must survive cold starts |
| `ORGANISER_PRIVATE_KEY` | yes | signs `createEvent`, `finalize`, `payout` |
| `ADMIN_SECRET` | yes | gates tenant provisioning |
| `NEXT_PUBLIC_BASE_URL` | no | defaults to the Vercel URL |
| `HOLD_AMOUNT` | no | defaults to `0.5` |

Without a KV store the service falls back to memory and warns loudly. That is not a
convenience — on serverless every cold start loses the holds, so check-ins are real
on chain while settlements silently never run.

---

## Contract

`NoShowRegistry` is one deployment serving every platform. Each event carries its
own organiser, set by whoever created it, so a customer can only finalize their own
events.

```solidity
createEvent(bytes32 eventId, uint40 holdAmount)   // msg.sender becomes organiser
register(bytes32 eventId, bytes32 authRef)
checkIn(bytes32 eventId, bytes32 challenge)
finalize(bytes32 eventId, address[] noShows)      // organiser only
payout(bytes32 eventId, address[] recipients, uint40 amountEach)
screen(bytes32 eventId, address who)
eventScreen(bytes32 eventId)
```

Two things changed from the demo's single-event contract beyond multi-tenancy:

- **`register` reads the hold amount from the event, not the caller.** The
  single-event version accepted a caller-supplied figure, which let an attendee
  record whatever hold they liked — including zero — while the real authorisation
  said something else.
- **Counts live in their own mappings**, not packed into `EventInfo`. Packing them
  beside `organiser` would make every registration rewrite the slot holding the
  organiser address, serialising registrations across unrelated tenants on one
  storage location.

Both structs pack into a single slot each — `Attendee` 18 of 32 bytes, `EventInfo`
26 of 32 — proven with `forge inspect`, not counted by hand.

```bash
cd contracts && forge test    # 16 tests
```

Event ids are namespaced: `keccak256(tenantId, externalEventId)`. Anyone may create
an event under any id, so ids are derived rather than chosen and a collision means
finding a hash collision.

---

## Testing

```bash
npm test                         # 12 core + 7 adapter tests
cd contracts && forge test       # 16 contract tests
```

The signature test computes its HMAC independently rather than calling our own
signer, so it catches a change in the scheme instead of agreeing with itself.

---

## Known limitations

**Attendance is never written back to the platform.** Luma has no check-in API, so
there is nowhere to write it. The contract is the record, and the platform learns
through the `attendance.confirmed` webhook.

**Unstop and similar have no API at all.** Only the REST + embed path works there.

**The organiser key is a hot key.** It signs `createEvent`, `finalize` and
`payout`. It can never move an attendee's funds — attendees sign their own
`register` and `checkIn` — but it can mismanage events it created.

**Everything else in [`../README.md`](../README.md#honest-limitations)** applies
here too, including that the challenge proves liveness rather than physical
presence.
