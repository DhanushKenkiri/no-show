# No-Show

**Registering for an event authorises a small hold that is never charged if you turn
up — and attendance is proven by landing a signed transaction inside a ~1.2-second
window against a code derived from the block number.**

No deposit. No admin ticking names off a list. The money never moves.

---

## What's in this repo

This repository holds two related things. Start with whichever matches why you're
here.

| | | |
|---|---|---|
| 🎬 | **[`demo/`](demo/)** | The Monad Blitz hackathon build. One event, one page, end to end. **Start here to see it work.** |
| 🏗 | **[`enterprise/`](enterprise/)** | The product: an SDK and hosted service so platforms like Luma can offer this to their own users. |

```
No-Show/
├── demo/                  hackathon build — a complete, working event
│   ├── app/               Next.js routes: /, /checkin, /manage, APIs
│   ├── components/        registration card, scanner, venue display
│   ├── lib/               chain, x402, gas, contract bindings
│   └── contracts/         NoShow.sol — single event, single organiser
│
└── enterprise/            the product
    ├── packages/
    │   ├── core/          @noshow/core — framework-agnostic engine
    │   ├── adapters/      @noshow/adapters — Luma + generic REST
    │   └── react/         @noshow/react — drop-in components
    ├── service/           hosted multi-tenant API + hold page
    └── contracts/         NoShowRegistry.sol — many events, many organisers
```

---

## The idea in ninety seconds

This was built before. Kickback ran deposit-to-RSVP at DevCon, EthCC and ETHNewYork
in 2018–19, and it stalled for two reasons recorded in their own repository:
organisers found that demanding a stake was a barrier to entry, and check-in was
done off-chain by admins with a laptop, so a human decided who showed up.

**Both are fixed here.**

**The barrier.** x402's `upto` scheme means you sign a *maximum, not a payment*.
Turn up and it settles for **zero, with no on-chain transaction at all** — your
money never moved. It is a card hold, not a deposit.

**The admin.** The check-in code is `keccak256(eventId, block.number / 3)`,
evaluated on chain. A claim is only valid inside a 3-block window, which on Monad
is about 1.2 seconds. Nobody ticks you off a list; the contract compares one value.

```
  attendee                    venue screen                 chain
     │                             │                          │
     │  sign an upto hold ─────────┼──────────────────────────▶ register()
     │  (a signature, no tx)       │                          │
     │                             │  QR of the current       │
     │                             │  code, rotating ~1.2s    │
     │  scan  ◀────────────────────┤                          │
     │  send checkIn(code) ────────┼──────────────────────────▶ checkIn()
     │                             │                          │  ✓ code still valid
     │  hold settles for ZERO ─────┼──────────────────────────▶ (no transaction)
```

---

## Live

| | |
|---|---|
| Demo app | https://no-show-weld.vercel.app |
| Venue display | https://no-show-weld.vercel.app/checkin |
| Organiser view | https://no-show-weld.vercel.app/manage |
| Demo contract | [`0x6a9ce96a…5Da7C2`](https://testnet.monadvision.com/address/0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2) · Sourcify `exact_match` |
| Registry contract | [`0x1d3eDAfc…7b8112`](https://testnet.monadvision.com/address/0x1d3eDAfc7d029f51eb208E1d28FD2ce3a17b8112) · Sourcify `exact_match` |
| Network | Monad Testnet (chain id `10143`) |

**You only need MON**, from [faucet.monad.xyz](https://faucet.monad.xyz). It pays
gas, and the hold is denominated in Wrapped MON — the app wraps what it needs on
first registration, and it unwraps whenever you want.

---

## Try it in five minutes

```bash
git clone https://github.com/DhanushKenkiri/no-show
cd no-show/demo
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_NOSHOW_ADDRESS
npm run build && npm start
```

Then: **laptop** on `/checkin` fullscreen, **phone** on `/`, connect a wallet, tap
Register, then Check in and point the phone at the laptop.

> The phone's camera needs HTTPS, so use the deployed URL rather than localhost for
> the scanning half.

---

## Which piece do I want?

**"Show me it working."** → [`demo/`](demo/README.md)

**"I run an events platform and want this for my users."** →
[`enterprise/`](enterprise/README.md). Three integration surfaces: a Luma webhook
adapter, a generic REST + embed path for platforms with no API, and React
components if you have your own frontend.

**"I just want the library."** → `npm i @noshow/core`. Framework-agnostic, no React
and no bundler assumptions. See [enterprise/packages/core](enterprise/packages/core).

---

## Honest limitations

These are stated up front rather than buried, because the interesting parts of this
project are the constraints.

**The challenge proves liveness, not presence.** `currentChallenge` is a pure
function of the event id and the block number, and both are public — so anyone,
anywhere, can compute the current code without ever seeing the venue screen. What
the contract enforces is that a check-in **landed inside a ~1.2-second window**, so
it cannot be batched, backdated or done in advance. That is a real and useful
property; it is just not physical proof of attendance. Proving presence would need
the venue to inject a secret the contract can verify, which this design does not do.

**The venue display shows the next window, not the live one.** Not a stylistic
choice. A check-in sent with no gas estimation, a pre-warmed nonce and a local key
that signs instantly still mined *three blocks* after the block its challenge came
from, and reverted `StaleChallenge` with the full gas limit charged. Every public
Monad RPC measures 275–300ms round trip, so there is no faster endpoint to escape
to. Aiming one window ahead makes a scan land in the window it was always going to
land in.

**Charging a no-show is a trusted action.** `finalize` is called by the organiser.
Check-in itself is not trusted — that is the whole point of the challenge.

**The facilitator is a third party, but it cannot redirect funds.** The
authorisation cryptographically binds the recipient address. An unreleased
authorisation simply expires; there is no refund transaction because the money
never moved.

**Gas limits are measured and hardcoded, never estimated.** Monad charges the gas
*limit*, not the usage — a reverted check-in at a 200,000 limit consumed and charged
all 200,000. And an `eth_estimateGas` round trip does not fit inside the check-in
window. See `lib/gas.ts` in either half for the measurements.

---

## Stack

Next.js 15 · TypeScript · viem · Foundry (Monad) · x402 (`@x402/*` pinned to exactly
`2.22.0`).

That pin is load-bearing. `@x402/evm@2.22.0` requires `@x402/core@~2.22.0` while the
2.23 line requires `~2.23.0`; mixing them installs two copies of the core registry
and payments fail at settlement with no clear error.

## Licence

MIT.
