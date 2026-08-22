"use client";

import { blocksLeftInWindow, venueChallenge, CHALLENGE_BLOCKS } from "@noshow/core";
import jsQR from "jsqr";
import QRCode from "qrcode";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Hex } from "viem";
import type { HoldStatus } from "./useHold.js";

/**
 * Drop-in components.
 *
 * Every value comes from CSS custom properties in styles.css, so an integrator
 * restyles by overriding tokens rather than forking components. No box-shadow
 * anywhere: structure comes from hairline borders and translucent fills.
 */

const BYTES32 = /^0x[\da-fA-F]{64}$/;

// --- registration card ----------------------------------------------------

export type RegistrationCardProps = {
  status: HoldStatus;
  holdLabel?: string;
  avatarUrl?: string;
  error?: string | null;
  progress?: string | null;
  connected?: boolean;
  commitPill?: ReactNode;
  viewfinder?: ReactNode;
  onRegister?: () => void;
  onScan?: () => void;
  onCancel?: () => void;
  onReceipt?: () => void;
};

const HEADINGS: Record<HoldStatus, string> = {
  IDLE: "Register",
  AUTHORIZING: "Signing…",
  REGISTERED: "You're In",
  SCANNING: "Check in",
  CHECKED_IN: "Checked In",
  NO_SHOW: "Hold charged",
};

/**
 * One card, six states, driven by a single `status` prop.
 *
 * Keeping every state in one component is what makes a `?debug=` affordance
 * possible: there is no hidden machine to drive, so any state can be forced and
 * screenshotted without running the whole flow.
 */
export function RegistrationCard({
  status,
  holdLabel = "0.5 MON",
  avatarUrl,
  error,
  progress,
  connected = true,
  commitPill,
  viewfinder,
  onRegister,
  onScan,
  onCancel,
  onReceipt,
}: RegistrationCardProps) {
  return (
    <section className="ns-card" aria-live="polite">
      <div className="ns-card-top">
        {avatarUrl ? <img src={avatarUrl} alt="" className="ns-avatar" /> : <span className="ns-avatar" />}
        <StatusChip status={status} />
      </div>

      <h2 className="ns-heading">{HEADINGS[status]}</h2>

      {status === "IDLE" && (
        <p className="ns-body">Free. We hold {holdLabel} and release it the moment you check in.</p>
      )}
      {status === "AUTHORIZING" && (
        <p className="ns-body">This is a signature, not a payment. Nothing moves yet.</p>
      )}
      {status === "REGISTERED" && <p className="ns-body">Hold: {holdLabel} · released at check-in</p>}
      {status === "SCANNING" && (
        <div className="ns-viewfinder">{viewfinder ?? "Point the camera at the venue screen"}</div>
      )}
      {status === "CHECKED_IN" && (
        <>
          {/* The single most important string in the product. */}
          <p className="ns-hero">
            Hold released. <strong>0 settled — no transaction was written.</strong>
          </p>
          {commitPill}
        </>
      )}
      {status === "NO_SHOW" && (
        <p className="ns-body">{holdLabel} settled. Funds the people who showed.</p>
      )}

      {progress && (
        <p className="ns-body ns-mono" aria-live="polite">
          {progress}
        </p>
      )}
      {!connected && status === "IDLE" && <p className="ns-body">Connect a wallet to register.</p>}
      {error && (
        <p className="ns-body ns-warn" role="alert">
          {error}
        </p>
      )}

      <CardActions {...{ status, connected, onRegister, onScan, onCancel, onReceipt }} />
    </section>
  );
}

function StatusChip({ status }: { status: HoldStatus }) {
  if (status === "AUTHORIZING") return <span className="ns-chip"><span className="ns-spinner" /></span>;
  if (status === "REGISTERED") return <span className="ns-chip ns-live"><span className="ns-dot" />LIVE</span>;
  if (status === "CHECKED_IN") return <span className="ns-chip ns-ok"><span className="ns-dot" />Checked in</span>;
  if (status === "NO_SHOW") return <span className="ns-chip ns-warn"><span className="ns-dot" />Charged</span>;
  return null;
}

function CardActions({
  status,
  connected,
  onRegister,
  onScan,
  onCancel,
  onReceipt,
}: Pick<RegistrationCardProps, "status" | "connected" | "onRegister" | "onScan" | "onCancel" | "onReceipt">) {
  if (status === "IDLE") {
    return (
      <div className="ns-actions">
        <button type="button" className="ns-btn ns-btn-accent" onClick={onRegister} disabled={!connected}>
          Register
        </button>
      </div>
    );
  }
  if (status === "AUTHORIZING") {
    return (
      <div className="ns-actions">
        <button type="button" className="ns-btn ns-btn-accent" disabled>Signing…</button>
      </div>
    );
  }
  if (status === "REGISTERED") {
    return (
      <div className="ns-actions">
        <button type="button" className="ns-btn ns-btn-accent" onClick={onScan}>Check in</button>
      </div>
    );
  }
  if (status === "SCANNING") {
    return (
      <div className="ns-actions">
        <button type="button" className="ns-btn ns-btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    );
  }
  if (status === "CHECKED_IN") {
    return (
      <div className="ns-actions">
        <button type="button" className="ns-btn ns-btn-ghost" onClick={onReceipt}>View receipt</button>
      </div>
    );
  }
  return null;
}

// --- scanner --------------------------------------------------------------

/**
 * Reads the venue screen.
 *
 * BarcodeDetector is native, hardware-accelerated and present in Chrome on
 * Android — the usual demo device — so it is tried first, with jsQR as the
 * fallback for iOS Safari and desktop. The window is about a second, so decode
 * latency is not a detail.
 *
 * Requires HTTPS. getUserMedia is unavailable on plain HTTP outside localhost.
 */
export function Scanner({ onChallenge, paused }: { onChallenge: (c: Hex) => void; paused?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const firedRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    let detector: { detect: (s: CanvasImageSource) => Promise<{ rawValue: string }[]> } | null = null;

    function handle(raw: string) {
      const value = raw.trim();
      if (!BYTES32.test(value) || firedRef.current) return;
      firedRef.current = true;
      onChallenge(value as Hex);
    }

    async function tick() {
      if (cancelled) return;
      const video = videoRef.current;
      if (video && video.readyState === video.HAVE_ENOUGH_DATA && !paused) {
        try {
          if (detector) {
            const found = await detector.detect(video);
            if (found[0]?.rawValue) handle(found[0].rawValue);
          } else {
            const canvas = canvasRef.current;
            const ctx = canvas?.getContext("2d", { willReadFrequently: true });
            if (canvas && ctx) {
              canvas.width = video.videoWidth;
              canvas.height = video.videoHeight;
              ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
              const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
              const found = jsQR(image.data, image.width, image.height, { inversionAttempts: "dontInvert" });
              if (found?.data) handle(found.data);
            }
          }
        } catch {
          // A dropped frame is not worth surfacing; keep scanning.
        }
      }
      raf = requestAnimationFrame(() => void tick());
    }

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          video.setAttribute("playsinline", "true");
          await video.play();
        }
        const Detector = (globalThis as unknown as {
          BarcodeDetector?: new (o: { formats: string[] }) => typeof detector;
        }).BarcodeDetector;
        if (Detector) {
          try {
            detector = new Detector({ formats: ["qr_code"] }) as typeof detector;
          } catch {
            detector = null;
          }
        }
        void tick();
      } catch (cause) {
        setError(
          cause instanceof Error && /denied|NotAllowed/i.test(cause.message)
            ? "Camera permission was denied. Allow it and try again."
            : "Could not open the camera. HTTPS is required for camera access.",
        );
      }
    }

    void start();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onChallenge, paused]);

  if (error) return <span className="ns-warn">{error}</span>;
  return (
    <>
      <video ref={videoRef} muted playsInline aria-label="Camera viewfinder" />
      <canvas ref={canvasRef} hidden />
    </>
  );
}

// --- venue display --------------------------------------------------------

/**
 * The screen you point the room at.
 *
 * The challenge is computed here rather than read per block: it is exactly what
 * the contract evaluates, and the public RPC caps eth_call at 25rps while this
 * screen updates several times a second.
 *
 * It shows the NEXT window, not the live one. That is not cosmetic — a check-in
 * submitted the instant a code appears still mines about three blocks later, which
 * is past a three-block window. Aiming one window ahead makes the transaction land
 * where it was always going to land.
 */
export function VenueDisplay({
  eventId,
  blockNumber,
  lead,
  caption,
}: {
  eventId: Hex;
  blockNumber: bigint | null;
  lead?: bigint;
  caption?: string;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const challenge = blockNumber === null ? null : venueChallenge(eventId, blockNumber, lead);

  useEffect(() => {
    if (!challenge) return;
    let cancelled = false;
    // Error correction stays low: this is read from across a room on a big screen,
    // where more modules means smaller ones, not a better read.
    QRCode.toDataURL(challenge, { errorCorrectionLevel: "L", margin: 1, width: 900 })
      .then((url) => {
        if (!cancelled) setQr(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [challenge]);

  const blocksLeft = blockNumber === null ? 0 : blocksLeftInWindow(blockNumber);
  const fraction = blocksLeft / Number(CHALLENGE_BLOCKS);

  return (
    <div className="ns-venue">
      <div className="ns-venue-qr-wrap">
        {qr ? (
          <img src={qr} alt="Check-in challenge" className="ns-venue-qr" />
        ) : (
          <div className="ns-venue-qr ns-venue-placeholder">waiting for a block…</div>
        )}
        <CountdownRing fraction={fraction} />
      </div>
      <div className="ns-venue-meta">
        <span className="ns-mono ns-venue-block">block {blockNumber?.toString() ?? "—"}</span>
        <span>{blocksLeft} {blocksLeft === 1 ? "block" : "blocks"} left in this window</span>
      </div>
      <p className="ns-venue-caption">
        {caption ?? `This code is valid for ${CHALLENGE_BLOCKS} blocks — about a second. Scan it from the room.`}
      </p>
    </div>
  );
}

function CountdownRing({ fraction }: { fraction: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  return (
    <svg className="ns-venue-ring" viewBox="0 0 100 100" aria-hidden>
      <circle cx="50" cy="50" r={radius} fill="none" stroke="var(--ns-border)" strokeWidth="6" />
      <circle
        cx="50" cy="50" r={radius} fill="none"
        stroke="var(--ns-accent)" strokeWidth="6" strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}

// --- commit pill ----------------------------------------------------------

/**
 * Monad's commit states, made visible.
 *
 * Block tags map to Proposed / Voted / Finalized. All three are read concurrently,
 * because reading them in sequence would measure our own round trips rather than
 * the chain's finality. Measured on Monad Testnet, finalized trails latest by 2-3
 * blocks — roughly 600-850ms.
 */
export function CommitPill({
  reached,
  elapsedMs,
}: {
  reached: { latest: boolean; safe: boolean; finalized: boolean };
  elapsedMs?: number | null;
}) {
  const label = reached.finalized ? "Finalized" : reached.safe ? "Voted" : "Proposed";
  return (
    <div className="ns-commit" aria-live="polite">
      <div className="ns-commit-dots">
        <span className={`ns-commit-dot${reached.latest ? " ns-on" : ""}`} />
        <span className={`ns-commit-dot${reached.safe ? " ns-on" : ""}`} />
        <span className={`ns-commit-dot${reached.finalized ? " ns-on" : ""}`} />
      </div>
      <span className="ns-commit-label">{label}</span>
      {elapsedMs != null && <span className="ns-mono">{elapsedMs}ms to finality</span>}
    </div>
  );
}
