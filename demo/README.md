<!-- ![No-Show demo](docs/demo.gif) -->
<!-- TODO: record the GIF — register on /, scan /checkin from a phone, card flips green -->

# No-Show — demo

The Monad Blitz Hyderabad build. One event, one page, working end to end.

**Registering authorises a hold that is never charged if you turn up — and
attendance is proven by landing a signed transaction inside a ~1.2-second window
against a code derived from the block number.**

> Looking for the SDK that platforms integrate? That's [`../enterprise/`](../enterprise/).

| | |
|---|---|
| Live | https://no-show-weld.vercel.app |
| Contract | [`0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2`](https://testnet.monadvision.com/address/0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2) |
| Network | Monad Testnet (`10143`) |
| Verification | Sourcify `exact_match` |

---

## The pitch

Kickback ran deposit-to-RSVP in 2018–19 and it stalled for two reasons, both in
their own repo: demanding a stake was a barrier to entry, and check-in was done
off-chain by an admin with a laptop. Don't pitch this as a new idea — pitch it as
the fix.

**Fix one, the barrier.** x402's `upto` scheme means you sign a maximum, not a
payment. Show up and it settles for **zero, with no on-chain transaction at all**.

**Fix two, the admin.** The challenge is `keccak256(eventId, block.number / 3)`,
checked on chain. Only valid for 3 blocks — about 1.2 seconds at Monad's 400ms
blocks. Nobody decides; the contract compares one value, and that single comparison
is the entire anti-farming mechanism.

---

## Routes

| Route | Who | What |
|---|---|---|
| `/` | attendee | Event page. Register, then scan to check in. |
| `/checkin` | venue | Fullscreen rotating QR, countdown ring, block number. Put this on a laptop. |
| `/manage` | organiser | Live guest list, stat bar, finalize. |
| `/api/register` | — | x402 `upto` authorisation intake |
| `/api/checkin` | — | verifies a mined check-in, settles the hold for zero |

Add `?debug=IDLE` (or `AUTHORIZING`, `REGISTERED`, `SCANNING`, `CHECKED_IN`,
`NO_SHOW`) to `/` to force any card state without running the flow — that's how the
screenshots get taken.

---

## Run it

```bash
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_NOSHOW_ADDRESS
npm run build && npm start
```

**You only need MON**, from [faucet.monad.xyz](https://faucet.monad.xyz). It pays
gas, and the hold is in Wrapped MON — the app wraps what it needs on your first
registration and it unwraps whenever you want.

### The demo, for real

1. **Laptop** → `/checkin`, fullscreen.
2. **Phone** → `/`, connect MetaMask, tap **Register**.
   It checks your balance, wraps MON, approves Permit2 once, signs the hold, and
   records it on chain. The first two steps only ever happen once per wallet.
3. Tap **Check in** and point the phone at the laptop screen.

> The camera needs HTTPS, so use the deployed URL on the phone. `localhost` counts
> as secure, so a laptop webcam works locally.

---

## Layout

```
demo/
├── app/
│   ├── page.tsx            the event page (?debug= lives here)
│   ├── checkin/            venue display
│   ├── manage/             organiser dashboard
│   ├── api/register/       x402 402 → verify → store hold
│   ├── api/checkin/        verify receipt → settle for zero
│   └── tokens.css          every colour and size in the app
├── components/
│   ├── RegistrationCard    one card, six states, one `status` prop
│   ├── Scanner             BarcodeDetector, jsQR fallback
│   ├── VenueDisplay        rotating QR + countdown ring
│   ├── CommitPill          Proposed / Voted / Finalized
│   └── NetworkGuard        switches the wallet to Monad automatically
├── lib/
│   ├── chain.ts            viem client for Monad Testnet
│   ├── x402.ts             server: requirements, verify, settle
│   ├── x402-client.ts      browser: Permit2, wrapping, signing
│   ├── gas.ts              measured limits, and why they are hardcoded
│   └── useNoShow.ts        the whole attendee flow
└── contracts/
    ├── src/NoShow.sol      single event, single admin
    └── test/NoShow.t.sol   8 tests
```

### Ground truth documents

`CLAUDE.md`, `MONAD.md`, `X402.md`, `SPEC.md` and `DESIGN.md` are the build's source
of truth for network details, SDK versions, product scope and the visual system.
Where they and this README disagree, they win.

---

## Contract

```solidity
register(bytes32 eventId, uint40 holdUsdc, bytes32 authRef)
checkIn(bytes32 eventId, bytes32 challenge)   // reverts StaleChallenge outside the window
finalize(bytes32 eventId, address[] noShows)  // organiser only
payout(bytes32 eventId, address[] recipients, uint40 amountEach)
screen(bytes32 eventId, address who)          // everything one screen needs
```

`Attendee` packs into a single 32-byte slot — 18 bytes used, proven with
`forge inspect NoShow storageLayout --json` rather than counted by hand.

```bash
cd contracts && forge test          # 8 tests
cd .. && npm run smoke -- <address> # prints currentChallenge() twice, 2s apart
```

`npm run smoke` exits non-zero if the challenge does *not* rotate — at 400ms blocks
two seconds is roughly five blocks, so a match would mean the anti-farming window
is not working.

Deploy and verification commands are in [DEPLOY.md](DEPLOY.md). Note the bare
Sourcify command from MONAD.md fails; the working one is documented there.

---

## Things that will bite you

Collected from actually hitting them.

**MON is not USDC.** Early versions denominated the hold in testnet USDC, and
nobody could fund it — Circle's faucet gives 1 USDC per pair every two hours. `upto`
settles through Permit2, and Permit2 moves any ERC-20, so the asset was never fixed
by the protocol. Verified against the live facilitator: an `upto` authorisation for
WMON returns `isValid: true`.

**MetaMask cannot sign a detached transaction.** `eth_signTransaction` is not
implemented, only `personal_sign` and `eth_signTypedData_v4`. So the attendee's
wallet *sends* `checkIn` and posts the hash; the server verifies the receipt. Any
design where the browser hands a serialised signed transaction to a server to
broadcast cannot work with an injected wallet.

**A blank env var is worse than a missing one.** `NEXT_PUBLIC_WC_PROJECT_ID=` is an
empty string, not `undefined`, so `??` passes it straight through and RainbowKit
throws during prerender. `lib/config.ts` uses `||` and degrades instead.

**Never estimate gas on the check-in path.** `cast send` estimates before
broadcasting, and that one extra round trip made three consecutive attempts fail
with `StaleChallenge` before the transaction was even signed.

**Monad charges the gas limit.** A reverted `checkIn` at a 200,000 limit reported
`gasUsed: 200000`. A receipt cannot tell you your margin, so a successful
transaction at a given limit is the only real evidence a limit is high enough.

**`/manage` never backfills.** Rows come from an `eth_subscribe` subscription
because the public RPC caps `eth_getLogs` at 100 blocks. Open it *before*
registrations start, or the list looks empty while the counters stay correct.

---

## Honest limitations

**The challenge proves liveness, not presence.** It is a pure function of public
inputs, so anyone anywhere can compute the current code without seeing the screen.
What is enforced is that a check-in landed inside a ~1.2-second window — it cannot
be batched or backdated. Say that version on stage.

**The venue display shows the next window.** A check-in with everything optimised
still mined three blocks late and reverted. All public RPCs are 275–300ms away, so
the display aims one window ahead. Tunable with `NEXT_PUBLIC_VENUE_LEAD`.

**Holds live in a module-level Map.** No database, per spec. That does not survive a
serverless cold start, so a check-in can be real on chain while the settlement is
skipped — `/api/checkin` returns `202` and says so rather than reporting a false
failure. [`../enterprise/`](../enterprise/) fixes this with a real store.

**`finalize` is trusted.** The organiser calls it. Check-in is not trusted.

**One address is deployer, admin and payee.** A hackathon simplification; in
anything real these are three keys.
