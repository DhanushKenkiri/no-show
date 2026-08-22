"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPublicClient, getAddress, webSocket, type Address } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { chain, publicClient, WS_URL } from "@/lib/chain";
import { EVENT_ID, ORGANISER_ADDRESS } from "@/lib/config";
import { noShowAbi, requireAddress } from "@/lib/contract";
import { batchGas, GAS } from "@/lib/gas";

export type GuestState = "REGISTERED" | "CHECKED_IN" | "NO_SHOW";

export type Guest = {
  address: Address;
  state: GuestState;
  holdUsdc: bigint;
  at: number;
};

export type Totals = {
  registered: number;
  checkedIn: number;
  holdsReleased: number;
  holdsCharged: number;
};

/**
 * Live guest list.
 *
 * Rows come from a WebSocket subscription, never an eth_getLogs backfill: the
 * public RPC caps a log range at 100 blocks, so history is not something this app
 * is allowed to ask for. Totals come from contract state instead, which is both
 * authoritative and a single cheap read.
 *
 * The practical consequence is that this page only sees events from the moment it
 * connects. Open /manage BEFORE registrations start, or the list will look empty
 * while the counters are correct.
 */
export function useGuests() {
  const { address } = useAccount();
  const { data: wallet } = useWalletClient();

  const [guests, setGuests] = useState<Record<string, Guest>>({});
  const [counts, setCounts] = useState({ registered: 0, checkedIn: 0 });
  const [connected, setConnected] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isOrganiser =
    Boolean(address) && getAddress(address!) === getAddress(ORGANISER_ADDRESS);

  /** Aggregates from contract state — CLAUDE.md forbids deriving these from logs. */
  const refreshCounts = useCallback(async () => {
    try {
      const contract = requireAddress();
      const [registered, checkedIn] = await Promise.all([
        publicClient.readContract({
          address: contract,
          abi: noShowAbi,
          functionName: "registeredCount",
          args: [EVENT_ID],
        }),
        publicClient.readContract({
          address: contract,
          abi: noShowAbi,
          functionName: "checkedInCount",
          args: [EVENT_ID],
        }),
      ]);
      setCounts({ registered: Number(registered), checkedIn: Number(checkedIn) });
    } catch {
      // Leave the previous counts up rather than flashing zeros.
    }
  }, []);

  useEffect(() => {
    void refreshCounts();
    const timer = setInterval(() => void refreshCounts(), 4000);
    return () => clearInterval(timer);
  }, [refreshCounts]);

  useEffect(() => {
    let contract: Address;
    try {
      contract = requireAddress();
    } catch {
      setError("NEXT_PUBLIC_NOSHOW_ADDRESS is not set.");
      return;
    }

    const ws = createPublicClient({ chain, transport: webSocket(WS_URL) });
    setConnected(true);

    // poll:false forces eth_subscribe. With polling, viem would fall back to
    // eth_getLogs ranges, which is exactly what we are told never to do.
    const unwatchRegistered = ws.watchContractEvent({
      address: contract,
      abi: noShowAbi,
      eventName: "Registered",
      args: { eventId: EVENT_ID },
      poll: false,
      onLogs: (logs) => {
        setGuests((prev) => {
          const next = { ...prev };
          for (const log of logs) {
            const who = log.args.who;
            if (!who) continue;
            const key = getAddress(who);
            next[key] = {
              address: key,
              state: next[key]?.state === "CHECKED_IN" ? "CHECKED_IN" : "REGISTERED",
              holdUsdc: BigInt(log.args.holdUsdc ?? 0),
              at: Date.now(),
            };
          }
          return next;
        });
        void refreshCounts();
      },
      onError: () => setConnected(false),
    });

    const unwatchCheckedIn = ws.watchContractEvent({
      address: contract,
      abi: noShowAbi,
      eventName: "CheckedIn",
      args: { eventId: EVENT_ID },
      poll: false,
      onLogs: (logs) => {
        setGuests((prev) => {
          const next = { ...prev };
          for (const log of logs) {
            const who = log.args.who;
            if (!who) continue;
            const key = getAddress(who);
            next[key] = {
              address: key,
              state: "CHECKED_IN",
              holdUsdc: next[key]?.holdUsdc ?? 0n,
              at: Date.now(),
            };
          }
          return next;
        });
        void refreshCounts();
      },
      onError: () => setConnected(false),
    });

    const unwatchCharged = ws.watchContractEvent({
      address: contract,
      abi: noShowAbi,
      eventName: "HoldCharged",
      args: { eventId: EVENT_ID },
      poll: false,
      onLogs: (logs) => {
        setGuests((prev) => {
          const next = { ...prev };
          for (const log of logs) {
            const who = log.args.who;
            if (!who) continue;
            const key = getAddress(who);
            next[key] = {
              address: key,
              state: "NO_SHOW",
              holdUsdc: BigInt(log.args.amount ?? next[key]?.holdUsdc ?? 0),
              at: Date.now(),
            };
          }
          return next;
        });
      },
      onError: () => setConnected(false),
    });

    return () => {
      unwatchRegistered();
      unwatchCheckedIn();
      unwatchCharged();
      setConnected(false);
    };
  }, [refreshCounts]);

  const rows = useMemo(
    () => Object.values(guests).sort((a, b) => a.at - b.at),
    [guests],
  );

  const totals: Totals = useMemo(() => {
    const charged = rows.filter((g) => g.state === "NO_SHOW").length;
    return {
      registered: counts.registered,
      checkedIn: counts.checkedIn,
      holdsReleased: counts.checkedIn,
      holdsCharged: charged,
    };
  }, [rows, counts]);

  /** Charge every hold that never checked in, and close the event. */
  const finalize = useCallback(async () => {
    if (!wallet || !address) {
      setError("Connect the organiser wallet.");
      return;
    }
    const noShows = rows.filter((g) => g.state === "REGISTERED").map((g) => g.address);
    if (noShows.length === 0) {
      setError("Nobody is outstanding — everyone visible has checked in.");
      return;
    }

    setError(null);
    setFinalizing(true);
    try {
      const hash = await wallet.writeContract({
        account: address,
        chain: wallet.chain,
        address: requireAddress(),
        abi: noShowAbi,
        functionName: "finalize",
        args: [EVENT_ID, noShows],
        gas: batchGas(GAS.FINALIZE_BASE, noShows.length),
      });
      await publicClient.waitForTransactionReceipt({ hash });
      await refreshCounts();
    } catch (cause) {
      const raw = cause instanceof Error ? cause.message : String(cause);
      setError(
        raw.includes("NotOrganiser")
          ? "Only the organiser address can finalize."
          : raw.slice(0, 180),
      );
    } finally {
      setFinalizing(false);
    }
  }, [wallet, address, rows, refreshCounts]);

  return { rows, totals, connected, isOrganiser, finalize, finalizing, error };
}
