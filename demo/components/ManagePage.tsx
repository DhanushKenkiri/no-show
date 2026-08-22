"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { formatUnits } from "viem";
import { TopNav } from "@/components/Shell";
import { useGuests, type Guest } from "@/lib/useGuests";

const ConnectButton = dynamic(
  () => import("@rainbow-me/rainbowkit").then((m) => m.ConnectButton),
  { ssr: false, loading: () => <span className="pill">Connect Wallet</span> },
);

const CHIP: Record<Guest["state"], { label: string; className: string }> = {
  REGISTERED: { label: "Registered", className: "live" },
  CHECKED_IN: { label: "Checked in", className: "ok" },
  NO_SHOW: { label: "No-show", className: "warn" },
};

export function ManagePage() {
  const { rows, totals, connected, isOrganiser, finalize, finalizing, error } =
    useGuests();

  return (
    <div className="bg">
      <div className="page">
        <TopNav />

        <div className="manageHead">
          <h1 className="cardHeading">Guests</h1>
          <span className="statusChip">
            <span className={`dot ${connected ? "ok" : "warn"}`} aria-hidden />
            <span className="mono">{connected ? "live" : "disconnected"}</span>
          </span>
          <span style={{ flex: 1 }} />
          <ConnectButton showBalance={false} chainStatus="icon" />
        </div>

        <StatBar {...totals} />

        <div className="guestList">
          {rows.length === 0 ? (
            <p className="cardBody">
              No events seen yet. This list is fed by a live subscription and never
              backfills history, so it only shows what happens from now on — keep this
              page open before registrations start.
            </p>
          ) : (
            rows.map((guest) => <GuestRow key={guest.address} guest={guest} />)
          )}
        </div>

        {error && (
          <p className="cardBody warn" role="alert">
            {error}
          </p>
        )}

        <div className="actions">
          <button
            type="button"
            className="btn btnAccent"
            onClick={() => void finalize()}
            disabled={!isOrganiser || finalizing}
          >
            {finalizing ? "Charging holds…" : "Finalize & charge no-shows"}
          </button>
          <Link href="/checkin" className="btn btnGhost">
            Venue display ↗
          </Link>
        </div>

        {!isOrganiser && (
          <p className="cardBody">
            Connect the organiser wallet to finalize. Anyone else calling it reverts
            <code> NotOrganiser</code>.
          </p>
        )}
      </div>
    </div>
  );
}

/** registered · checked in · holds released · holds charged — DESIGN.md §4.16. */
function StatBar({
  registered,
  checkedIn,
  holdsReleased,
  holdsCharged,
}: {
  registered: number;
  checkedIn: number;
  holdsReleased: number;
  holdsCharged: number;
}) {
  const stats = [
    { label: "Registered", value: registered, tone: "" },
    { label: "Checked in", value: checkedIn, tone: "ok" },
    { label: "Holds released", value: holdsReleased, tone: "ok" },
    { label: "Holds charged", value: holdsCharged, tone: "warn" },
  ];

  return (
    <div className="statBar">
      {stats.map((stat) => (
        <div key={stat.label} className="stat">
          <span className={`statValue ${stat.tone}`}>{stat.value}</span>
          <span className="statLabel">{stat.label}</span>
        </div>
      ))}
    </div>
  );
}

function GuestRow({ guest }: { guest: Guest }) {
  const chip = CHIP[guest.state];

  return (
    <div className="guestRow">
      {/* DESIGN.md §7: a real named host must never appear in a failure state. */}
      <Image src="/assets/you.jpg" alt="" width={32} height={32} className="avatar" />
      <span className="mono guestAddress">
        {guest.address.slice(0, 6)}…{guest.address.slice(-4)}
      </span>
      <span className={`statusChip ${chip.className}`}>
        <span className="dot" aria-hidden />
        {chip.label}
      </span>
      <span className="mono guestHold">
        ${formatUnits(guest.holdUsdc, 6)}
      </span>
    </div>
  );
}
