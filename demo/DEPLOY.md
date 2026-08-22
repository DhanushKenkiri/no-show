# Deploying No-Show

## Live now

| | |
|---|---|
| Contract | [`0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2`](https://testnet.monadvision.com/address/0x6a9ce96a097d5e8588E8F5a2B3Ea5bB20F5Da7C2) |
| Network | Monad Testnet (10143) |
| Admin | `0xA02f986810602163f078e38488C6FE6756De606e` |
| Verification | Sourcify `exact_match` |
| Deploy tx | `0x9fdd7afd6b2316d9540803480be4a0e999373376129239534290c0d1b0b9d3b9` |

`NoShow.sol` is deployed. **Do not edit it** — the ABI would stop matching the
deployed bytecode.

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

### Verify on Sourcify

The bare command in MONAD.md **fails** with `contract_not_found_in_compiler_output`.
It needs three more things: the fully-qualified contract path, the exact compiler
version, and the ABI-encoded constructor args.

```bash
forge verify-contract <DEPLOYED_ADDRESS> src/NoShow.sol:NoShow \
  --chain 10143 \
  --verifier sourcify \
  --verifier-url https://sourcify-api-monad.blockvision.org/ \
  --compiler-version 0.8.36+commit.8a079791 \
  --constructor-args $(cast abi-encode "constructor(address)" 0xA02f986810602163f078e38488C6FE6756De606e) \
  --watch
```

Success is `Status: exact_match`. Anything less is not a verified contract.

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

Required environment variables, whichever host:

| Variable | Why |
|---|---|
| `NEXT_PUBLIC_WC_PROJECT_ID` | RainbowKit. Without it no mobile wallet appears. |
| `NEXT_PUBLIC_NOSHOW_ADDRESS` | The deployed contract. |
| `NEXT_PUBLIC_ORGANISER_ADDRESS` | Already defaulted in `lib/config.ts`. |

**Do not put the deployer private key in the app environment.** Nothing the browser
loads needs it, and `NEXT_PUBLIC_*` variables are compiled into the client bundle.

**A blank `NEXT_PUBLIC_WC_PROJECT_ID` is worse than a missing one.** Adding the
variable in the Vercel dashboard and leaving the value empty used to fail the whole
build with `No projectId found` during prerender — an empty string is not
`undefined`. `lib/config.ts` now degrades instead of throwing, so the site builds
either way and only WalletConnect is affected. Still: set it properly, or leave the
variable out entirely.

### Vercel (what this project uses)

Chosen over AWS for one reason: HTTPS in about three minutes with no domain, no
certificate and no IAM change. The camera needs TLS and everything else is a
detour from the demo.

Connect the repo once, in the browser — it beats the CLI because every later push
redeploys itself:

1. <https://vercel.com/new> → import `DhanushKenkiri/no-show`
2. Framework preset detects Next.js. Leave the build command alone; `prebuild`
   regenerates the ABI automatically.
3. Add the three environment variables above **before** the first build.
4. Deploy. The URL is `https://<project>.vercel.app`, HTTPS included.

Or from the CLI, which needs an interactive browser login first:

```bash
npx vercel login
npx vercel --prod
```

### AWS (documented, not used)

Kept here because it was the original plan and may be revisited. Three things make
it slower than it looks on this account (`867895848221`, `ap-south-1`):

- The `default` CLI profile's access key is **stale** — `InvalidClientTokenId`.
  Working profiles are `openclaw-bedrock`, `signalai` and `ec2`.
- **No profile can reach Amplify or App Runner.** Only `ec2` works, with EC2 + S3.
  The account *does* have IAM rights, so the Amplify policy can be self-granted.
- AWS has no "push and get HTTPS" without Amplify, or a domain plus an ACM
  certificate. Plain EC2 gives you an IP and no TLS, which means no camera.

If you do go back to AWS:

| Option | HTTPS | Realistic time |
|---|---|---|
| Amplify Hosting | free on `*.amplifyapp.com` | ~20 min, after granting IAM perms |
| EC2 + Caddy | needs a domain, or a Cloudflare/ngrok tunnel | 45+ min |
| S3 + CloudFront | free, but static only | not viable — this app has API routes |

Amplify is the only one that is close to Vercel. It needs `platform: WEB_COMPUTE`
for Next.js SSR and a GitHub connection made through the console.
