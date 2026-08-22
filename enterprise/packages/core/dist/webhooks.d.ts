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
export declare const SIGNATURE_HEADER = "webhook-signature";
export declare const TIMESTAMP_HEADER = "webhook-timestamp";
export declare const ID_HEADER = "webhook-id";
export declare function signWebhook(rawBody: string, secret: string, timestamp?: number): string;
export type VerifyResult = {
    valid: true;
} | {
    valid: false;
    reason: string;
};
/**
 * Verify a signature header against the raw body.
 *
 * Compares in constant time. A plain `===` on a signature leaks how many leading
 * bytes were correct through timing, which is enough to forge one byte at a time.
 */
export declare function verifyWebhook(rawBody: string, header: string | null | undefined, secret: string, toleranceSeconds?: number): VerifyResult;
export type OutboundEvent = "hold.pending" | "hold.authorized" | "attendance.confirmed" | "hold.charged" | "hold.paid_out";
/**
 * Deliver a signed event to a tenant.
 *
 * Failures are returned, never thrown: a tenant's endpoint being down must not
 * fail the attendee's check-in. The chain is already the source of truth, so a
 * missed webhook is a reconciliation problem, not a lost record.
 */
export declare function deliverWebhook(opts: {
    url: string;
    secret: string;
    event: OutboundEvent;
    data: unknown;
    timeoutMs?: number;
}): Promise<{
    ok: boolean;
    status?: number;
    error?: string;
}>;
