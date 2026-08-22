import { BASE_URL, REGISTRY } from "@/lib/noshow";

export const dynamic = "force-dynamic";

/**
 * Integration docs. Deliberately the landing page: the audience for this service
 * is an engineer wiring it into a platform, not an attendee.
 */
export default function Home() {
  return (
    <main className="wrap">
      <h1>No-Show</h1>
      <p className="muted">
        Deposit-free RSVP with on-chain proof of attendance. Your guests authorise a
        hold with a signature — no payment, no transaction — and it settles for zero
        when they turn up.
      </p>

      <h2>1. Get a tenant</h2>
      <pre>{`curl -X POST ${BASE_URL}/api/v1/tenants \
  -H "x-admin-secret: $ADMIN_SECRET" \
  -H "content-type: application/json" \
  -d '{"tenantId":"acme","name":"Acme Events"}'`}</pre>
      <p className="dim">Returns an API key once. Only its hash is stored.</p>

      <h2>2. Create an event</h2>
      <pre>{`curl -X POST ${BASE_URL}/api/v1/events \
  -H "authorization: Bearer $API_KEY" \
  -H "content-type: application/json" \
  -d '{"eventId":"summer-summit"}'`}</pre>

      <h2>3. On each registration, create a hold</h2>
      <pre>{`curl -X POST ${BASE_URL}/api/v1/holds \
  -H "authorization: Bearer $API_KEY" \
  -H "content-type: application/json" \
  -d '{"eventId":"summer-summit","guestId":"g-1","email":"a@b.co"}'

# -> { "holdUrl": "${BASE_URL}/hold/..." }`}</pre>
      <p className="muted">
        Send the guest to <code>holdUrl</code>, or open it in an iframe. Everything
        else — wallet, wrapping, Permit2, signing — happens there.
      </p>

      <h2>Using Luma instead</h2>
      <p className="muted">
        Point a Luma webhook at{" "}
        <code>{`${BASE_URL}/api/webhooks/luma/{tenantId}`}</code> with the{" "}
        <em>Guest Registered</em> event enabled. Signatures are verified, and a hold
        intent is created per guest. Note that Luma has no check-in API, so
        attendance is never written back — the contract is the record.
      </p>

      <h2>Or integrate in code</h2>
      <pre>{`npm i @noshow/core

const noshow = new NoShowClient({
  registry: "${REGISTRY}",
  store: new RedisStore({ url, token }),
  organiser: privateKeyToAccount(key),
  baseUrl: "https://your-app.example",
});`}</pre>

      <h2>Contract</h2>
      <p className="dim">
        <code>{REGISTRY}</code> on Monad Testnet — one registry, many events, each
        with its own organiser.
      </p>
    </main>
  );
}
