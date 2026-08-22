/**
 * @noshow/core — deposit-free RSVP with on-chain proof of attendance.
 *
 * Framework-agnostic. No React, no Next, no bundler assumptions: any Node service
 * can install this and integrate at the codebase level.
 *
 * Quickstart:
 *
 *   import { NoShowClient, MemoryStore } from "@noshow/core";
 *
 *   const noshow = new NoShowClient({
 *     registry: "0x1d3eDAfc7d029f51eb208E1d28FD2ce3a17b8112",
 *     store: new MemoryStore(),
 *     organiser: privateKeyToAccount(process.env.ORGANISER_KEY),
 *     baseUrl: "https://your-app.example",
 *   });
 *
 *   const eventId = noshow.eventIdFor("tenant-1", "my-event");
 *   await noshow.createEvent(eventId);
 *   const intent = await noshow.createHoldIntent({ tenantId: "tenant-1", eventId });
 *   // send the attendee to intent.holdUrl
 */
export { NoShowClient } from "./client.js";
export { noShowRegistryAbi } from "./abi.js";
export { challengeAtBlock, challengeForWindow, windowOf, blocksLeftInWindow, venueChallenge, deriveEventId, } from "./challenge.js";
export { GAS, batchGas } from "./gas.js";
export { CHALLENGE_BLOCKS, COMMIT_STATES, DEFAULT_VENUE_LEAD_WINDOWS, MONAD_FACILITATOR_URL, MONAD_TESTNET_EXPLORER, MONAD_TESTNET_RPC, MONAD_TESTNET_USDC, MONAD_TESTNET_WS, MONAD_TESTNET_X402, PERMIT2, USDC_ASSET, WMON_ASSET, WRAPPED_MON, monadTestnetChain, } from "./config.js";
export { MemoryStore, RedisStore } from "./store/index.js";
export { SIGNATURE_HEADER, TIMESTAMP_HEADER, ID_HEADER, signWebhook, verifyWebhook, deliverWebhook, } from "./webhooks.js";
export { createX402Server, toBaseUnits } from "./x402/server.js";
