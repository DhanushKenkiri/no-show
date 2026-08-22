<!-- ![No-Show demo](docs/demo.gif) -->
<!-- TODO: record the GIF — register on /, scan /checkin from a phone, card flips green -->

# No-Show

**Registering for an event authorises a small hold that is never charged if you turn
up — and check-in is proven by landing a signed transaction inside a 1.2-second
window against a code derived from the block number.**

| | |
|---|---|
| Contract | [`0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2`](https://testnet.monadvision.com/address/0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2) |
| Network | Monad Testnet (10143) |
| Verification | Sourcify `exact_match` |
| Live URL | _not deployed yet_ |

---

## This was built before

Kickback ran deposit-to-RSVP at DevCon, EthCC and ETHNewYork in 2018–19, and it
stalled for two specific reasons that are both recorded in their own repository:
organisers found that demanding a stake was a barrier to entry, and check-in was
done off-chain by admins with a laptop, which meant a human decided who showed up.
This is not a new idea — it is those two things fixed.

### Fix one: the barrier

x402's `upto` scheme means you sign a **maximum, not a payment**. Show up and it
settles for **$0 with no on-chain transaction at all** — your money never moved. It
is a card hold, not a deposit.

### Fix two: the admin

The check-in challenge is `keccak256(eventId, block.number / 3)`, evaluated on
chain. A claim is only valid inside a 3-block window, which on Monad is about 1.2
seconds. Nobody ticks you off a list. The contract compares one value, and that
single comparison is the entire anti-farming mechanism — it only works because
blocks are 400ms.

---

## How it runs

| Route | Who | What |
|---|---|---|
| `/` | attendee | Event page. Register, then scan to check in. |
| `/checkin` | venue | Fullscreen rotating QR, countdown ring, block number. Laptop. |
| `/manage` | organiser | Live guest list, stat bar, finalize. |
| `/api/register` | — | x402 `upto` authorisation intake |
| `/api/checkin` | — | verifies the mined check-in, settles the hold for $0 |

```bash
npm install
cp .env.example .env.local     # set NEXT_PUBLIC_NOSHOW_ADDRESS
npm run build && npm start
```

Contract work lives in `contracts/` — `forge test` covers registration, the check-in
window, double check-in, finalize and payout. `npm run smoke -- <address>` prints
`currentChallenge()` twice two seconds apart so you can watch it rotate.

**You need two different tokens.** MON from [faucet.monad.xyz](https://faucet.monad.xyz)
pays gas. The hold itself is denominated in USDC, from
[faucet.circle.com](https://faucet.circle.com) with Monad Testnet selected. They are
unrelated balances, and having MON does not mean you can register.

---

## Honest limitations

**The challenge proves liveness, not presence.** `currentChallenge` is a pure
function of the event id and the block number, and both are public — so anyone,
anywhere, can compute the current code without ever seeing the venue screen. What
the contract actually enforces is that a check-in **landed inside a 1.2-second
window**, so it cannot be batched, backdated or done in advance. That is a real
property and it is the one worth claiming. Proving physical presence would need the
venue to inject a secret the contract can verify, which this design does not do.

**The venue display shows the next window, not the live one.** This is not a
stylistic choice. A check-in sent with no gas estimation, a pre-warmed nonce and a
locally computed challenge still mined 3 blocks after the block its challenge came
from, and reverted `StaleChallenge` with the full gas limit charged. All three
public RPCs measure 275–300ms round trip. Aiming one window ahead makes a scan land
in the window it was always going to land in. `NEXT_PUBLIC_VENUE_LEAD` tunes it.

**Charging a no-show is a trusted action.** `finalize` is called by the organiser.
Check-in itself is not trusted — that is the point of the challenge.

**The facilitator is a third party, but it cannot redirect funds.** The
authorisation cryptographically binds the recipient address, so neither the server
nor the facilitator can settle to anywhere else. An unreleased authorisation simply
expires; there is no refund transaction because the money never moved.

**Holds live in a module-level Map.** No database, per spec. That does not survive a
serverless cold start, so a check-in can be real on chain while the $0 settlement is
skipped — `/api/checkin` returns `202` and says so explicitly rather than reporting
a false failure.

**One address is deployer, contract admin and x402 payee.** A hackathon
simplification. In anything real these are three keys.

**`/manage` never backfills.** Rows come from an `eth_subscribe` subscription,
because the public RPC caps `eth_getLogs` at 100 blocks. The page therefore only
shows events from the moment it connects; totals are read from contract state and
stay correct regardless.

**Gas limits are hardcoded and measured, never estimated.** Monad charges the gas
*limit*, not the usage — a reverted check-in at a 200,000 limit consumed and
charged all 200,000. Worse, an `eth_estimateGas` round trip does not fit inside the
1.2-second window; three attempts died with `StaleChallenge` before the transaction
was even signed. See `lib/gas.ts` for the measurements and their dates.

---

## Stack

Next.js 15 · TypeScript · viem · RainbowKit · Foundry (Monad) · `@x402/*` pinned to
exactly `2.22.0`.

That pin is load-bearing. `@x402/evm@2.22.0` requires `@x402/core@~2.22.0` while the
2.23 line requires `~2.23.0`; mixing them installs two copies of the core registry
and payments fail at settlement with no clear error.
