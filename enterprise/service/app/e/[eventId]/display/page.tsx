import { DisplayClient } from "./DisplayClient";

export const dynamic = "force-dynamic";

/**
 * The venue display. Runs on a laptop at the front of the room, needs no wallet
 * and no interaction.
 */
export default async function DisplayPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  return <DisplayClient eventId={eventId as `0x${string}`} />;
}
