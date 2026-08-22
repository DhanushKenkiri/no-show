"use client";

import { RegistrationCard, Scanner, useHold } from "@noshow/react";
import { useCallback, useState } from "react";
import type { Address, Hex } from "viem";
import { useAccount, useConnect } from "wagmi";

export function HoldClient({
  intentId,
  eventId,
  registry,
  holdAmount,
  assetSymbol,
  guestName,
}: {
  intentId: string;
  eventId: Hex;
  registry: Address;
  holdAmount: number;
  assetSymbol: string;
  guestName: string | null;
}) {
  const { status, progress, error, setError, register, checkIn, isConnected } = useHold({
    registry,
    eventId,
    intentId,
    holdAmount,
  });
  const { connect, connectors } = useConnect();
  const { address } = useAccount();
  const [scanning, setScanning] = useState(false);

  const onChallenge = useCallback(
    (challenge: Hex) => {
      setScanning(false);
      void checkIn(challenge);
    },
    [checkIn],
  );

  const injected = connectors[0];

  return (
    <>
      <h1>{guestName ? `Hi ${guestName}` : "Confirm your spot"}</h1>
      <p className="muted">
        Registering holds {holdAmount} {assetSymbol}. Turn up and it is released for
        zero — your money never moves, because no transaction is ever written.
      </p>

      <div style={{ margin: "24px 0" }}>
        {isConnected ? (
          <span className="dim" style={{ fontFamily: "ui-monospace, monospace", fontSize: 13 }}>
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </span>
        ) : (
          <button
            type="button"
            className="ns-btn ns-btn-ghost"
            onClick={() => injected && connect({ connector: injected })}
          >
            Connect wallet
          </button>
        )}
      </div>

      <RegistrationCard
        status={scanning ? "SCANNING" : status}
        holdLabel={`${holdAmount} ${assetSymbol}`}
        progress={progress}
        error={error}
        connected={isConnected}
        viewfinder={scanning ? <Scanner onChallenge={onChallenge} /> : null}
        onRegister={() => {
          setError(null);
          void register();
        }}
        onScan={() => {
          setError(null);
          setScanning(true);
        }}
        onCancel={() => setScanning(false)}
      />

      <h2>How check-in works</h2>
      <p className="muted">
        The venue screen shows a code derived from the current block number. It is
        only valid for three blocks — about a second — so a check-in has to happen
        live, while the chain is watching. It cannot be batched, backdated or done
        in advance.
      </p>
    </>
  );
}
