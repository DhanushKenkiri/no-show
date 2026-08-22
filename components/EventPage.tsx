"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useState } from "react";

import { RegistrationCard } from "@/components/RegistrationCard";
import { REGISTRATION_STATES, type RegistrationStatus } from "@/lib/registration";
import {
  AboutSection,
  CoverImage,
  EventTitle,
  Footer,
  HostsSection,
  DateBlock,
  LocationSection,
  PresentedBy,
  SocialRow,
  TopNav,
} from "@/components/Shell";

// RainbowKit's ConnectButton reaches for browser globals as it loads, which crashes
// the prerender of this route. It is a wallet button: there is nothing useful to
// render on the server anyway.
const ConnectButton = dynamic(
  () => import("@rainbow-me/rainbowkit").then((m) => m.ConnectButton),
  { ssr: false, loading: () => <span className="pill">Connect Wallet</span> },
);


/**
 * The event page — DESIGN.md §3.
 *
 * Mobile is the demo surface, so it is the default: a single column, with the
 * card's primary action promoted to a sticky bottom bar under 640px. The two
 * column desktop layout is the enhancement, not the base.
 */
export function EventPage({ debugStatus }: { debugStatus: RegistrationStatus | null }) {
  const [status, setStatus] = useState<RegistrationStatus>("IDLE");
  const effective = debugStatus ?? status;

  return (
    <div className="bg">
      <div className="page">
        <TopNav />

        {debugStatus && <DebugBanner current={debugStatus} />}

        <div className="grid">
          <aside className="rail">
            <CoverImage />
            <PresentedBy />
            <SocialRow />
            <HostsSection />
          </aside>

          <main className="main">
            <EventTitle />
            <DateBlock />

            <div style={{ display: "flex", justifyContent: "flex-start" }}>
              <ConnectButton showBalance={false} chainStatus="icon" />
            </div>

            <RegistrationCard
              status={effective}
              onRegister={() => setStatus("AUTHORIZING")}
              onScan={() => setStatus("SCANNING")}
              onCancel={() => setStatus("REGISTERED")}
            />

            <AboutSection />
            <LocationSection />
          </main>
        </div>

        <Footer />
      </div>
    </div>
  );
}

/**
 * Visible on purpose. A forced state must never be mistaken for a real one —
 * especially in a screenshot that ends up in the README.
 */
function DebugBanner({ current }: { current: RegistrationStatus }) {
  return (
    <div className="debugBanner">
      <strong>debug</strong>
      <span>
        forcing <code>{current}</code> — not real state
      </span>
      {REGISTRATION_STATES.map((state) => (
        <Link key={state} href={`/?debug=${state}`}>
          {state}
        </Link>
      ))}
      <Link href="/">clear</Link>
    </div>
  );
}
