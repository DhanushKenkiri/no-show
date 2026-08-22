"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useState } from "react";
import type { Hex } from "viem";
import { RegistrationCard } from "@/components/RegistrationCard";
import { Scanner } from "@/components/Scanner";
import {
  AboutSection,
  CoverImage,
  DateBlock,
  EventTitle,
  Footer,
  HostsSection,
  LocationSection,
  PresentedBy,
  SocialRow,
  TopNav,
} from "@/components/Shell";
import { REGISTRATION_STATES, type RegistrationStatus } from "@/lib/registration";
import { useNoShow } from "@/lib/useNoShow";

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
  const { isConnected, status, setStatus, progress, error, setError, register, checkIn } =
    useNoShow();
  const [scanning, setScanning] = useState(false);

  // A forced state must never touch the chain — `?debug=` is for screenshots.
  const effective: RegistrationStatus = debugStatus ?? (scanning ? "SCANNING" : status);

  const onChallenge = useCallback(
    (challenge: Hex) => {
      setScanning(false);
      void checkIn(challenge);
    },
    [checkIn],
  );

  return (
    // No animated background while the camera is open — DESIGN.md §6.
    <div className="bg" data-camera={scanning ? "true" : "false"}>
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

            <div style={{ display: "flex", gap: "var(--s-3)", alignItems: "center" }}>
              <ConnectButton showBalance={false} chainStatus="icon" />
              <Link href="/checkin" className="pill">
                Venue display ↗
              </Link>
            </div>

            <RegistrationCard
              status={effective}
              error={error}
              progress={progress}
              connected={isConnected || Boolean(debugStatus)}
              viewfinder={scanning ? <Scanner onChallenge={onChallenge} /> : null}
              onRegister={() => {
                setError(null);
                void register();
              }}
              onScan={() => {
                setError(null);
                setScanning(true);
              }}
              onCancel={() => {
                setScanning(false);
                setStatus("REGISTERED");
              }}
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
