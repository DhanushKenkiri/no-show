"use client";

import {
  GAS,
  PERMIT2,
  WMON_ASSET,
  noShowRegistryAbi,
  type AssetConfig,
} from "@noshow/core";
import { useCallback, useEffect, useState } from "react";
import { formatUnits, type Address, type Hex } from "viem";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";

/**
 * The attendee-side flow.
 *
 * Everything a wallet has to do lives here, so an integrator's page is markup.
 * The order is forced by the protocol, not by preference:
 *
 *   0. Does this wallet hold enough of the asset? If it wraps the native token,
 *      top up from the native balance rather than failing.
 *   1. Permit2 approval — `upto` is Permit2-only, once per wallet ever.
 *   2. Ask for terms; a 402 here is the protocol working, not an error.
 *   3. Sign the maximum. A signature, not a payment: nothing moves.
 *   4. Record it on chain, or `checkIn` will revert NotRegistered.
 *
 * Step 4 is not bookkeeping. The contract's checkIn requires STATUS_REGISTERED,
 * so skipping the on-chain register makes every subsequent check-in impossible.
 */

export type HoldStatus =
  | "IDLE"
  | "AUTHORIZING"
  | "REGISTERED"
  | "SCANNING"
  | "CHECKED_IN"
  | "NO_SHOW";

export type HoldProgress = string | null;

export type UseHoldOptions = {
  /** Deployed NoShowRegistry. */
  registry: Address;
  /** On-chain event id, from `noshow.eventIdFor(tenant, externalId)`. */
  eventId: Hex;
  /** Hold intent this page is for. */
  intentId: string;
  /** Where the API routes live. Default same-origin. */
  apiBase?: string;
  asset?: AssetConfig;
  /** Hold size in whole units. Must match the server's configuration. */
  holdAmount?: number;
};

const STATUS_REGISTERED = 1;
const STATUS_CHECKED_IN = 2;
const STATUS_NO_SHOW = 3;

const erc20Abi = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "allowance", type: "function", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
  { name: "approve", type: "function", stateMutability: "nonpayable", inputs: [{ type: "address" }, { type: "uint256" }], outputs: [{ type: "bool" }] },
  { name: "deposit", type: "function", stateMutability: "payable", inputs: [], outputs: [] },
] as const;

export function useHold(options: UseHoldOptions) {
  const asset = options.asset ?? WMON_ASSET;
  const holdAmount = options.holdAmount ?? 0.5;
  const apiBase = (options.apiBase ?? "").replace(/\/$/, "");

  const { address, isConnected } = useAccount();
  const { data: wallet } = useWalletClient();
  const publicClient = usePublicClient();

  const [status, setStatus] = useState<HoldStatus>("IDLE");
  const [progress, setProgress] = useState<HoldProgress>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ hash: Hex; blockNumber: bigint | null } | null>(null);

  const holdBaseUnits = BigInt(Math.round(holdAmount * 10 ** 6)) * 10n ** BigInt(asset.decimals - 6);

  /** The chain is the source of truth for whether someone is registered. */
  const refresh = useCallback(async () => {
    if (!address || !publicClient) return;
    try {
      const result = await publicClient.readContract({
        address: options.registry,
        abi: noShowRegistryAbi,
        functionName: "screen",
        args: [options.eventId, address],
      });
      const attendee = (result as readonly unknown[])[0] as { status: number };
      const onChain = Number(attendee.status);
      setStatus(
        onChain === STATUS_CHECKED_IN
          ? "CHECKED_IN"
          : onChain === STATUS_NO_SHOW
            ? "NO_SHOW"
            : onChain === STATUS_REGISTERED
              ? "REGISTERED"
              : "IDLE",
      );
    } catch {
      // A cold RPC should never blank the UI.
    }
  }, [address, publicClient, options.registry, options.eventId]);

  useEffect(() => {
    if (isConnected) void refresh();
  }, [isConnected, refresh]);

  const register = useCallback(async () => {
    if (!wallet || !address || !publicClient) {
      setError("Connect a wallet first.");
      return;
    }
    setError(null);
    setStatus("AUTHORIZING");

    try {
      setProgress("Checking your balance…");
      let balance = (await publicClient.readContract({
        address: asset.address,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      if (balance < holdBaseUnits) {
        if (!asset.wrapsNative) {
          throw new Error(
            `You hold ${formatUnits(balance, asset.decimals)} ${asset.symbol} but the hold needs ${holdAmount}.`,
          );
        }
        // Permit2 moves ERC-20s and the native token is not one, so top up the
        // wrapped balance. Reversible: it unwraps whenever they want.
        const shortfall = holdBaseUnits - balance;
        const native = await publicClient.getBalance({ address });
        if (native < shortfall + 10_000_000_000_000_000n) {
          throw new Error(
            `You need ${holdAmount} ${asset.symbol} for the hold plus gas, ` +
              `but hold ${formatUnits(native, 18)}.`,
          );
        }

        setProgress(`Wrapping ${asset.symbol} so it can be held…`);
        const wrapHash = await wallet.writeContract({
          account: address,
          chain: wallet.chain,
          address: asset.address,
          abi: erc20Abi,
          functionName: "deposit",
          value: shortfall,
          gas: GAS.WRAP,
        });
        await publicClient.waitForTransactionReceipt({ hash: wrapHash });
        balance = holdBaseUnits;
      }

      setProgress("Checking Permit2 allowance…");
      const allowance = (await publicClient.readContract({
        address: asset.address,
        abi: erc20Abi,
        functionName: "allowance",
        args: [address, PERMIT2],
      })) as bigint;

      if (allowance < holdBaseUnits) {
        setProgress("Approve Permit2 (one time)…");
        const approveHash = await wallet.writeContract({
          account: address,
          chain: wallet.chain,
          address: asset.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [PERMIT2, (1n << 256n) - 1n],
          gas: GAS.APPROVE,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      setProgress("Requesting payment terms…");
      const terms = await fetch(`${apiBase}/api/v1/holds/${options.intentId}/authorize`, {
        method: "POST",
        headers: { "content-type": "application/json" },
      });
      if (terms.status !== 402) {
        throw new Error(`Expected a 402 with payment terms, got ${terms.status}.`);
      }
      const paymentRequired = await terms.json();

      setProgress("Sign the hold — no money moves…");
      // Imported lazily: the signing path pulls in the x402 client, and a page
      // that only displays a hold should not pay for that bundle.
      const { signPaymentHeader } = await import("./sign.js");
      const header = await signPaymentHeader(paymentRequired, wallet, address);

      const accepted = await fetch(`${apiBase}/api/v1/holds/${options.intentId}/authorize`, {
        method: "POST",
        headers: { "content-type": "application/json", "payment-signature": header },
      });
      const result = await accepted.json();
      if (!accepted.ok) throw new Error(result?.error ?? "Registration was rejected.");

      setProgress("Recording registration on chain…");
      const hash = await wallet.writeContract({
        account: address,
        chain: wallet.chain,
        address: options.registry,
        abi: noShowRegistryAbi,
        functionName: "register",
        args: [options.eventId, result.authRef as Hex],
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
  }, [wallet, address, publicClient, asset, holdAmount, holdBaseUnits, apiBase, options]);

  /**
   * Check in with a challenge scanned off the venue screen.
   *
   * No RPC read first, deliberately. The challenge comes from the QR, so the only
   * latency between scanning and submitting is the wallet confirmation — and the
   * window is about a second.
   */
  const checkIn = useCallback(
    async (challenge: Hex) => {
      if (!wallet || !address || !publicClient) {
        setError("Connect a wallet first.");
        return;
      }
      setError(null);
      setProgress("Submitting check-in…");

      try {
        const hash = await wallet.writeContract({
          account: address,
          chain: wallet.chain,
          address: options.registry,
          abi: noShowRegistryAbi,
          functionName: "checkIn",
          args: [options.eventId, challenge],
          gas: GAS.CHECK_IN,
        });

        setProgress("Releasing hold for zero…");
        const response = await fetch(`${apiBase}/api/v1/checkin`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ eventId: options.eventId, challenge, txHash: hash }),
        });
        const result = await response.json();
        if (!response.ok && response.status !== 202) {
          throw new Error(result?.error ?? "Check-in could not be confirmed.");
        }

        setReceipt({ hash, blockNumber: result?.blockNumber ? BigInt(result.blockNumber) : null });
        setStatus("CHECKED_IN");
      } catch (cause) {
        setStatus("REGISTERED");
        setError(readableError(cause));
      } finally {
        setProgress(null);
      }
    },
    [wallet, address, publicClient, apiBase, options],
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
  };
}

/**
 * Decode the custom error rather than showing a wall of hex.
 * Every write path needs a legible error state.
 */
export function readableError(cause: unknown): string {
  const raw = cause instanceof Error ? cause.message : String(cause);

  if (raw.includes("StaleChallenge")) {
    return "That code expired — it is only valid for about a second. Scan the screen again.";
  }
  if (raw.includes("AlreadyCheckedIn")) return "You are already checked in.";
  if (raw.includes("NotRegistered")) return "Register before checking in.";
  if (raw.includes("AlreadyRegistered")) return "This wallet is already registered.";
  if (raw.includes("EventClosed")) return "The organiser has closed this event.";
  if (raw.includes("EventNotFound")) return "That event does not exist on chain yet.";
  if (raw.includes("NotOrganiser")) return "Only the organiser can do that.";
  if (/User rejected|denied|rejected the request/i.test(raw)) {
    return "You rejected the request in your wallet.";
  }
  if (raw.includes("insufficient funds")) return "Not enough gas. Top up your wallet.";
  return raw.length > 200 ? `${raw.slice(0, 200)}…` : raw;
}
