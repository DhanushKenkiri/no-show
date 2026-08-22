import type { Metadata } from "next";
import { VenueDisplay } from "@/components/VenueDisplay";

export const metadata: Metadata = {
  title: "No-Show — venue display",
};

/**
 * The laptop screen. Runs at the front of the room and does nothing but show the
 * current challenge, so it needs no wallet and no interaction.
 */
export default function CheckInDisplay() {
  return <VenueDisplay />;
}
