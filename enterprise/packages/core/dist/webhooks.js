import { createHmac, timingSafeEqual } from "node:crypto";
/**
 * Webhook signing and verification.
 *
 * The scheme is deliberately identical to Luma's, because integrators who already
 * consume Luma webhooks then need no new code to consume ours:
 *
 *   Webhook-Signature: t=<unix-seconds>,v1=<hex hmac-sha256>
 *
 * The signed payload is `{timestamp}.{raw_body}`. Signing the raw bytes, not a
 * re-serialised object, is the whole point — `JSON.parse` followed by
 * `JSON.stringify` can reorder keys and change whitespace, and the signature would
 * then never match.
 */
export const SIGNATURE_HEADER = "webhook-signature";
export const TIMESTAMP_HEADER = "webhook-timestamp";
export const ID_HEADER = "webhook-id";
/** Reject anything older than this, so a captured request cannot be replayed later. */
const DEFAULT_TOLERANCE_SECONDS = 300;
export function signWebhook(rawBody, secret, timestamp = Math.floor(Date.now() / 1000)) {
    const signature = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    return `t=${timestamp},v1=${signature}`;
}
/**
 * Verify a signature header against the raw body.
 *
 * Compares in constant time. A plain `===` on a signature leaks how many leading
 * bytes were correct through timing, which is enough to forge one byte at a time.
 */
export function verifyWebhook(rawBody, header, secret, toleranceSeconds = DEFAULT_TOLERANCE_SECONDS) {
    if (!header)
        return { valid: false, reason: "missing signature header" };
    const parts = Object.fromEntries(header.split(",").map((piece) => {
        const index = piece.indexOf("=");
        return index === -1 ? [piece.trim(), ""] : [piece.slice(0, index).trim(), piece.slice(index + 1).trim()];
    }));
    const timestamp = Number(parts.t);
    const provided = parts.v1;
    if (!Number.isFinite(timestamp) || !provided) {
        return { valid: false, reason: "malformed signature header" };
    }
    const age = Math.abs(Math.floor(Date.now() / 1000) - timestamp);
    if (age > toleranceSeconds) {
        return { valid: false, reason: `timestamp outside tolerance (${age}s)` };
    }
    const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex");
    // timingSafeEqual throws on length mismatch, which is itself an answer.
    const a = Buffer.from(expected, "utf8");
    const b = Buffer.from(provided, "utf8");
    if (a.length !== b.length)
        return { valid: false, reason: "signature mismatch" };
    if (!timingSafeEqual(a, b))
        return { valid: false, reason: "signature mismatch" };
    return { valid: true };
}
/**
 * Deliver a signed event to a tenant.
 *
 * Failures are returned, never thrown: a tenant's endpoint being down must not
 * fail the attendee's check-in. The chain is already the source of truth, so a
 * missed webhook is a reconciliation problem, not a lost record.
 */
export async function deliverWebhook(opts) {
    const body = JSON.stringify({ type: opts.event, data: opts.data, sentAt: new Date().toISOString() });
    const timestamp = Math.floor(Date.now() / 1000);
    try {
        const response = await fetch(opts.url, {
            method: "POST",
            headers: {
                "content-type": "application/json",
                [SIGNATURE_HEADER]: signWebhook(body, opts.secret, timestamp),
                [TIMESTAMP_HEADER]: String(timestamp),
                [ID_HEADER]: crypto.randomUUID(),
            },
            body,
            signal: AbortSignal.timeout(opts.timeoutMs ?? 5_000),
        });
        return { ok: response.ok, status: response.status };
    }
    catch (cause) {
        return { ok: false, error: cause instanceof Error ? cause.message : String(cause) };
    }
}
