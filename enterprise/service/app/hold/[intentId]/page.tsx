import { notFound } from "next/navigation";
import { HoldClient } from "./HoldClient";
import { REGISTRY, noshow, store } from "@/lib/noshow";

export const dynamic = "force-dynamic";

/**
 * The hosted hold page.
 *
 * This is the redirect and iframe target for every integration. A platform sends
 * the attendee here and is done: connecting a wallet, wrapping, approving Permit2
 * and signing all happen on this page, on our side of the line.
 */
export default async function HoldPage({
  params,
}: {
  params: Promise<{ intentId: string }>;
}) {
  const { intentId } = await params;
  const hold = await store.getHold(intentId);
  if (!hold) notFound();

  return (
    <main className="wrap">
      <HoldClient
        intentId={intentId}
        eventId={hold.eventId}
        registry={REGISTRY}
        holdAmount={noshow.holdAmount}
        assetSymbol={noshow.asset.symbol}
        guestName={hold.metadata?.name ?? null}
      />
    </main>
  );
}
