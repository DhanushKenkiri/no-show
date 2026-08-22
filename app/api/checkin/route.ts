import { encodePaymentResponseHeader } from "@x402/core/http";
import { NextResponse } from "next/server";
import {
  decodeEventLog,
  encodePacked,
  getAddress,
  isHex,
  keccak256,
  type Hex,
} from "viem";
import { publicClient } from "@/lib/chain";
import { noShowAbi, requireAddress } from "@/lib/contract";
import { getHold, normalizedPayer, type RegistrationHold } from "@/lib/holds";
import { getX402Server } from "@/lib/x402";

export const runtime = "nodejs";

const BYTES32 = /^0x[\da-fA-F]{64}$/;
const CHALLENGE_BLOCKS = BigInt(3);

type CheckInBody = {
  eventId?: unknown;
  challenge?: unknown;
  transactionHash?: unknown;
};

function isBytes32(value: unknown): value is Hex {
  return typeof value === "string" && BYTES32.test(value);
}

async function body(request: Request): Promise<CheckInBody | null> {
  try {
    const value: unknown = await request.json();
    return value !== null && typeof value === "object" ? (value as CheckInBody) : null;
  } catch {
    return null;
  }
}

function error(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Verify a mined checkIn transaction.
 *
 * The attendee's own wallet sent it, so `msg.sender` is genuinely them and the
 * server never holds an attendee key. We re-derive the challenge from the block
 * that actually executed the call: the contract already made this comparison, but
 * repeating it stops a receipt from somebody else's valid check-in being replayed
 * to release this hold.
 */
async function assertMinedCheckIn(transactionHash: Hex, eventId: Hex, challenge: Hex) {
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: transactionHash,
    confirmations: 1,
    timeout: 30_000,
  });
  const contractAddress = requireAddress();

  if (receipt.status !== "success") {
    throw new Error("The check-in transaction reverted on chain.");
  }
  if (!receipt.to || getAddress(receipt.to) !== getAddress(contractAddress)) {
    throw new Error("That transaction did not call the NoShow contract.");
  }

  const expectedChallenge = keccak256(
    encodePacked(
      ["bytes32", "uint256"],
      [eventId, receipt.blockNumber / CHALLENGE_BLOCKS],
    ),
  );
  if (expectedChallenge.toLowerCase() !== challenge.toLowerCase()) {
    throw new Error("The submitted challenge was stale when the transaction mined.");
  }

  const payer = normalizedPayer(receipt.from);

  const checkedIn = receipt.logs.some((log) => {
    if (getAddress(log.address) !== getAddress(contractAddress)) return false;
    try {
      const decoded = decodeEventLog({ abi: noShowAbi, data: log.data, topics: log.topics });
      return (
        decoded.eventName === "CheckedIn" &&
        decoded.args.eventId?.toLowerCase() === eventId.toLowerCase() &&
        decoded.args.who &&
        getAddress(decoded.args.who) === payer
      );
    } catch {
      return false;
    }
  });

  if (!checkedIn) {
    throw new Error("That transaction did not emit a CheckedIn event.");
  }

  return { receipt, payer };
}

/**
 * Release the hold for zero.
 *
 * This is the line the whole pitch rests on: settling an `upto` authorisation at
 * $0 moves no money and writes no transaction. The state machine exists because a
 * timed-out settlement is indeterminate — retrying could race one the facilitator
 * already accepted — so UNKNOWN is kept distinct from a plain failure.
 */
async function releaseHold(hold: RegistrationHold) {
  if (hold.state === "RELEASED" && hold.settlement) return hold.settlement;
  if (hold.state === "UNKNOWN") {
    throw new Error("The previous settlement timed out; its outcome is unknown.");
  }
  if (hold.settlementPromise) return hold.settlementPromise;

  hold.state = "RELEASING";
  hold.settlementPromise = (async () => {
    try {
      const x402 = await getX402Server();
      const settlement = await x402.settlePayment(
        hold.paymentPayload,
        hold.paymentRequirements,
        undefined,
        undefined,
        { amount: "0" },
      );
      if (!settlement.success) {
        hold.state = "AUTHORIZED";
        throw new Error(settlement.errorMessage ?? "The hold could not be released.");
      }
      hold.settlement = settlement;
      hold.state = "RELEASED";
      return settlement;
    } catch (cause) {
      if (hold.state === "RELEASING") hold.state = "UNKNOWN";
      throw cause;
    } finally {
      hold.settlementPromise = undefined;
    }
  })();

  return hold.settlementPromise;
}

/**
 * Confirm a check-in and release the hold for $0.
 *
 * The attendee's wallet sends the checkIn transaction itself — MetaMask cannot
 * produce a detached signed transaction (`eth_signTransaction` is unimplemented),
 * so the client sends it and posts us the hash. The chain is the source of truth
 * for whether the check-in happened; this route only verifies that and settles.
 */
export async function POST(request: Request) {
  const payload = await body(request);
  if (
    !payload ||
    !isBytes32(payload.eventId) ||
    !isBytes32(payload.challenge) ||
    typeof payload.transactionHash !== "string" ||
    !isHex(payload.transactionHash)
  ) {
    return error("eventId, challenge and transactionHash are required.");
  }

  const eventId = payload.eventId.toLowerCase() as Hex;
  const challenge = payload.challenge.toLowerCase() as Hex;
  const transactionHash = payload.transactionHash as Hex;

  let payer: ReturnType<typeof normalizedPayer>;
  let blockNumber: bigint;
  try {
    const mined = await assertMinedCheckIn(transactionHash, eventId, challenge);
    payer = mined.payer;
    blockNumber = mined.receipt.blockNumber;
  } catch (cause) {
    return error(cause instanceof Error ? cause.message : "Check-in failed.", 502);
  }

  const hold = getHold(eventId, payer);
  if (!hold) {
    // The check-in is real and on chain; only the $0 settlement cannot happen.
    // Say so precisely rather than implying the check-in failed.
    return NextResponse.json(
      {
        checkedIn: true,
        transactionHash,
        blockNumber: blockNumber.toString(),
        settlement: null,
        warning:
          "Checked in on chain, but no server-side hold was found for this wallet, " +
          "so nothing was settled. The in-memory hold store does not survive a " +
          "serverless cold start.",
      },
      { status: 202, headers: { "cache-control": "no-store" } },
    );
  }

  try {
    const settlement = await releaseHold(hold);
    return NextResponse.json(
      {
        checkedIn: true,
        transactionHash,
        blockNumber: blockNumber.toString(),
        settlement: {
          amount: settlement.amount ?? "0",
          transaction: settlement.transaction ?? null,
        },
      },
      {
        headers: {
          "payment-response": encodePaymentResponseHeader(settlement),
          "cache-control": "no-store",
        },
      },
    );
  } catch (cause) {
    return error(
      cause instanceof Error ? cause.message : "The hold could not be released.",
      502,
    );
  }
}
