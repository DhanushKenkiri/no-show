# SPEC.md — No-Show

**This replaces the Handshake SPEC.md. Delete that file.**

## One sentence

Registering for an event authorises a small hold that is never charged if you turn
up — and check-in is proven by landing a signed transaction inside a 1.2-second
window against a code that only exists on the venue screen.

## The pitch (put this in the README, and say it on stage)

This was built before. Kickback ran deposit-to-RSVP at DevCon, EthCC and ETHNewYork
in 2018–19, and it stalled for two specific reasons that are both in their own repo:
organisers found that demanding a stake was a barrier to entry, and check-in was done
off-chain by admins with a laptop, which meant a human decided who showed up.

Both are gone now.

- **The barrier**: x402's `upto` scheme means you sign a maximum, not a payment. Show
  up and it settles for **$0 with no on-chain transaction at all** — your money never
  moved. It's a card hold, not a deposit.
- **The admin**: the check-in challenge is derived from the block number on chain, so
  a claim is only valid inside a 3-block window. At 400ms blocks that's 1.2 seconds.
  You had to be looking at the venue screen. Nobody decides — the chain does.

Do not pitch this as a new idea. Pitch it as the fix.

## Roles and flow

ATTENDEE                                 VENUE SCREEN (laptop)      ORGANISER
opens `/`, taps Register
signs an `upto` authorisation
  (a signature, no transaction)
card shows "You're In", hold $2
                                         displays a huge QR of the
                                         current challenge, rotating
                                         every 3 blocks (~1.2s)
arrives, opens ticket, scans the screen
POST /api/checkin with the challenge
contract verifies the challenge matches
  keccak256(eventId, block.number / 3)
  -> reverts if the window has passed
hold settles for $0 — NO TRANSACTION
card flips to "Checked In"
                                                                     `/manage` list
                                                                     flips live
                                                                     counts update

After the event the organiser finalises: anyone still `REGISTERED` settles at the
full hold, which funds the people who showed.

## Routes

| Route | Who | Purpose |
|---|---|---|
| `/` | attendee | the event page (see DESIGN.md). Registration card lives here. |
| `/checkin` | venue | fullscreen rotating challenge QR + block number. Laptop. |
| `/manage` | organiser | live guest list, counts, finalise button |
| `/api/register` | — | x402 `upto` authorisation intake |
| `/api/checkin` | — | verifies challenge, settles $0, calls checkIn on chain |
| `/api/events` | — | SSE stream of status changes |

State lives in a module-level `Map`. No database.

## Contract — contracts/src/NoShow.sol

```
struct Attendee {          // MUST pack to exactly 32 bytes — prove with forge inspect
    uint40 registeredAt;   //  5
    uint40 checkedInAt;    //  5   0 = not yet
    uint40 holdUsdc;       //  5   6dp
    uint8  status;         //  1   0 none, 1 registered, 2 checked in, 3 no-show
    bool   settled;        //  1
}                          // 17 bytes, one slot, room to spare

mapping(bytes32 => mapping(address => Attendee)) attendees;   // eventId => who
mapping(bytes32 => uint32) public registeredCount;            // per event, NOT global
mapping(bytes32 => uint32) public checkedInCount;

CHALLENGE_BLOCKS = 3

function currentChallenge(bytes32 eventId) public view returns (bytes32) {
    return keccak256(abi.encodePacked(eventId, block.number / CHALLENGE_BLOCKS));
}

register(bytes32 eventId, uint40 holdUsdc, bytes32 authRef)
checkIn(bytes32 eventId, bytes32 challenge)      // reverts StaleChallenge if window passed
finalize(bytes32 eventId, address[] calldata noShows)
screen(bytes32 eventId, address who) view returns (Attendee, bytes32 challenge, uint8 blocksLeft)

event Registered(bytes32 indexed eventId, address indexed who, uint40 holdUsdc)
event CheckedIn (bytes32 indexed eventId, address indexed who, uint40 at)
event HoldCharged(bytes32 indexed eventId, address indexed who, uint40 amount)

errors: NotRegistered, AlreadyCheckedIn, StaleChallenge, NotOrganiser, EventClosed
```

`checkIn` compares the submitted challenge against `currentChallenge` and reverts
`StaleChallenge` otherwise. **That single comparison is the whole anti-farming
mechanism, and it only works because blocks are 400ms.** Say that out loud.

## x402 — this product needs `upto`, not `exact`

Read X402.md §Schemes carefully. `upto` is Permit2-only, needs the proxy at
`0x4020A4f3b7b90ccA423B9fabCc0CE57C6C240002`, needs `extra.facilitatorAddress` bound
into the witness, and `@x402/evm` pinned to exactly `2.22.0`. A `412
PRECONDITION_FAILED` means the Permit2 allowance is missing — approve and retry.

**Fallback if `upto` fights you past the cutoff:** use `exact` with a real $0.10
charge on register and a manual refund on check-in. The flow and the UI are
identical; you lose the "no transaction was written" line, which is the best line in
the pitch. Try hard for `upto`, but do not let it eat the demo.

## Honest limitations to state in the README

- `finalize` is called by the organiser, so charging a no-show is a trusted action.
  Check-in itself is not — the block-derived challenge is verified on chain.
- The settlement facilitator is a third party, but it cannot redirect funds: the
  authorisation cryptographically binds the recipient address.

## Non-goals

No ticket transfers, no waitlist, no email, no calendar sync, no multi-event
management, no auth beyond the embedded wallet, no refund disputes.
