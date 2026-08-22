"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { encodePacked, keccak256, type Hex } from "viem";
import { publicClient } from "@/lib/chain";
import { CHALLENGE_BLOCKS, EVENT_ID, VENUE_LEAD_WINDOWS } from "@/lib/config";

/**
 * The venue display — the thing you point the room at.
 *
 * The challenge is computed here, not read from the contract. It is exactly
 * `keccak256(abi.encodePacked(eventId, block.number / 3))`, the same expression
 * NoShow.currentChallenge evaluates, so a per-block `eth_call` would tell us
 * something we can already work out. That matters: the public RPC caps eth_call at
 * 25rps, and this screen updates several times a second.
 */
function challengeFor(block: bigint): Hex {
  // Aimed one window ahead — see VENUE_LEAD_WINDOWS for the measurement behind it.
  // A scan now becomes a transaction that mines roughly three blocks from now,
  // which is exactly the window this encodes.
  const window = block / CHALLENGE_BLOCKS + VENUE_LEAD_WINDOWS;
  return keccak256(encodePacked(["bytes32", "uint256"], [EVENT_ID, window]));
}

export function VenueDisplay() {
  const [block, setBlock] = useState<bigint | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unwatch = publicClient.watchBlockNumber({
      emitOnBegin: true,
      poll: true,
      pollingInterval: 250,
      onBlockNumber: (next) => {
        setBlock(next);
        setError(null);
      },
      onError: () => setError("Lost the RPC connection. Retrying…"),
    });
    return () => unwatch();
  }, []);

  const challenge = block === null ? null : challengeFor(block);

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

  const blocksLeft =
    block === null ? 0 : Number(CHALLENGE_BLOCKS - (block % CHALLENGE_BLOCKS));
  const fraction = blocksLeft / Number(CHALLENGE_BLOCKS);

  return (
    <div className="venue">
      <div className="venueQrWrap">
        {qr ? (
          <img src={qr} alt="Check-in challenge" className="venueQr" />
        ) : (
          <div className="venueQr venuePlaceholder">waiting for a block…</div>
        )}
        <CountdownRing fraction={fraction} />
      </div>

      <div className="venueMeta">
        <span className="venueBlock mono">block {block?.toString() ?? "—"}</span>
        <span className="venueHint">
          {blocksLeft} {blocksLeft === 1 ? "block" : "blocks"} left in this window
        </span>
        {error && <span className="warn">{error}</span>}
      </div>

      <p className="venueCaption">
        This code is valid for {CHALLENGE_BLOCKS.toString()} blocks — about a second.
        Scan it from the room.
      </p>

      {VENUE_LEAD_WINDOWS > 0n && (
        <p className="venueCaption mono">
          aiming {VENUE_LEAD_WINDOWS.toString()} window ahead to cover network latency
        </p>
      )}
    </div>
  );
}

/** Blocks left in the current window, as a ring that empties. */
function CountdownRing({ fraction }: { fraction: number }) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;

  return (
    <svg className="venueRing" viewBox="0 0 100 100" aria-hidden>
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="var(--border)"
        strokeWidth="6"
      />
      <circle
        cx="50"
        cy="50"
        r={radius}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={circumference * (1 - fraction)}
        transform="rotate(-90 50 50)"
      />
    </svg>
  );
}
