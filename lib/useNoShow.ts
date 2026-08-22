"use client";

import { useCallback, useEffect, useState } from "react";
import { formatUnits, type Hex } from "viem";
import { useAccount, useWalletClient } from "wagmi";
import { publicClient } from "@/lib/chain";
import { CHALLENGE_BLOCKS, EVENT_ID, HOLD_USDC_6DP } from "@/lib/config";
import { noShowAbi, requireAddress, STATUS } from "@/lib/contract";
import { GAS } from "@/lib/gas";
import type { RegistrationStatus } from "@/lib/registration";
import {
  needsPermit2Approval,
  permit2ApprovalTx,
  signPaymentHeader,
  usdcBalance,
} from "@/lib/x402-client";

/** Map the contract's status byte onto the card's states — DESIGN.md §5. */
function statusFromChain(status: number): RegistrationStatus {
  if (status === STATUS.CHECKED_IN) return "CHECKED_IN";
  if (status === STATUS.NO_SHOW) return "NO_SHOW";
  if (status === STATUS.REGISTERED) return "REGISTERED";
  return "IDLE";
}

export type Progress =
  | null
  | "Checking your USDC balance…"
  | "Checking Permit2 allowance…"
  | "Approve Permit2 (one time)…"
  | "Requesting payment terms…"
  | "Sign the hold — no money moves…"
  | "Recording registration on chain…"
  | "Submitting check-in…"
  | "Releasing hold for $0…";

export function useNoShow() {
  const { address, isConnected } = useAccount();
  const { data: wallet } = useWalletClient();

  const [status, setStatus] = useState<RegistrationStatus>("IDLE");
  const [progress, setProgress] = useState<Progress>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{
    hash: Hex;
    settled: string;
    blockNumber: bigint | null;
  } | null>(null);

  /** The chain is the source of truth for whether someone is registered. */
  const refresh = useCallback(async () => {
    if (!address) return;
    try {
      const [attendee] = await publicClient.readContract({
        address: requireAddress(),
        abi: noShowAbi,
        functionName: "screen",
        args: [EVENT_ID, address],
      });
      setStatus(statusFromChain(Number(attendee.status)));
    } catch {
      // A missing NEXT_PUBLIC_NOSHOW_ADDRESS or a cold RPC should not blank the UI.
    }
  }, [address]);

  useEffect(() => {
    if (isConnected) void refresh();
  }, [isConnected, refresh]);

  /**
   * Register: authorise an `upto` hold, then record it on chain.
   *
   * Both halves are needed. The x402 authorisation is what holds the money, but
   * `checkIn` reverts `NotRegistered` unless `register()` has actually run, so the
   * on-chain call is not optional bookkeeping — it is what makes check-in possible.
   */
  const register = useCallback(async () => {
    if (!wallet || !address) {
      setError("Connect a wallet first.");
      return;
    }
    setError(null);
    setStatus("AUTHORIZING");

    try {
      // 0. Do we hold enough USDC to back the hold at all?
      //    MON is the gas token and is irrelevant here. Without this check the
      //    facilitator rejects at /verify and the reason is unrecoverable from
      //    the response.
      setProgress("Checking your USDC balance…");
      const balance = await usdcBalance(address);
      if (balance < BigInt(HOLD_USDC_6DP)) {
        throw new Error(
          `You hold ${formatUnits(balance, 6)} USDC but the hold needs $2. ` +
            "Note MON is the gas token, not this — claim testnet USDC at " +
            "faucet.circle.com with Monad Testnet selected.",
        );
      }

      // 1. Permit2 approval. `upto` is Permit2-only; without this the facilitator
      //    answers 412 PRECONDITION_FAILED. One transaction, once per wallet.
      setProgress("Checking Permit2 allowance…");
      if (await needsPermit2Approval(address)) {
        setProgress("Approve Permit2 (one time)…");
        const approval = permit2ApprovalTx();
        const approvalHash = await wallet.sendTransaction({
          account: address,
          chain: wallet.chain,
          to: approval.to,
          data: approval.data,
        });
        await publicClient.waitForTransactionReceipt({ hash: approvalHash });
      }

      // 2. Ask for terms. A 402 here is the protocol working, not an error.
      setProgress("Requesting payment terms…");
      const challenge = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: EVENT_ID }),
      });
      if (challenge.status !== 402) {
        throw new Error(`Expected a 402 with payment terms, got ${challenge.status}.`);
      }
      const paymentRequired = await challenge.json();

      // 3. Sign the maximum. This is a signature, not a payment — nothing moves.
      setProgress("Sign the hold — no money moves…");
      const header = await signPaymentHeader(paymentRequired, wallet, address);

      const paid = await fetch("/api/register", {
        method: "POST",
        headers: { "content-type": "application/json", "payment-signature": header },
        body: JSON.stringify({ eventId: EVENT_ID }),
      });
      const result = await paid.json();
      if (!paid.ok) throw new Error(result?.error ?? "Registration was rejected.");

      // 4. Record it on chain so checkIn has something to find.
      setProgress("Recording registration on chain…");
      const hash = await wallet.writeContract({
        account: address,
        chain: wallet.chain,
        address: requireAddress(),
        abi: noShowAbi,
        functionName: "register",
        args: [EVENT_ID, HOLD_USDC_6DP, result.authRef as Hex],
        gas: GAS.REGISTER,
      });
      await publicClient.waitForTransactionReceipt({ hash });

      setStatus("REGISTERED");
    } catch (cause) {
      setStatus("IDLE");
      setError(readableError(cause));
    } finally {
      setProgress(null);
    }
  }, [wallet, address]);

  /**
   * Check in with a challenge scanned off the venue screen.
   *
   * Deliberately does no RPC read first. The challenge comes from the QR, so the
   * only latency between scanning and submitting is the wallet confirmation — and
   * the window is three blocks, which on Monad is under a second and a half.
   */
  const checkIn = useCallback(
    async (challenge: Hex) => {
      if (!wallet || !address) {
        setError("Connect a wallet first.");
        return;
      }
      setError(null);
      setProgress("Submitting check-in…");

      try {
        const hash = await wallet.writeContract({
          account: address,
          chain: wallet.chain,
          address: requireAddress(),
          abi: noShowAbi,
          functionName: "checkIn",
          args: [EVENT_ID, challenge],
          gas: GAS.CHECK_IN,
        });

        setProgress("Releasing hold for $0…");
        const response = await fetch("/api/checkin", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: EVENT_ID, challenge, transactionHash: hash }),
        });
        const result = await response.json();
        if (!response.ok && response.status !== 202) {
          throw new Error(result?.error ?? "Check-in could not be confirmed.");
        }

        setReceipt({
          hash,
          settled: result?.settlement?.amount ?? "0",
          // The route reports the block it mined in; the CommitPill tracks that block
          // through Proposed -> Voted -> Finalized.
          blockNumber: result?.blockNumber ? BigInt(result.blockNumber) : null,
        });
        setStatus("CHECKED_IN");
      } catch (cause) {
        setStatus("REGISTERED");
        setError(readableError(cause));
      } finally {
        setProgress(null);
      }
    },
    [wallet, address],
  );

  return {
    address,
    isConnected,
    status,
    setStatus,
    progress,
    error,
    setError,
    receipt,
    register,
    checkIn,
    refresh,
    challengeBlocks: CHALLENGE_BLOCKS,
  };
}

/**
 * Decode the custom error rather than showing a wall of hex.
 * CLAUDE.md: every write path needs a visible error state with the decoded error.
 */
function readableError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);

  if (raw.includes("StaleChallenge")) {
    return "That code expired — it is only valid for about a second. Scan the screen again.";
  }
  if (raw.includes("AlreadyCheckedIn")) return "You are already checked in.";
  if (raw.includes("NotRegistered")) return "Register before checking in.";
  if (raw.includes("AlreadyRegistered")) return "This wallet is already registered.";
  if (raw.includes("EventClosed")) return "The organiser has closed this event.";
  if (raw.includes("NotOrganiser")) return "Only the organiser can do that.";
  if (/User rejected|denied|rejected the request/i.test(raw)) {
    return "You rejected the request in your wallet.";
  }
  if (raw.includes("insufficient funds")) {
    return "Not enough MON for gas. Top up at faucet.monad.xyz.";
  }
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}
