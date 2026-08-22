# No-Show — build rules

You are helping build a hackathon project in a fixed time window. Read this file,
MONAD.md, X402.md and SPEC.md before writing any code.

## Ground truth — this overrides your training data

- MONAD.md and X402.md are authoritative for all network, SDK and version details.
  Your training data is older than the current network and the current x402 SDK.
  If your memory disagrees with these files, THE FILES WIN. Do not "correct" them.
- If you need a fact not in those files, fetch https://docs.monad.xyz/llms.txt and
  follow the relevant link. Do not guess an RPC URL, contract address, chain ID,
  package version, or API signature. A wrong guess here costs an hour to find.
- SPEC.md defines the product. DESIGN.md defines the visual system. If a request
  conflicts with either, say so before building.
- There is no Handshake in this project. If you find any reference to trading a
  physical object, buyers, or sellers, it is stale — flag it, do not build it.

## Hard constraints

- Chain: Monad Testnet, chain ID 10143. Never mainnet unless I say so explicitly.
- Chain library: **viem only.** No ethers, no wagmi, no RainbowKit, no thirdweb,
  no web3.js. If you think you need one, tell me why instead of adding it.
- x402: pin `@x402/evm` to exactly `2.22.0` in package.json. Not `^2.22.0`.
  See X402.md for why — older versions fail silently at settlement.
- No database. Contract state, x402 settlement receipts, and an in-memory server
  Map are the only stores. No Prisma, no Postgres, no Supabase.
- Never call `eth_estimateGas` in a user-facing path. All gas limits are hardcoded
  constants in `lib/gas.ts` with a comment recording when they were measured.
  Monad charges the gas LIMIT, not gas used.
- Never fetch history with `eth_getLogs` over a wide range. The public RPC caps the
  range at 100 blocks. Use a WebSocket subscription for live events and read
  contract state for totals.
- Never write a global counter (`totalTrades++`) that every transaction touches.
  It serialises otherwise-parallel transactions. Shard per address or derive it
  from events.
- ABIs are imported from Foundry artifacts (`contracts/out/*.json`). Never
  hand-write or paste an ABI.
- Do not modify `contracts/src/NoShow.sol` once I tell you it is deployed.
  Changing it silently breaks the ABI match with the deployed bytecode.

## Solidity style

- Custom errors, never `require(cond, "string")`.
- Pack structs to exactly 32 bytes and prove it with `forge inspect NoShow
  storageLayout` before telling me it is packed. Do not eyeball byte counts.
- `unchecked { ++i }` in loops.
- Index only the event fields that will be filtered on.
- One view function per UI screen that returns everything that screen needs.
- No proxies, no pausable, no OpenZeppelin AccessControl. A single `admin`
  address is the correct amount of structure here.

## Working style

- **One task at a time.** Do exactly what I asked and stop. Do not build ahead.
- End every task with: the exact command to run, and what I should see if it
  worked. "Done" is not an acceptable ending.
- If something is ambiguous, ask one question rather than assuming.
- If you are unsure whether an API exists, say so instead of inventing a
  signature. I would rather check the docs than debug a hallucination.
- Never refactor code I have not asked you to touch.
- Mobile-first. This is demoed on two phones in a bright, loud room. Big type,
  high contrast, tap targets over 48px. No hover-only affordances.
- Every write path needs a visible error state with the decoded custom error.
  Not a console.log.

## Visual work

- Components reference CSS variables from `app/tokens.css` only. Never a literal hex
  value or px value anywhere else. This is what makes the late restyle a one-file
  edit instead of a rewrite.
- No `box-shadow` anywhere in this app. Structure comes from hairline borders and
  translucent fills.
- Never run a WebGL canvas on a route that opens the camera. It stutters the preview
  and drains the battery we need for the demo.
