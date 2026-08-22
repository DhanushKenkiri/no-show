"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { RegistrationStatus } from "@/lib/registration";

/**
 * The product. One card, six states, driven by a single `status` prop —
 * DESIGN.md §5.
 *
 * Keeping every state in one component is what makes `?debug=state` work: there
 * is no hidden machine to drive, so any state can be forced and screenshotted
 * without running the whole flow.
 */
type Props = {
  status: RegistrationStatus;
  /** Rendered inside CHECKED_IN. The CommitPill lands here in Prompt 6. */
  commitPill?: ReactNode;
  /** Live camera preview, mounted by the SCANNING state in Prompt 5. */
  viewfinder?: ReactNode;
  onRegister?: () => void;
  onScan?: () => void;
  onCancel?: () => void;
  onTicket?: () => void;
  onReceipt?: () => void;
  error?: string | null;
};

function StatusChip({ status }: { status: RegistrationStatus }) {
  if (status === "AUTHORIZING") {
    return (
      <span className="statusChip">
        <span className="spinner" aria-hidden />
        <span className="sr-only">Signing</span>
      </span>
    );
  }
  if (status === "REGISTERED") {
    return (
      <span className="statusChip live">
        <span className="dot" aria-hidden />
        LIVE
      </span>
    );
  }
  if (status === "CHECKED_IN") {
    return (
      <span className="statusChip ok">
        <span className="dot" aria-hidden />
        Checked in
      </span>
    );
  }
  if (status === "NO_SHOW") {
    return (
      <span className="statusChip warn">
        <span className="dot" aria-hidden />
        Charged
      </span>
    );
  }
  return null;
}

const HEADINGS: Record<RegistrationStatus, string> = {
  IDLE: "Register",
  AUTHORIZING: "Signing…",
  REGISTERED: "You're In",
  SCANNING: "Check in",
  CHECKED_IN: "Checked In",
  NO_SHOW: "Hold charged",
};

export function RegistrationCard({
  status,
  commitPill,
  viewfinder,
  onRegister,
  onScan,
  onCancel,
  onTicket,
  onReceipt,
  error,
}: Props) {
  const actions = <CardActions {...{ status, onRegister, onScan, onCancel, onTicket, onReceipt }} />;

  return (
    <>
      <section className="card" aria-live="polite">
        <div className="cardTop">
          <Image src="/assets/you.jpg" alt="" width={40} height={40} className="avatar" />
          <StatusChip status={status} />
        </div>

        <h2 className="cardHeading">{HEADINGS[status]}</h2>

        {status === "IDLE" && (
          <p className="cardBody">
            Free. We hold $2 and release it the moment you check in.
          </p>
        )}

        {status === "AUTHORIZING" && (
          <p className="cardBody">This is a signature, not a payment. Nothing moves yet.</p>
        )}

        {status === "REGISTERED" && (
          <p className="cardBody">Hold: $2 · released at check-in</p>
        )}

        {status === "SCANNING" && (
          <div className="viewfinder">
            {viewfinder ?? "Point the camera at the venue screen"}
          </div>
        )}

        {status === "CHECKED_IN" && (
          <>
            {/* The single most important string in the app — DESIGN.md §5. */}
            <p className="heroBody">
              Hold released. <strong>$0 settled — no transaction was written.</strong>
            </p>
            {commitPill}
          </>
        )}

        {status === "NO_SHOW" && (
          <p className="cardBody">$2 settled. Funds the food for people who showed.</p>
        )}

        {error && (
          <p className="cardBody warn" role="alert">
            {error}
          </p>
        )}

        <div className="cardActionsInline">{actions}</div>
      </section>

      {/* Below 640px the primary action becomes a sticky bottom bar — DESIGN.md §3. */}
      <div className="stickyBar">{actions}</div>
    </>
  );
}

function CardActions({
  status,
  onRegister,
  onScan,
  onCancel,
  onTicket,
  onReceipt,
}: Pick<Props, "status" | "onRegister" | "onScan" | "onCancel" | "onTicket" | "onReceipt">) {
  if (status === "IDLE") {
    return (
      <div className="actions">
        <button type="button" className="btn btnAccent" onClick={onRegister}>
          Register
        </button>
      </div>
    );
  }

  if (status === "AUTHORIZING") {
    return (
      <div className="actions">
        <button type="button" className="btn btnAccent" disabled>
          Signing…
        </button>
      </div>
    );
  }

  if (status === "REGISTERED") {
    return (
      <div className="actions">
        <button type="button" className="btn btnLight" onClick={onTicket}>
          My Ticket
        </button>
        <button type="button" className="btn btnGhost" onClick={onScan}>
          Check in
        </button>
      </div>
    );
  }

  if (status === "SCANNING") {
    return (
      <div className="actions">
        <button type="button" className="btn btnGhost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    );
  }

  if (status === "CHECKED_IN") {
    return (
      <div className="actions">
        <button type="button" className="btn btnGhost" onClick={onReceipt}>
          View receipt
        </button>
      </div>
    );
  }

  return null;
}
