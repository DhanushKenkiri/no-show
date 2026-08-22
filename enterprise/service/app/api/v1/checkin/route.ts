import { deliverWebhook } from "@noshow/core";
import type { Hex } from "viem";
import { errorJson, json, noshow, store } from "@/lib/noshow";

export const runtime = "nodejs";

const BYTES32 = /^0x[\da-fA-F]{64}$/;

/**
 * Confirm a mined check-in and release the hold for zero.
 *
 * The attendee's wallet sent the transaction and posts us the hash — MetaMask
 * does not implement eth_signTransaction, so a browser cannot hand over a
 * detached signed transaction for a server to broadcast. The chain is the source
 * of truth for whether the check-in happened; this route verifies it and settles.
 *
 * No API key. The transaction hash is the credential: it is verified against the
 * registry, must emit CheckedIn for its own sender, and must carry a challenge
 * that was current in the block it mined in.
 */
export async function POST(request: Request) {
  let body: { eventId?: string; challenge?: string; txHash?: string };
  try {
    body = await request.json();
  } catch {
    return errorJson("Body must be JSON.");
  }

  const { eventId, challenge, txHash } = body;
  if (!eventId || !BYTES32.test(eventId)) return errorJson("eventId must be a 32-byte hex value.");
  if (!challenge || !BYTES32.test(challenge)) return errorJson("challenge must be a 32-byte hex value.");
  if (!txHash || !/^0x[\da-fA-F]{64}$/.test(txHash)) return errorJson("txHash is required.");

  try {
    const result = await noshow.verifyCheckIn({
      eventId: eventId as Hex,
      challenge: challenge as Hex,
      txHash: txHash as Hex,
    });

    // Tell the platform, but never let their endpoint fail the attendee's
    // check-in — it is already on chain, so a missed webhook is a reconciliation
    // problem rather than a lost record.
    const hold = await store.findHoldByPayer(eventId as Hex, result.payer);
    if (hold) {
      const tenant = await store.getTenant(hold.tenantId);
      if (tenant?.webhookUrl && tenant.webhookSecret) {
        void deliverWebhook({
          url: tenant.webhookUrl,
          secret: tenant.webhookSecret,
          event: "attendance.confirmed",
          data: {
            eventId,
            externalId: hold.externalId,
            payer: result.payer,
            txHash,
            blockNumber: result.blockNumber.toString(),
            settled: result.settled,
          },
        });
      }
    }

    return json(
      {
        checkedIn: true,
        payer: result.payer,
        txHash,
        blockNumber: result.blockNumber.toString(),
        settled: result.settled,
        warning: result.warning ?? null,
      },
      // 202 when the check-in is real but nothing could be settled: saying "ok"
      // would be a lie and saying "failed" would be a worse one.
      { status: result.settled ? 200 : 202 },
    );
  } catch (cause) {
    return errorJson(cause instanceof Error ? cause.message : "Check-in failed.", 502);
  }
}
