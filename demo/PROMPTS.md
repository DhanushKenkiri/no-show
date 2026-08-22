# The prompt sequence — No-Show

One at a time. Verify each before the next. `git add -A && git commit` before every
one — that is your undo button.

---

## 0 — kickoff (H0:00–0:25)
> Read CLAUDE.md, MONAD.md, X402.md, SPEC.md and DESIGN.md in full before doing anything.
>
> Then do ONLY this: scaffold. Next.js 15 App Router, TypeScript, Tailwind at the
> root; `contracts/` initialised for Foundry. Install viem, @x402/core, @x402/evm
> pinned to exactly 2.22.0, @x402/fetch, @x402/next, jsqr. Create `app/tokens.css`
> with the tokens from DESIGN.md §1 and import it in the root layout. Create
> `lib/chain.ts` (viem publicClient for Monad Testnet) and `lib/gas.ts` with an empty
> GAS object and a comment on why we hardcode limits.
>
> No components, routes, contracts or business logic yet. Tell me the exact commands
> to verify, and confirm @x402/evm resolved to exactly 2.22.0.

**Verify:** `npm ls @x402/evm` → 2.22.0. **Cutoff 25 min.**

## 1 — contract (H0:25–1:05)
> Write `contracts/src/NoShow.sol` exactly to SPEC.md. Then `contracts/test/NoShow.t.sol`
> testing only: register sets status 1 and increments registeredCount; checkIn with the
> current challenge succeeds and increments checkedInCount; checkIn with a challenge
> from 4 blocks ago reverts StaleChallenge; checkIn twice reverts AlreadyCheckedIn;
> finalize marks a no-show and emits HoldCharged.
>
> Run `forge inspect NoShow storageLayout` and paste the output to prove Attendee is
> one slot. Do not tell me it is packed without showing me.

**Verify:** `forge test` green, `vm.roll()` used for the stale-challenge test. **Cutoff 40 min.**

## 2 — deploy + Vercel (H1:05–1:25)
> Deploy script, keystore-based `forge create` command, and the verify command from
> MONAD.md. Then `lib/contract.ts` importing the ABI from
> `contracts/out/NoShow.sol/NoShow.json` — never hand-written. Plus `scripts/smoke.ts`
> that prints `currentChallenge()` twice, two seconds apart, so I can see it rotate.

**Then deploy to a host with HTTPS immediately.** Camera needs HTTPS. Not at hour five.

**Status: done.** Contract at `0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2`, Sourcify
`exact_match`. AWS was evaluated and rejected — the account has no Amplify or App
Runner access, and plain EC2 gives no TLS, so it was 20–45 minutes for nothing the
demo can see. Vercel instead. Both paths are written up in DEPLOY.md.

## 3 — x402 upto register (H1:25–2:25) ← RISKIEST
> Build `/api/register` using the x402 **upto** scheme per X402.md, and
> `/api/checkin` which verifies the challenge, settles the hold for $0, and calls
> checkIn on chain with a hardcoded gas limit.
>
> Register the testnet USDC money parser exactly as in X402.md — testnet USDC is not
> in the SDK's built-in asset table. Give me a curl that shows the 402 response.

**Cutoff 60 min.** If upto is still failing at 2:25, switch to `exact` per SPEC.md
and move on. Losing the "$0, no transaction" line hurts; losing the demo is fatal.

## 4 — the event page + registration card (H2:25–3:30)
> Build `/` per DESIGN.md: the shell components (§4 items 1–10) and the
> RegistrationCard with all six states from §5, driven by one `status` prop. Add a
> `?debug=state` query param that forces any state.
>
> Mobile-first, sticky bottom action bar below 640px. Assets in `public/assets/` with
> the names from DESIGN.md §7. Background per §6 — static on mobile, none on camera
> routes.

**Verify:** all six states screenshot-able via `?debug=state` on a real phone.

## 5 — venue display + scan (H3:30–4:20)
> Build `/checkin`: fullscreen, one enormous QR of `currentChallenge()`, refreshed
> every block, with a countdown ring showing blocks left in the window and the block
> number in mono.
>
> On `/`, the SCANNING state opens the camera (BarcodeDetector, jsqr fallback,
> facingMode environment), reads the challenge, and POSTs to /api/checkin.

**Verify: laptop showing `/checkin`, phone scans it, card flips to Checked In.
THE DEMO NOW WORKS. Stop adding features.**

## 6 — manage + commit pill (H4:20–4:50)
> `/manage`: live guest list with status chips and the StatBar, fed by a WebSocket
> subscription to Registered and CheckedIn — never eth_getLogs backfill. A finalize
> button that charges outstanding holds.
>
> Add the CommitPill from DESIGN.md §4.13 to the CHECKED_IN state: read at blockTag
> latest, safe and finalized concurrently with Promise.all, fill three dots, show
> elapsed ms.

## 7 — README + freeze (H4:50–5:20)
> README: the Kickback framing from SPEC.md in three sentences, then the two fixes,
> then the honest limitations. Contract address, verified explorer link, live URL,
> placeholder for the GIF at the top.

**After 5:20 no new code.** Rehearse three times on tethering with the laptop and
phone you'll actually use. Screenshot all six states via `?debug=state`. Record the GIF.

---

## The demo, 3 minutes

1. "Kickback tried this in 2018. It stalled for two reasons, both in their own repo."
2. Show `/` on the projector. Register live. **"That was a signature, not a payment.
   Nothing moved."**
3. Put `/checkin` on the big screen. Point out the QR changing every 1.2 seconds.
4. Scan it with your phone. Card flips green. **"Hold released. Zero settled. No
   transaction was ever written."**
5. `/manage` — counts move live. Finalize. One no-show row (your own avatar) turns red.
6. "You had to be in the room. Not because someone ticked you off a list — because
   the code only existed for 1.2 seconds, and the chain checked."
