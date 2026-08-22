# Deploying No-Show

Two independent halves: the contract goes to Monad Testnet, the app goes to a host
that serves HTTPS. **The camera will not open over plain HTTP**, so the host must
terminate TLS. Do this early — not at hour five.

---

## 1. Contract → Monad Testnet

### One-time: put the deployer key in an encrypted keystore

The generated key is sitting in plaintext at `.keys/deployer.key` (gitignored).
Move it into Foundry's encrypted keystore and delete the plaintext copy. You choose
the password; nothing else ever sees it.

```bash
cast wallet import monad-deployer --private-key $(cat .keys/deployer.key)
cast wallet address --account monad-deployer     # must print 0xA02f9868…606e
rm -rf .keys                                     # only after the address matches
```

### Deploy

The constructor takes the admin, which is the only address allowed to call
`finalize` and `payout`. It must be the organiser account.

```bash
cd contracts
forge create src/NoShow.sol:NoShow \
  --account monad-deployer \
  --broadcast \
  --constructor-args 0xA02f986810602163f078e38488C6FE6756De606e
```

`foundry.toml` already carries `eth-rpc-url` and `chain_id = 10143`, so no
`--rpc-url` flag is needed.

Equivalent via the script, which also logs the admin back to you:

```bash
forge script script/Deploy.s.sol:Deploy --account monad-deployer --broadcast
```

### Verify on MonadVision

```bash
forge verify-contract <DEPLOYED_ADDRESS> NoShow \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/
```

### After deploying

```bash
cd .. && npm run abi                   # regenerate lib/abi/noShow.ts from the artifact
npm run smoke -- <DEPLOYED_ADDRESS>    # proves the challenge rotates
```

`npm run smoke` reads `currentChallenge()` twice, two seconds apart. At ~400ms
blocks and `CHALLENGE_BLOCKS = 3`, two seconds is about five blocks, so the two
values **must** differ. If they match, check-in has no anti-farming property and
something is wrong.

Then set the address in `.env.local` and in the host's environment:

```
NEXT_PUBLIC_NOSHOW_ADDRESS=0x…
```

---

## 2. App → HTTPS host

See the hosting section below. Required environment variables, whichever host:

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | RainbowKit. Without it no mobile wallet appears. |
| `NEXT_PUBLIC_NOSHOW_ADDRESS` | The deployed contract. |
| `NEXT_PUBLIC_ORGANISER_ADDRESS` | Already defaulted in `lib/config.ts`. |

**Do not put the deployer private key in the app environment.** Nothing the browser
loads needs it, and `NEXT_PUBLIC_*` variables are compiled into the client bundle.
