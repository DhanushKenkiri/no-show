/**
 * Proves the check-in challenge actually rotates.
 *
 * Reads currentChallenge() twice, two seconds apart. Monad blocks are ~400ms and
 * CHALLENGE_BLOCKS is 3, so two seconds is roughly five blocks — comfortably more
 * than one window. The two values MUST differ. If they match, either the chain is
 * not advancing or CHALLENGE_BLOCKS is wrong, and check-in has no anti-farming
 * property at all.
 *
 *   npm run smoke -- 0xYourDeployedAddress
 *   npm run smoke                              # uses NEXT_PUBLIC_NOSHOW_ADDRESS
 */
import { keccak256, toHex, type Address } from "viem";
import { noShowAbi } from "../lib/abi/noShow.ts";
import { publicClient } from "../lib/chain.ts";

const address = (process.argv[2] ?? process.env.NEXT_PUBLIC_NOSHOW_ADDRESS) as
  | Address
  | undefined;

if (!address) {
  console.error(
    "Usage: npm run smoke -- <deployed address>\n" +
      "   or: set NEXT_PUBLIC_NOSHOW_ADDRESS in the environment",
  );
  process.exit(1);
}

const EVENT_ID = keccak256(toHex("monad-blitz-hyderabad-v3"));

async function sample(label: string) {
  const [challenge, block] = await Promise.all([
    publicClient.readContract({
      address: address!,
      abi: noShowAbi,
      functionName: "currentChallenge",
      args: [EVENT_ID],
    }),
    publicClient.getBlockNumber(),
  ]);
  console.log(`${label}  block ${block}  ${challenge}`);
  return challenge;
}

console.log(`contract ${address}`);
console.log(`eventId  ${EVENT_ID}\n`);

const first = await sample("t=0s ");
await new Promise((r) => setTimeout(r, 2000));
const second = await sample("t=2s ");

console.log("");
if (first === second) {
  console.error("FAIL: challenge did not rotate in 2 seconds.");
  process.exit(1);
}
console.log("PASS: challenge rotated. A code read 2s ago is already worthless.");
