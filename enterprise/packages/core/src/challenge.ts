import { encodePacked, keccak256, type Hex } from "viem";
import { CHALLENGE_BLOCKS, DEFAULT_VENUE_LEAD_WINDOWS } from "./config.js";

/**
 * Check-in challenge derivation.
 *
 * This mirrors `NoShowRegistry.currentChallenge` exactly:
 *
 *   keccak256(abi.encodePacked(eventId, block.number / CHALLENGE_BLOCKS))
 *
 * Deriving it locally rather than reading it per block matters. The venue display
 * refreshes several times a second, and the public RPC caps eth_call at 25rps —
 * so asking the chain for a value we can compute is both slower and rate-limited.
 *
 * WHAT THIS PROVES, AND WHAT IT DOES NOT
 *
 * The challenge is a pure function of the event id and the block number, and both
 * are public. Anyone, anywhere, can compute the current code without ever seeing
 * the venue screen. What the contract enforces is that a check-in LANDED inside a
 * three-block window — about a second — so it cannot be batched, backdated or done
 * in advance. That is liveness, not physical presence. Proving presence would
 * require the venue to inject a secret the contract can verify, which this design
 * deliberately does not do. Say the honest version out loud.
 */

/** Compute the challenge for a specific block. */
export function challengeAtBlock(eventId: Hex, blockNumber: bigint): Hex {
  return keccak256(
    encodePacked(["bytes32", "uint256"], [eventId, blockNumber / CHALLENGE_BLOCKS]),
  );
}

/** Compute the challenge for a window index directly. */
export function challengeForWindow(eventId: Hex, window: bigint): Hex {
  return keccak256(encodePacked(["bytes32", "uint256"], [eventId, window]));
}

/** The window index a block falls in. */
export function windowOf(blockNumber: bigint): bigint {
  return blockNumber / CHALLENGE_BLOCKS;
}

/** Blocks remaining in the window containing `blockNumber` — 3, 2 or 1. */
export function blocksLeftInWindow(blockNumber: bigint): number {
  return Number(CHALLENGE_BLOCKS - (blockNumber % CHALLENGE_BLOCKS));
}

/**
 * What the venue display should show right now.
 *
 * Aimed `lead` windows ahead of the current block. See DEFAULT_VENUE_LEAD_WINDOWS
 * for the measurement behind the default: without a lead, a check-in submitted the
 * instant a code appears still mines after the window has closed.
 */
export function venueChallenge(
  eventId: Hex,
  blockNumber: bigint,
  lead: bigint = DEFAULT_VENUE_LEAD_WINDOWS,
): Hex {
  return challengeForWindow(eventId, windowOf(blockNumber) + lead);
}

/**
 * Namespace an external event id so two tenants cannot collide on the registry.
 *
 * The contract lets anyone create an event under any id they choose, so ids must
 * be derived rather than picked. `keccak256(tenantId, externalId)` makes a
 * collision equivalent to finding a hash collision.
 */
export function deriveEventId(tenantId: string, externalEventId: string): Hex {
  return keccak256(
    encodePacked(["string", "string", "string"], [tenantId, ":", externalEventId]),
  );
}
