import { EventPage } from "@/components/EventPage";
import { isRegistrationStatus } from "@/lib/registration";

/**
 * `?debug=<STATE>` forces any RegistrationCard state without running the flow.
 * It is how all six states get screenshotted for the README at hour 5:30 without
 * needing the camera, a wallet and a facilitator to all cooperate at once.
 */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const raw = Array.isArray(params.debug) ? params.debug[0] : params.debug;
  const debugStatus = isRegistrationStatus(raw) ? raw : null;

  return <EventPage debugStatus={debugStatus} />;
}
