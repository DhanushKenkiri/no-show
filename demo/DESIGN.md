# DESIGN.md — visual system

The app wears an event-page shell modelled on the Luma page this event is actually
hosted on. Everything below is a token or a component. **Components reference tokens
only — never a literal hex value, never a literal px.** That rule is what makes the
hour-five visual pass a fifteen-minute edit to one file instead of a rewrite.

---

## 1. Tokens — `app/tokens.css`

These are read off the reference screenshots and are close, not exact. If you want
exact, open the reference page in devtools and sample. Do not spend more than ten
minutes on this.

```css
:root {
  /* surfaces — near-black, layered by translucent white */
  --bg:            #0a0a0b;
  --surface-1:     rgba(255, 255, 255, 0.045);   /* cards, tiles */
  --surface-2:     rgba(255, 255, 255, 0.075);   /* hover, secondary button */
  --surface-solid: #16161a;                       /* when translucency won't do */

  /* borders — hairlines, almost invisible, doing all the structural work */
  --border:        rgba(255, 255, 255, 0.09);
  --border-strong: rgba(255, 255, 255, 0.16);

  /* text */
  --text:          #ffffff;
  --text-2:        rgba(255, 255, 255, 0.64);
  --text-3:        rgba(255, 255, 255, 0.42);
  --text-on-light: #0a0a0b;

  /* accents */
  --accent:        #836ef9;   /* Monad purple — the one brand colour */
  --accent-soft:   rgba(131, 110, 249, 0.16);
  --live:          #ff8a3d;   /* the LIVE dot, and only that */
  --ok:            #35c26a;   /* checked in, hold released */
  --warn:          #e5484d;   /* hold charged, errors */

  /* radii */
  --r-sm:  8px;    /* buttons, date tile */
  --r-md:  12px;   /* cards, cover image, map */
  --r-pill: 999px;

  /* spacing — 4px base, use ONLY these */
  --s-1: 4px;  --s-2: 8px;  --s-3: 12px; --s-4: 16px;
  --s-5: 24px; --s-6: 32px; --s-7: 48px; --s-8: 64px;

  /* layout */
  --page-max:   1080px;
  --rail:       340px;   /* left column on desktop */
  --col-gap:    56px;
}
```

**Shadows: none.** The reference uses hairline borders and translucent fills, not
elevation. A `box-shadow` anywhere in this app is a bug.

---

## 2. Type

Use **Inter** (or Geist) via `next/font`. Do not chase the exact reference face —
it's custom and you will lose an hour for a 3% gain.

| Role | Size | Weight | Tracking | Leading |
|---|---|---|---|---|
| Event title | 52px / 34px mobile | 700 | -0.025em | 1.05 |
| Section heading (`About Event`) | 15px | 600 | -0.01em | 1.3 |
| Body prose | 17px | 400 | 0 | 1.6 |
| Card heading (`You're In`) | 22px | 600 | -0.015em | 1.25 |
| Meta / secondary | 15px | 400 | 0 | 1.45 |
| Label / muted | 13px | 500 | 0 | 1.4 |
| Date tile — month | 11px | 600 | 0.06em, uppercase | 1 |
| Date tile — day | 22px | 600 | -0.01em | 1 |
| Mono (tx hash, ms, counts) | 13px | 400 | 0 | 1.5 |

Tight negative tracking on large text is most of what makes it read as "designed."

---

## 3. Layout

Desktop, centred at `--page-max`, two columns with `--col-gap`:

```
┌──────────────────────┬──────────────────────────────────────┐
│ cover image (square) │ EVENT TITLE (huge, 2 lines)          │
│ presented by + follow│ [AUG/22] Saturday, August 22         │
│ social icon row      │ [pin]   Kapil Kavuri Hub ↗           │
│                      │                                      │
│ ── Hosted By ──      │ ┌──────────────────────────────────┐ │
│ ◯ host row           │ │ REGISTRATION CARD  ← the product │ │
│ ◯ host row           │ └──────────────────────────────────┘ │
│                      │                                      │
│ Contact the Host     │ ── About Event ──                    │
│ Report Event         │ prose                                │
└──────────────────────┴──────────────────────────────────────┘
                     ── Location ── + map
                            footer
```

Mobile (this is the demo surface — build it first): single column, order = cover,
title, date, location, **registration card**, about, location, footer. The
registration card's primary button becomes a sticky bottom bar below 640px.

**Section headings** are small text followed by a `--border` hairline that runs to
the column edge. That pattern repeats for `Hosted By`, `About Event`, `Location`.

---

## 4. Component inventory

Build in this order. Everything above the line is required for the demo.

### Shell (chrome — build fast, don't fuss)
1. `TopNav` — logo left; clock + ghost "Create Event" right. Static.
2. `CoverImage` — square, `--r-md`, `object-fit: cover`.
3. `PresentedBy` — 28px logo, "Presented by" in `--text-3`, org name, Follow pill.
4. `SocialRow` — 4 muted 16px icons.
5. `SectionHeading` — label + hairline rule. Used three times.
6. `HostRow` — 26px avatar, name, right-aligned social icons.
7. `EventTitle`, `DateTile`, `DateBlock`, `LocationRow` (pin + venue + ↗ + area).
8. `AboutSection` — prose; emoji-prefixed subheadings; `--text-2` body.
9. `LocationSection` — venue name bold, address in `--text-2`, map card with a
   floating `Maps ↗` pill top-left on `--surface-solid`.
10. `Footer` — muted links.

### The product (this is what you're actually judged on)
11. **`RegistrationCard`** — one card, six states. See §5.
12. `TicketSheet` — bottom sheet with the attendee's QR + hold status.
13. `CommitPill` — three dots filling left→right for Proposed / Voted / Finalized,
    with elapsed ms in mono. The one place the chain is allowed to be loud.
14. `VenueDisplay` (`/checkin`) — fullscreen, near-black, one enormous rotating
    challenge QR, a 3-block countdown ring, and the current block number in mono.
    Runs on a laptop. This is the thing you point the room at.
15. `GuestList` (`/manage`) — rows: avatar, name, status chip
    (`Registered` / `Checked in` / `No-show`), hold amount. Live via subscription.
16. `StatBar` — registered · checked in · holds released · holds charged.
17. `Toast` — decoded custom errors. Every write path needs one.

### Skip
Search, calendars, discover, notifications, profile menus, comments, waitlist UI,
timezone pickers. They're chrome on the reference and they're zero on your score.

---

## 5. RegistrationCard — the six states

Structurally identical to the reference "You're In" card: `--surface-1`,
`--border`, `--r-md`, padding `--s-5`, avatar top-left, status top-right.

| State | Top-right | Heading | Body | Action |
|---|---|---|---|---|
| `IDLE` | — | Register | "Free. We hold $2 and release it the moment you check in." | **Register** (accent) |
| `AUTHORIZING` | spinner | Signing… | "This is a signature, not a payment. Nothing moves yet." | disabled |
| `REGISTERED` | `● LIVE` in `--live` | **You're In** | "Hold: $2 · released at check-in" | **My Ticket** (light) + Invite (ghost) |
| `SCANNING` | — | Check in | camera viewfinder | Cancel |
| `CHECKED_IN` | `● ` in `--ok` | **Checked In** | "Hold released. **$0 settled — no transaction was written.**" + `CommitPill` | View receipt |
| `NO_SHOW` | `● ` in `--warn` | Hold charged | "$2 settled. Funds the food for people who showed." | — |

The `CHECKED_IN` body line is the single most important string in the app. It is the
entire argument for the `upto` scheme, and it should be the largest secondary text on
the screen.

---

## 6. Background — read this before you build it

The reference background is radiating streaks with chromatic dispersion from a
vanishing point. **The `Galaxy` component you sent is not that** — it's a twinkling
starfield. Closer equivalents are the `Hyperspeed` / `LightRays` family.

More importantly: **do not run a WebGL canvas on any route that opens the camera.**
A fragment shader at 60fps next to `getUserMedia` on a mid-range Android will stutter
the preview, heat the phone, and drain the battery you need for the demo.

Rule:

| Route | Background |
|---|---|
| `/` (event page, desktop) | animated canvas, fine |
| `/` (mobile) | **static image or CSS gradient** |
| `/checkin` (venue display, laptop) | animated canvas, fine |
| any camera route | flat `--bg`, nothing else |

Cheapest thing that looks right: a radial gradient plus a handful of CSS-animated
streaks, no dependency, no canvas.

```css
.bg {
  background:
    radial-gradient(120% 90% at 50% 45%, rgba(131,110,249,.11) 0%, transparent 55%),
    var(--bg);
}
```

If you want the real thing, gate it: `{!isMobile && !cameraActive && <Galaxy … />}`,
`density={0.8} glowIntensity={0.25} saturation={0} hueShift={255} rotationSpeed={0}`
— purple-shifted, slow, and quiet enough to sit behind text.

---

## 7. Assets — rename these on the way in

Everything goes in `public/assets/`. Rename as you copy; opaque UUIDs will get
mis-referenced by an AI every single time.

| Source file | Rename to | Used by |
|---|---|---|
| `d382f224-…707158.png` | `cover.png` | `CoverImage` |
| `1da73c96-…9307bcee.png` (larger) | `monad-mark.png` | `PresentedBy`, `HostRow` |
| `aac76121-…a262df4.png` | `hyddao.png` | `HostRow` |
| `5cdc332a-…b2c9aec.jpg` | `host-1.jpg` | `HostRow` |
| `238f7dfa-…7a5074d.jpg` | `host-2.jpg` | `HostRow` |
| `d7fbd49e-…fade83b0.jpg` | `host-3.jpg` | `HostRow` |
| `avatar_41.jpg` | `you.jpg` | `RegistrationCard`, `GuestList` |
| `a443c18e-…4b4212e.png` | *skip* | unrelated badge |
| `669f9efc-…3cdf8b5.jpg` | *skip* | it's a share card, not a cover |
| `apple-touch-icon.png`, `favicon.ico` | **do not ship** | see below |

**Three judgement calls, and I'd take all three:**

- **Drop the Luma favicon and apple-touch-icon.** That iridescent star is Luma's own
  brand mark. Shipping a vendor's logo as your app icon is the one thing here that
  reads as lifted rather than referenced. Use your own mark, or the Monad diamond.
- **Keep the Monad and Blitz artwork.** You are demoing *this event, at this event*.
  The recognition is the joke and it lands.
- **Never render a real named host in a failure state.** Putting "No-show · hold
  charged" under Arsh Goyal's actual face, in a room where he is standing, is a false
  claim about a real person. In `GuestList`, the `NO_SHOW` demo row must be `you.jpg`
  or a generic avatar. Real hosts appear only in `HostRow`, only as hosts.

---

## 8. Restyle prompt — append to PROMPTS.md as Prompt 5.5

Send this only after check-in works end to end.

> Read DESIGN.md in full.
>
> Create `app/tokens.css` with the tokens exactly as specified and import it in the
> root layout. Then restyle the existing pages to the layout and component inventory
> in DESIGN.md. Do not change any contract call, state machine, or API route — this
> is a visual pass only.
>
> Rules: components may reference CSS variables only, never a literal hex or px value
> outside tokens.css. No box-shadow anywhere. Mobile-first; the sticky bottom action
> bar below 640px. Assets are in `public/assets/` with the names from DESIGN.md §7.
>
> Build the six RegistrationCard states from §5 as a single component driven by one
> `status` prop, and give me a `?debug=state` query param that lets me force any state
> so I can screenshot all six without running the full flow.
>
> Background: follow §6 exactly. No canvas on mobile, none on camera routes.

That `?debug=state` param is worth more than it looks — it's how you screenshot every
state for the README at hour 5:30 without needing the whole flow to cooperate.
