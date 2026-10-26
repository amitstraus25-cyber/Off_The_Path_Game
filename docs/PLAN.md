# Build plan: Off the Path, "That's Not My Grandma"

How to use this file: work **one phase per Claude Code session**. Start the session in plan mode, restate the phase goal and tasks, get approval,
implement, tick the boxes, run the `phase-done` skill, commit, then `/clear` before the next phase.
Effort sizes: **S** under half a day, **M** about a day, **L** several days (for one engineer pairing with Claude Code; art and review lead times are separate).

## Progress at a glance

**Updated 2026-10-22, at `e2f7e7f`; the live game is v2.** No code has changed since `3c88684`:
`git diff --stat 3c88684 HEAD` touches only `docs/`, `apps/api/README.md` and `CLAUDE.md`. The
working tree is NOT clean while this round runs -- see "In progress". This is the status board; the
phase sections below are the detailed checklists.
**Measured today, not remembered** (each workspace run on its own, exit code taken on its own
line, all 0): `pnpm test` is **1,151 tests passing and 1 skipped** -- `packages/core` 348 in 13
files and `apps/api` 202 in 12, both at 100% on statements, branches, functions and lines;
`apps/game` 484 (+1 skipped) in 30 files; `tools/graybox` 117 in 5 -- and Playwright lists **335
e2e tests in 33 files at HEAD** (`playwright test --list`; 336 in 34 while another builder's
uncommitted `e2e/talk-bubble.spec.ts` is in the tree). **Full e2e run, 2026-10-22, on a copy of `e2f7e7f`
(`git archive`, its own port, Chromium 1228, two workers, `--fail-on-flaky-tests`): 329 passed and
6 skipped, exit 0, in 4.7 minutes -- the same split as the run at `2b42743`.** It is a run of the
committed tree, not of the other builders' uncommitted work. An earlier attempt at it failed with
`ERR_CONNECTION_REFUSED` on every spec after the preview server was killed mid-run; that is the
environment, not an assertion (PAUL_BRIEF trap 9), and the run above had its server supervised.
`docs/PAUL_BRIEF.md` section 1 holds the same counts.

### Done

- **The game as it is live now (v2).** Seven characters in walking order -- Rabbit, Toadstool, Owl,
  Magpie, Snail, Lantern Keeper, Cat -- each offering one skill, in a Cyera arcade cabinet on every
  screen size. Every skill has a real in-game effect, identical in its good and bad copies: Wood
  Map (a minimap), Way Teller (fork signs naming who lives down each way), Word Weaver (Grandma
  expects you, so the knock is skipped), Wing Ride (a flight to the next friend), Slow Post (a
  faster walk), Night Light (a lantern at dusk) and Long Evening (20 seconds back). **Every run
  deals 3 good and 4 bad** from a seed, so replaying meets the same characters with a different
  set of malicious ones. A short conversation, then the card (2026-10-26); take it or leave it; a 3:30 hard timer (3:00
  until 2026-10-26); **score out of 100 = correct choices plus speed**, par 2:02; any bad skill taken is 0. A door check asks before you go in with
  anyone unmet; the minimap shows who you have met; the reveal puts the score first and then seven
  flip tiles (promise against what it did, the real-world note); Walk it again starts a fresh
  deal.
- **The leaderboard, v2, end to end.** `POST /api/start` deals the seed in a signed token,
  `POST /api/score` replays the v2 log against it and recomputes the score (a floor on the time
  from the walk the log claims, a five-minute window, one token one row, wolf runs refused),
  `GET /api/top` reads only rows from `BOARD_SINCE` and above 0, cached 10 s plus 20 s stale. Names
  are typed (checked by `v2.checkName`), and the board shows your own row at once. Deployed through
  the Build Output API (`vercel-output.mjs`). `apps/api/README.md` is the service's source of
  truth.
- **A work email to post, built and OFF.** Behind `OTP_WORK_EMAIL=required`: a work email and a
  consent tick, written beside the score in a table the service cannot read back (migration
  `0007`). Until the three steps under "Waiting on you" are done the game behaves exactly as at
  `8c4dc49`.
- **Phase 9 A to F** (rules, content, world, screens, leaderboard, readiness), with v1 removed from
  the repository, and the readiness sweep's three blockers fixed (`51574fc`).
- **The client's list from 2026-10-21**: "the line" (all three causes: two one-pixel backdrop
  holes, a stale checkout of a different repository serving `:5173` -- trap 10 -- and the camera's
  top edge cutting a canopy row); the trees; the Inspect card (superseded by the card that opens by
  itself); the phone goals panel; the Results block; the gate; the rename Red to Purple (D11);
  shorter copy. **The arcade question was answered both ways in one week and the cabinet is the
  answer** (client's word, 2026-10-22).
- **Security**: the debug handle no longer ships to players, and `csp.test.ts` greps the bundle for
  the one test hook left (`testClock`); the shipped-code lint rules cover the live routes; the Vite
  advisory is patched; the CSP is on every response, functions included.
- **Process**: the v2 spec (`docs/GAME_DESIGN_V2.md`), the staffing policy (Opus 5.5 for judgment,
  Sonnet and Haiku for labour), the database runbook and migrations `0001` to `0007`.

### In progress

**Paul's design round (2026-10-22, night), in the working tree and NOT committed.** Thirty fixes
merged from five reviews; the record of each, done or partly done or skipped with the reason, is
the round's handback. Landed in the tree: the Arrive panel is one grid at its final size from the
first beat, docked on the canvas edges, with the camera framing the door, Purple (now a tile back
from the step, so the opened door shows) and the prints above it (`frameAboveCover`,
`ui/Cottage.tsx` publishes `otp:panel-cover`); the late ending reads "After dark", shows Purple and
offers "See what happened"; the replay line counts the basket ("You kept N of 4 ... out of your
basket"); the premise's agent line survives every fit rung; the walk row is fixed and no longer
squashes the deck on the first Tab; header chips on Title, How to play, Arrive and Results; the slim
focus ring on the title CTA and the door; type floors, wraps and tracking; the reveal tiles' names
punctuated; one `<main>`; opaque HUD pills and square wells; the clock that holds its width at
0:30; the music pill; the deck's centres; fork chips that fit a phone; the paper bird off her face;
the lantern's light under her, in ember; a Deep Purple dusk; the card's well, title and line pitch;
the post outcome's badge; and, in the art, the struck-tree ghosts in the canopy (with a guard and
`OPEN_ENOUGH` 101 -> 98), the waterfall filling its channel unflipped, and an amber snail. Every new
or changed string is in `docs/COPY_REVIEW.md` section 0b for the human read. `e2e/design-round.spec.ts`
measures what a browser can.

Everything the earlier version of this board listed as "built, not committed, not ticked" is in the
log: the perks (`c86b11e`), the cabinet and replay hook (`f34ea67`, review round `6e1192f`), the
morning interactions (`3e2473e`, `02420d6`), the afternoon screens (`8c4dc49`), the work email
(`d61750b`), the minimap and the door (`f78dc5f`) and the last round's notes (`2b42743`, `7b28bc4`,
`3c88684`). The records of each round stay below under "Shipped in the client rounds of
2026-10-22". What remains is waiting on a person or is planned.

**The three Cyera signs (the client, 2026-10-23), in the working tree and NOT committed.**

- [x] The forest notice reads "I ♥ / CYERA / RESEARCH" in a 3 x 5 pixel font, the heart in Deep
      Purple. "RESEARCH" does not fit a one-tile page, so the notice is two tiles (`notice-board`
      plus the appended `notice-board-r`, gid 113) with the post at the seam; the sapling at
      (44..45, 18..19) is felled for it and its east trunk cell (45,19) is a boulder, so it stays
      solid and the core clock's tour is unchanged at 113 tiles, leg for leg.
- [x] A wooden "CYERA / SPEED!" board on two stakes at (36,3), the clearing at the waterfall's head
      under the low hedge (`sign-speed`, gid 114).
- [x] A blank dark board on two stakes at (20..21, 22), the left bank's clearing near the spawn at
      its lower right (`sign-logo-l`/`-r`, gids 115 and 116), with the supplied
      `cyera-logo-white.svg` laid over its face in the DOM (`ui/WorldSigns.tsx`): never painted,
      `aria-hidden`, `alt=""`, hidden off the camera and while Purple stands in front of it. The
      face is published on the `sign-logo` object's properties from the painter's `LOGO_FACE`.
- [x] `sign-research`, `sign-speed`, `sign-logo` map objects (ids 22 to 24); audit 5 holds a
      `sign-*` solid and guard 7k holds it whole. Laid in the generator's second pass, because laid
      with the other landmarks they moved the wood forty tiles away; the regeneration changed 12 map
      cells and 5 tileset cells, every one claimed.
- [x] A polite one-line caption in the toast's slot while Purple is within two tiles of a sign:
      `ui.world.signs` in `content/game.v2.json` (schema in core `v2/content.ts`), with a `spoken`
      form for the heart ("I love Cyera Research").
- [x] Guards: lettering contrast and margins, the logo face blank and dark (`s-props.ts`);
      `test/signs.test.ts`; `e2e/forest-signs.spec.ts`, which measures the logo's box against the
      board's own pixels at 1280x800 and 375x812.
- **Deferred / assumed.** The Deep Purple heart and the Cyera lettering on world props are a
  client-requested exception to PIXEL_STANDARD section 2 and CLAUDE.md rule 4's reading in
  s-props.ts, and want a brand reviewer's yes. The two placements are read from a description of
  the client's screenshots, not the screenshots. The logo is not dimmed by the dusk wash (it is
  DOM; dimming it would mean filtering the mark). The three captions have not been through
  `docs/COPY_REVIEW.md`.

**The client's scoring floor (2026-10-25): "anyone who starts playing automatically gets 25, so they
can at least leave their email".** Agreed in chat that afternoon, with late runs posting too and the
board reset.

- [x] **Core:** `scoring.played` (25) is given to every run that ENDS -- `grandma`, `wolf` or `late`;
      a clean arrival adds `clean` 15 + `good` 15 per good skill + a speed bonus of up to 15. 100 at
      par, 85 at the buzzer, two good 74-80, one good 55-60, leave-all 40, wolf or late 25, unfinished 0. The simulator's rote line stands on `played` (25 + 40% of 75 = 55); the best blind basket
      averages 40. GAME_DESIGN_V2 section 9 has the table.
- [x] **Server:** a wolf run and a late run are posted at 25 (the `wolf` 422 and the late 400 are
      gone). `BOARD_SINCE` moved to the deploy that ships this, so the board starts fresh under one
      rule.
- [x] **Game:** every ending offers Post; a clean run's score shows "For playing 25" beside its other
      two parts, and a wolf or late run says it keeps the 25.
- [ ] **Human:** the rows before the new `BOARD_SINCE` are hidden, not deleted -- delete them in the
      Supabase SQL editor when convenient (docs/DATABASE.md). The new lines have not been through
      `docs/COPY_REVIEW.md`.

**Paul's final review (2026-10-25), decided item by item in chat.** Twenty-five items from seven
lenses; the client approved, declined or deferred each one. Built and tested in this round:

- [x] **P1** a stationary touch in a freshly opened offer or door question waits a second
      (`TOUCH_SETTLE_MS`, components.tsx): a second tap on A no longer answers Leave it or Go in.
- [x] **P12** the round button reads E with a keyboard and a mouse, A on touch.
- [x] **P8-P10** the reveal: four calls (Caught it / Right call / Missed it / Walked past), the
      Missed badge's style finally applies, "malicious" for "bad", a clean run opens its first caught
      bad card, and safe tiles show what their unsafe copy said.
- [x] **P13** a "Post your score" link beside Walk it again, a line saying why Post is greyed, and a
      full-width consent row. **P14** a hidden polite line after each choice.
- [x] **P17** the door also asks about, and names, characters met and never answered.
- [x] **P5** the scene dispatches `otp:bearings` (the forest summary now says which way and how far)
      and `otp:beacon`, a quiet edge arrow to the nearest unmet character while none is on screen
      (world/beacon.ts, ui/Beacon.tsx).
- [x] **P24** no numeral on the door question, a Deep Purple favicon that reads on dark tabs, a
      16px footer logo. **P23 (part)** the reveal's lesson labels at 11px minimum.
- [x] **P3, P11, P25** copy: Night Light's note is now "Excessive agency" (OWASP's term); two safe
      lines say concrete behaviour instead of "only"; Night Light's safe line is longer. The status
      line says the notes had a security read and still await the research team.
- [ ] **Deferred by the client:** P2 the Vercel rate limit (before launch), P7 the three analytics
      events and the A/B tests P19-P21 that need them. **Declined:** P4, P6, P15, P16, P18, P22.
- [ ] **Not done, needs a layout change:** P23's idle controls on a landscape phone and the tablet
      world growing by whole steps (cabinet.ts / stage.ts), and the high-contrast logo swap.

**The client's art picks (2026-10-25), in the working tree and NOT committed.** Chosen from the
preview sheets of that morning; both are CLIENT PICKS, not a builder's call.

- [x] **A3, the mark on Purple's back:** the Cyera-symbol trace at 11 px (was 9), the dot's gap
      opened to 2 px by two hand-cleared pixels, (r1,c8) and (r3,c8), and a 1 px lighter rim on the
      outer lit arc; the cape line stays, lifted three rows on the back view only. Only her four back
      frames changed. `assertCapeDevice` (`char-purple.ts`) and `test/art-guards.test.ts` pin it
      exactly: the size, the two named edits, the 2 px gap, and the rim on the lit arc only.
      **Brand sign-off is pending, and this widens Waiting-on-you item 5:** the mark is now a
      HAND-EDITED rendering of the Cyera symbol, further from the artwork than the straight
      threshold it replaces, and the brand team has seen neither.
- [x] **B1, the brush hand on the notice and the Cyera Speed! sign** (`tiles/sign-brush.ts`):
      heavy downstrokes, dry-brush ends, a bouncing baseline, and a drawn heart with an outline and
      a Lilac highlight. The notice's paper is 42 wide (was 38) to carry RESEARCH. Only the tiles
      `notice-board`, `notice-board-r` and `sign-speed` changed; `map-forest.json` regenerated
      byte-identical, so no map cell moved and the tour is still 113 tiles. The lettering guard
      keeps its 100-luma floor for the letters and the heart's body; the dry-brush ends and the
      heart's highlight are named exceptions with rules of their own.

### Planned

- **Phase 7, the release candidate:** the host side of the embed (the responsive container and a
  test inside a copy of the landing page), a screen-reader and 200% zoom audit with a tool that is
  actually installed, byte budgets and time to interactive measured, the cross-browser matrix.
- **Phase 8, playtest and launch:** five to eight playtests, the launch checklist (secrets, rate
  limits, moderation access, uptime check, rollback), embedding on the Off the Path page, the
  post-launch dashboard.
- **Moderation and review of the service:** an admin delete path and `docs/RUNBOOK.md` (neither
  exists), and Phase 6's unticked `security-reviewer` box. Phase 6 has the detail.
- **The camera and the cabinet:** `cameraFor()` in `packages/core/src/camera.ts` still does not
  know the cabinet, so `pnpm world` and the graybox composition guards frame a camera the game no
  longer builds (trap 1). `cabinetFor` is written to be lifted into camera.ts as it is.
- **The copy read:** `content/game.v2.json` still says `draft: copy awaits the human read`, and the
  new strings (the perk toasts, the door lines, the flip tiles, the contact lines) have not been
  through `docs/COPY_REVIEW.md`.
- **The readiness findings** below were written against v1 on 2026-10-21; two are marked expired
  and the rest are not re-triaged against v2.

### Waiting on you

In the order they unblock things. None of these can be done from the repository.

1. **Turn on Vercel firewall rate limiting for `/api/*` and prove it on a preview.** The only
   control that spans instances, and the one gate before the board is exposed to the public
   (Phase 9 E's open box). Recorded as not on at 2026-10-22; the Vercel dashboard was not
   checked for this update.
2. **Make Vercel deploy only after CI is green.** `.github/workflows/ci.yml` has no deploy step, so
   nothing ties a deploy to a passing run.
3. **The research URL, for good.** The call to action points at `https://www.cyera.com/research`
   for now (the client's choice, 2026-10-23). The game's own page will be
   `cyera.com/research/malicious-skills`; whether the CTA then links or scrolls is with the agency.
4. **The landing-page background image**, promised for 2026-10-22. The landing ships without one.
5. **Brand sign-off, two items.** The pixel trace of the Cyera symbol on Purple's back (`8c4dc49`;
   CLAUDE.md rule 5 forbids redrawn logo variants, and `docs/ART_PRODUCTION.md` says the mark is
   not settled), and the cabinet's Lilac glow (`--otp-cab-glow` in `tokens.css`), which
   contradicts "no shadows" in UI_FOUNDATIONS section 4 and BRAND_AND_UI section 3.
6. **Legal review** of the leaderboard and privacy copy (D10), and of the work email (below).
7. **Migration `0006_clear_v1_rows.sql`**, in the Supabase SQL editor. It deletes the v1 rows
   (those before the v2 launch); the board already hides every row older than `BOARD_SINCE`, so this
   is housekeeping, and rows between the two instants are hidden, not deleted.
8. **Post one score on production** to prove the write path. Nothing here has been measured against
   production since the v2 deploy (PAUL_BRIEF section 5).
9. **Carried from the earlier board, not re-checked this pass:** clear Vercel's billing "Action
   required"; D2 (who makes production art) and D6 (the real Haffer and Season Mix files).

**Work email to post a score (your decision, 2026-10-22) -- built, OFF until you do these, in this
order:**

1. **Run the migration** `supabase/migrations/0007_leaderboard_work_email.sql` in the Supabase SQL
   editor (pg_cron enabled first, as for 0003), then its verification block: no grants on
   `leaderboard_contact`, execute on the function for `service_role` only, and the notice
   "transaction proved".
2. **Get Legal's sign-off** (D10 is reopened: the board now keeps a work email beside a score).
   The paragraph, the consent wording (`research-contact-v1`: "Cyera may contact me about this
   research.") and the twelve-month retention are in `docs/DATABASE.md`, "Decision 5"; the
   player-facing lines are listed in `docs/COPY_REVIEW.md`.
3. **Set `OTP_WORK_EMAIL=required`** in Vercel (Production and Preview) and **redeploy**. Then
   `POST /api/start` answers `"emailRequired": true` and Results asks for the address. Exactly
   `required`; any other value leaves it off and logs that it did.

Until step 3 the game behaves exactly as at `8c4dc49`. Doing step 3 before step 1 makes every
post answer "No reply came back for that post." (503) -- unset the variable and redeploy to undo.

### Shipped in the client rounds of 2026-10-22

Point-in-time records, oldest first; a later bullet supersedes an earlier one where they differ.

- **The seven perks, wired into the game (2026-10-22, `c86b11e`).** Every
  effect is read from the skill's `effect` kind through core's perks.ts, never a skill id, and is
  the same for the good copy and the bad one. Wood Map: the minimap is drawn only once taken (the
  door's question stays for everyone). Way Teller: a wooden board at each `fork-N` and DOM chips on
  it -- face, name and a CSS arrow per heading, naming the nearest unmet character down that way
  along the path (`world/forks.ts`), never the cottage. Word Weaver: a paper bird flies off (toward Grandma's door since `2b42743`),
  and the arrival opens on "No need to knock. Word went ahead of you." (`chrome.doorWelcome`) with the knock skipped. Wing Ride: a
  2 s arc, carried by a copy of the giver, the camera following, then the next unmet friend's offer
  opens; under reduced motion a fade; with nobody left it does nothing and says so. Slow Post: the
  walk and its legs run at x1.15. Night Light: from 2:00 left the world layer dims for everyone
  under a Black wash capped at the content's 0.45 (never the DOM), and the lantern's ADD glow
  circles Purple. Long Evening: the HUD and the hard stop read core's `timeLeftMs`/`deadlineMs`;
  the face winds up over 1.2 s under a Lilac outline. A one-line polite toast per perk
  (`chrome.perk*`), and the knock beat (`world.knockMs`) is held before ENTER_COTTAGE. The cast
  play their idle strips, turn to face Purple within three tiles and hop once on a meeting; none of
  it under reduced motion. The minimap drops to one pixel a tile at short landscape and narrow
  phones, steps back to 25% whenever a figure is under it, and Purple's marker is a 12px diamond at
  every scale. A safe reveal tile's note reads "What to watch for". `e2e/perks.spec.ts`,
  `test/forks.test.ts`, `test/perk-effects.test.ts`; `e2e/minimap.spec.ts` takes the map first.
  **Assumed:** a fork's sign lists one character per heading (up to three); the face is the
  figure's sheet frame at 1x, since most of the cast have no portrait. **Not reviewed:** the
  eleven new chrome lines need the COPY_REVIEW read.

- **Client round 2026-10-22: the cabinet, the replay hook, copy into content (`f34ea67`; its
  review round `6e1192f`).** Four asks, all approved by the client in chat:
  - **The arcade cabinet is THE presentation**, reversing the "no to the cabinet" above on the
    client's word. A marquee (the supplied white Cyera logo beside "Off the Path"), a dark purple
    body with a soft Lilac glow (still under reduced motion), the world in a bezel, and a deck with
    a joystick and an A button that work with mouse, touch and keyboard. `ui/cabinet.ts` reserves
    the marquee (40px) and the deck (120px) BEFORE `stageFit`, so integer zoom holds: 1280x800 keeps
    zoom 2 with the deck below; phones keep the deck in the docked strip and lose only the marquee;
    a phone held sideways, and the client's 1673x449, put the stick and A beside the screen. Lime
    is A's only while you play (the forest; an open offer was included until the card began opening
    by itself, see the morning round below); on Title and
    Results the CTA keeps it and A is Lilac and disabled. The page ground is dark again, by the
    client's decision; the near-black share it moves is not a drift.
    **Known gap, still open (`camera.ts` has no cabinet in it at `3c88684`):** `cameraFor()` in `packages/core/src/camera.ts` does not know
    the cabinet, so `pnpm world` and the graybox composition guards now frame a camera the game no
    longer builds (trap 1). `cabinetFor` is written to be lifted into camera.ts as-is.
  - **The reveal's replay hook**: each bad card replayed with its giveaway line marked, "You caught
    N of 4", and Walk it again as a secondary pill beside it (the research CTA keeps the Lime).
    **Changed in the review round (`6e1192f`), and again by the afternoon round below:** the line now reads "You kept N of 4
    bad skills out of your basket." and is not shown on a late run; a row the player did not take
    labels its line `ui.reveal.wouldHave` ("What it would have done") instead of "What it did"; the
    arrive text reserves the advance ring's real 44px width; four notes, Way Teller's bad reveal and
    the how-to's clock step were reworded as the content review proposed.
  - **Copy into content**: the last unkeyed words (`PENDING`) are `ui.howTo.go`, `ui.world`,
    `ui.offer`, `ui.card` (with `offeredBy`, "Offered by the {name}", now on the card),
    `ui.reveal.{outOf,caught,frameTitle,unanswered}`, `ui.landing.frameTitle`, `ui.cabinet`, and
    chrome's `postUnavailable` / `postLate` / `arriveNext`. `ui.chrome` is a strict object of
    `v2.CHROME_KEYS` now, not a free record; templates are schema-held to their `{holes}`.
  - **The walk-button flake**: a press carries four tiles as DISTANCE (`Input.walkFor`), not as a
    timer, so a slow phone or a starved runner walks it slower and never shorter; the e2e waits for
    the carry to finish. The same treatment for the walk-underway and stick-hold assertions.

- **Client round 2026-10-22, morning: the interactions (`3e2473e`, `02420d6`).**
  - **The card opens by itself.** An offer is ONE panel (`ui/Dialogue.tsx` with the card body from
    `ui/SkillCard.tsx`): who is speaking and their greeting, the skill's picture, name, promise and
    the dealt card's lines, then Take it / Leave it and Walk on. main.ts sends the INSPECT a MEET is
    owed (`world/run.ts cardOwed`), so the reveal's `read` stays true; Walk on and Esc go straight
    back to the forest (`walkOn`). On a short window the card scrolls inside its panel under the
    answers, which are held at the scrollport's foot; the page never scrolls. `ui.offer.openCard`,
    `ui.card.title`, `ui.card.back` and `ui.card.offeredBy` are gone from content and schema (the
    speaker's name now says who offers it). The deck's `talk` mode went with the step it served: A is
    idle and Lilac in an open offer, as on every other panel.
  - **The joystick follows the keys**: the knob leans the way the arrows and WASD walk, diagonals at
    a straight press's length, back to centre on release, a shorter lean under reduced motion.
  - **The focus ring on text-link controls** (Walk on, the music switch) is a 2px outline 3px clear
    of a rounded box, no halo; every other focusable control was checked and is a pill or a circle
    whose ring already follows its shape.
  - **Copy, all seven read in both variants**: greetings name the thing offered ("this compass",
    "this signpost", "these words"...), promises are in one voice ("It ..."), Way Teller's giveaway
    says "Obeys", Slow Post's bad reveal says the peeking friend was the wolf, and four real-world
    notes are plainer (Way Teller says "a skill", not "an agent"; Night Light loses "human approval
    that important actions need"). `docs/GAME_DESIGN_V2.md`'s two copy tables are brought up to date.
  - **The art follow-ups**: each reveal row shows its skill's icon at the art's own 64px, pixelated,
    named by the skill; `e2e/hud.spec.ts` gives the basket the seven real icons and proves the
    placeholder on a fixture that names art no painter will draw (`item-not-painted`), as
    `test/hud.test.ts` does; `docs/ASSETS.md` counts fifteen images and `GAME_DESIGN_V2.md` no
    longer says four icons are missing.

- **Client round 2026-10-22, afternoon: the screens (`8c4dc49`).** Score and par are as that
  commit left them; the how-to wording and par moved again in `2b42743`, below.
  - **Clear instructions.** The how-to is four short lines: each character offers a skill; three
    are good, four are malicious; read the card and take only the good ones; reach Grandma in 3:00,
    faster scores higher. The landing carries the same premise in one line (`chrome.landingPremise`,
    a `.otp-body-text`, so it is the first thing the fit ladder lets yield on a short card).
    `test/reveal.test.ts` reads the number words back against `deal.good` and the cast. The HUD is
    unchanged: the basket already shows what was taken, and nothing on it says which were good.
  - **The reveal, score first, then the cards.** The ending as the page's h1, the score out of 100
    with core's parts (`run.choices`, `run.speed`, `run.timeMs` against `run.parMs`, none computed
    in the UI), "You spotted N of 4 bad skills" (a bad card counts only if it was OPENED and left,
    so the late run's "4 of 4" problem is gone by definition and the count is shown on every
    ending), Walk it again beside it. Then seven tiles in walking order -- picture, name, Safe /
    Unsafe as a glyph and a word, what you did -- each a real button with `aria-expanded` that
    turns over (a 320ms rotate, none under reduced motion) to the marked giveaway line, promise
    against what it did or would have done, and the real-world note. Then the question and the one
    Lime, then the post form and the board. `e2e/results.spec.ts` is the browser half.
  - **The name is typed** (reverses D4 on the client's word): a labelled text field pre-filled with
    a minted suggestion, "Suggest a name", and the board's own rule (`v2.checkName`) checked before
    posting, with one sentence per refusal reason tied to the field by `aria-describedby`.
  - **Your run on the board at once.** The adapter now marks the reader's own row (`entry.yours`,
    `withYourRow` in `net/leaderboard.ts`, from the rank the server counted) and places it from the
    post's answer when the edge-cached board has not caught up; Results marks it through
    `boardRowKey` and adds "Joining the board" in words while it is `pending`. A wolf run is told
    up front that it does not go on the board (`chrome.wolfNotPosted`), since apps/api refuses it.

- **Client round 2026-10-22, evening: "i cant find the character" (`f78dc5f`).** The client finished a run with the Cat's Latch Lifter marked "You walked past".
  - **A minimap, top right of the world** (`ui/Minimap.tsx`, `world/minimap.ts`, `hud.css`). An
    inline SVG in the world box, drawn from the loaded map -- paths and bridges, the stream, open
    ground, Grandma's cottage, one dot per cast member at their spawn, Purple as a Lilac diamond --
    at a whole number of CSS pixels a tile (3 wide, 2 elsewhere, 1 in the `overlay` cabinet) and on
    whole pixels. A dot is a Haze ring until met and solid after; nothing on it carries a skill.
    One polite sentence for a screen reader (`chrome.mapSummary`, "Map: 5 of 7 met"), changed only on
    a new meeting. The keyboard hint stops short of it. `test/minimap.test.ts`, `e2e/minimap.spec.ts`
    (no overlap with the clock, basket, hint or pad at 375, 768, 1280, 844x390 and 568x320).
  - **The door asks first** (`ui/DoorCheck.tsx`, `main.ts`, `ForestScene.stepBack`). With anyone
    unmet, the doorstep opens "You haven't met N of the 7 characters yet. Go in anyway?" with the
    names; Keep looking (default, focused, Esc) steps Purple back the way she came, Go in enters.
    The clock keeps running and only the walk pauses. Five `chrome.door*` keys. `e2e/door.spec.ts`;
    `play.spec.ts` answers Go in where a run walks in early.
  - **The flip tiles.** An open tile is one outlined box (the edge and the focus ring are the
    `li`'s, not the face button's); while any tile is open the list is one column in walking order,
    so no holes; "It promised / What it did" is a label above its line, side by side only when the
    tile itself is 560px wide (a container query). `e2e/results.spec.ts`. Also: `toTheReveal` now
    waits for Results to take focus, which was a real race in the keyboard spec.
  - **Deferred / assumed.** The new copy (`doorAsk` and the rest) has not been through COPY_REVIEW.
    "Met" means MEET reached, so a character met and walked past without an answer counts as met
    and the door does not ask about them; the reveal still says "You walked past" for that card.

- **Later the same day (`2b42743`, `7b28bc4`, `3c88684`).** The how-to is four lines in the
  content: "Seven skills: three good, four malicious.", "Read each card. Take only the good,
  leave the malicious.", "Reach Grandma in 3:00. Faster scores more." and "From 2:00 left, the
  forest slowly darkens."; on the smallest fit rung its heading is visually hidden and stays the h1
  for a screen reader. Bigger HUD text. Word Weaver's paper bird flies toward Grandma's door. The
  bridge join is clean. **The Cat stands in the clearing above the cottage approach** (still last
  in the walk, clear of the door; `f78dc5f` had first moved it onto the main track), which makes
  the content-order tour **113 tiles** (measured 2026-10-22: rabbit 7, toadstool 3, owl 19, magpie
  34, snail 9, lantern keeper 10, cat 16, cottage 15) against a measured maximum of 115, and par
  **1:47** (`scoring.parMs` 107000). Every bend of the riverbank reads as one continuous shore.

## Milestones

| Milestone                                                                                                                                               | When           | What you can show                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------- |
| **M0 Foundations**                                                                                                                                      | End of Phase 0 | Repo, CI, brand tokens, graybox art, decisions made.                                                                  |
| **M1 Walking Purple**                                                                                                                                   | End of Phase 2 | Move Purple around the graybox forest on keyboard and touch.                                                          |
| **M2 Vertical slice**                                                                                                                                   | End of Phase 4 | One full encounter (Rabbit + Cottage Finder) from talk to verdict to basket, in brand UI. **Show stakeholders here.** |
| **M3 Feature complete**                                                                                                                                 | End of Phase 6 | Three skills, cottage finale, results, leaderboard (mock or live).                                                    |
| **M4 Release candidate**                                                                                                                                | End of Phase 7 | Embedded, accessible, fast, hardened.                                                                                 |
| **M5 Launch**                                                                                                                                           | End of Phase 8 | Live on the Off the Path page, monitored.                                                                             |
| Rough total: 6 to 8 weeks of calendar time with one engineer, one artist part-time, and reviewers on call. Real art is the main schedule risk (see D2). |

## Open decisions (resolve in Phase 0; recommended defaults in bold)

| ID  | Question                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Recommended default                                                                                                                                                                                                                                         | Owner                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| D1  | Is Night Light genuinely safe, or malicious too?                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Safe**, so "reject all" is not optimal. Update the Results mock copy accordingly (the mock shows it malicious).                                                                                                                                           | Game design + research |
| D2  | Who produces production pixel art and when? Concept board is flattened.                                                                                                                                                                                                                                                                                                                                                                                                                                           | **Design team or a pixel artist produces tileset, sprites, portraits** against `docs/ASSETS.md`; graybox until then.                                                                                                                                        | Design lead            |
| D3  | Leaderboard backend host                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **Vercel Functions (Node) + managed Postgres/KV** behind a swappable interface (originally Cloudflare Workers + D1; changed because the game deploys on Vercel).                                                                                            | Eng + Security         |
| D4  | Handle only, or optional email field for research follow-up?                                                                                                                                                                                                                                                                                                                                                                                                                                                      | **Handle only** (no gate before the research). **Reversed by the client 2026-10-22**: a work email behind `OTP_WORK_EMAIL`, off for now (see "Decisions recorded").                                                                                         | Marketing + Legal      |
| D5  | Mobile portrait layout                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | **Canvas on top, panels docked at the bottom; never require rotation.**                                                                                                                                                                                     | Design                 |
| D6  | Real Haffer / Season Mix files available?                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | **Yes: request woff2 from Brand Kit**; fallbacks meanwhile.                                                                                                                                                                                                 | Brand                  |
| D7  | Scoring weights. **Superseded in v2 (2026-10-22): clean 10, good 20 each, speed 30, out of 100, par 1:47 (`content/game.v2.json`, `scoring`); what follows is v1.** **As shipped in v1: best verdict 200, safe but costly 100, compromised 0, and Word Weaver restrict 50** (because restricting it now earns an errand goal; at 100 it was a free trade). Question bonus +100, boundary bonus +200, trust bonus +100, three errand goals at 100. The "partial credit 150" this row used to name was never built. | **Resolved 2026-10-17** by the three errand goals: reject-all is 700 against a 1,000 ceiling and draws its own ending, and the best full-errand line (750) beats it. Restrict-all at 950 — the figure for a run that reads the forest post — is still open. | Game design            |
| D8  | Must the player meet all three characters before the cottage? (v1; superseded in v2, where any of the seven can be walked past)                                                                                                                                                                                                                                                                                                                                                                                   | **Yes** (consistent scores).                                                                                                                                                                                                                                | Game design            |
| D9  | Where is the game hosted and who owns analytics?                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | **Static host under a cyera.com subdomain, embedded by iframe; parent page owns analytics via postMessage events.**                                                                                                                                         | Web team               |
| D10 | Leaderboard retention, moderation, privacy review                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **Handle + score only, 12-month retention, manual delete endpoint, Legal sign-off before launch.**                                                                                                                                                          | Legal + Security       |
| D11 | After the 2026-10-21 rename of the protagonist from Red to Purple, is she "Purple" or "Little Purple"? Her cloak is Aubergine and the brand rules ban red outright, so "Red" was a contradiction from the first commit; the fairy-tale shape survives the rename and the colour error does not.                                                                                                                                                                                                                   | **"Little Purple" in player-facing copy, "Purple" in code, identifiers, docstrings and docs.** A player meeting "Purple" alone reads a colour; "Little Purple" reads a person and keeps the tale's shape. Four player-facing strings carry the long form.   | Game design + Brand    |

### Decisions recorded (2026-10-15, Phase 0)

All ten decisions take the recommended default above. Owners should confirm; two need action outside engineering.

| ID  | Decision                                                                                                                                                                                                                                                                                                                                         | Status                                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **Amended 2026-10-16:** Night Light has no fine print, so it stays honest on inspection, but it is no longer safe by default. Best verdict is Restrict, which grants nothing; Allow leaves it reading what strangers wrote.                                                                                                                      | Amended by `docs/MAKING_IT_BETTER.md` section 3; recap copy updated. **Research has not confirmed the direction** — `docs/RESEARCH_ALIGNMENT.md` open question 4 is still open, and its owners are game design + research. |
| D2  | Design team or a pixel artist produces tileset, sprites, portraits. Graybox until then.                                                                                                                                                                                                                                                          | Brief drafted in `docs/PHASE0_REQUESTS.md`, not yet sent                                                                                                                                                                   |
| D3  | **Changed 2026-10-16:** Vercel Functions (Node 22 runtime) in the same Vercel project as the game, behind `LeaderboardClient`. Same origin means no CORS and `connect-src 'self'`. **Store settled in Phase 6: Supabase over PostgREST through `fetch`** — no driver and no new dependency, rather than the "Postgres or KV" this row left open. | Recorded; **Security still to confirm, and `security-reviewer` has not been run on the shipped service**                                                                                                                   |
| D4  | Handle only, no email field.                                                                                                                                                                                                                                                                                                                     | **Reversed by the client 2026-10-22:** a work email + consent to post, behind `OTP_WORK_EMAIL` (off until Legal signs off; DATABASE.md Decision 5)                                                                         |
| D5  | Canvas on top, panels docked at the bottom on portrait; never require rotation.                                                                                                                                                                                                                                                                  | Recorded                                                                                                                                                                                                                   |
| D6  | Request Haffer and Season Mix woff2 from Brand Kit.                                                                                                                                                                                                                                                                                              | Request drafted, not yet sent                                                                                                                                                                                              |
| D7  | Start with GAME_DESIGN section 7 scoring; tune in Phase 8.                                                                                                                                                                                                                                                                                       | Recorded                                                                                                                                                                                                                   |
| D8  | Player must meet all three characters before the cottage. (v1; superseded in v2.)                                                                                                                                                                                                                                                                | Recorded                                                                                                                                                                                                                   |
| D9  | Static host on a cyera.com subdomain, iframe embed, parent page owns analytics.                                                                                                                                                                                                                                                                  | Recorded; Web team to confirm                                                                                                                                                                                              |
| D10 | Handle + score only, 12-month retention, manual delete endpoint, Legal sign-off before launch.                                                                                                                                                                                                                                                   | Recorded; Legal sign-off pending. **Reopened 2026-10-22** by the work-email decision (migration 0007, not run)                                                                                                             |

---

## Phase 0: Foundations and decisions (M0) [target: 2 to 3 days]

Goal: a green, empty-but-real project; decisions made; art unblocked.

- [x] (S) Create repo, pnpm workspace (`packages/core`, `apps/game`, `apps/api`, `tools/*`), strict TS config, ESLint, Prettier, `.gitignore`. Copy this kit's `CLAUDE.md`, `.claude/`, `docs/`, `content/`, `reference/` into it.
- [x] (S) Pin dependency versions (check publish dates; skip anything under 14 days old). Commit lockfile.
- [x] (S) CI workflow: install, typecheck, lint, unit tests, build, `pnpm audit`, Playwright smoke.
- [x] (M) **Spike: Phaser vs hand-rolled canvas.** Build a 100-line prototype of each (tilemap + moving sprite + resize). Record gzipped JS size and mobile fps. Keep Phaser unless over budget (ARCHITECTURE section 11). Write the result into `docs/ARCHITECTURE.md`.
- [x] (S) `apps/game/src/ui/tokens.css`: import the brand theme; add game-specific tokens (panel radius, border widths, sizes from BRAND_AND_UI) as CSS variables.
- [x] (M) `tools/graybox`: generate placeholder tileset, `map-forest.json` with all landmarks, sprites, portraits, items with final names (ASSETS.md).
- [ ] (S) Resolve D1 to D10 with owners; record answers in this table. Update GAME_DESIGN if D1/D7/D8 change.
- [ ] (S) Request: Haffer + Season Mix woff2, symbol logo files if wanted, pixel-art brief handed to design (send ASSETS.md + the board).
- [x] (S) Update CLAUDE.md "Commands" with real scripts.
      Acceptance: `pnpm install && pnpm typecheck && pnpm lint && pnpm test && pnpm build` all pass in CI; graybox art loads in a blank Phaser scene; decisions table filled.

## Phase 1: Core rules, test-first

Goal: the entire game works as pure logic with no graphics.

- [x] (S) `content.ts`: zod schema for `content/game.json`; loader; **content lint** (every skill has 3 outcomes; `bestVerdict` has the max points; at least one skill without `finePrint`; flags used exist; no empty strings; no banned vendor words). Copy `game.seed.json` to `game.json`.
- [x] (M) `state.ts` + `reducer.ts`: `GameState`, actions (`START`, `MEET`, `ASK`, `INSPECT`, `VERDICT`, `ENTER_COTTAGE`, `FINISH`, `RESET`), phase transitions and guards (can't give a verdict before inspecting; can't enter cottage before three verdicts; verdicts final).
- [x] (S) `runlog.ts`: append-only run log with injected clock; legality validator (`isLegalLog(log, content)`), used by the API later.
- [x] (M) `scoring.ts`: `score(log, content)`, per-skill breakdown, question bonus rule, tiebreak helper.
- [x] (S) `outcomes.ts`: basket and flags derivation, `ending(state)`, recap rows (one per skill).
- [x] (M) Tests: table-driven skill x verdict; reject-all, allow-all and perfect-run totals (with the seed content and no questions asked: reject-all 600, allow-all 300, perfect 900; perfect plus the question bonus 1000; adjust if content changes); illegal sequences rejected; log replay equals live state (property test).
      Acceptance: `pnpm test` green, 100% branch coverage on `packages/core`; a CLI script `pnpm sim` plays any strategy through the reducer and prints score + ending.

Phase 1 notes (2026-10-16):

- Decisions: Night Light "restrict" was set at 150 here, shipped at 100, and is **200 and the best verdict** since 2026-10-16. Only the `needs` and `who` questions earn the +100 bonus (`scoring.bonusQuestions` in content); "Show me" never does. Flags are set at verdict time.
- Totals with `content/game.json`. **Superseded 2026-10-17** by the three errand goals. **Say which run shape a total belongs to**: two of the three goals need a notice read, so the same verdicts score differently depending on where Purple walked, and this line used to mix the two. Without questions and (with):

  | Line                    | Straight to the cottage, no notice read | Both notices read |
  | ----------------------- | --------------------------------------- | ----------------- |
  | perfect (`rst/rej/rst`) | 900 (1,000)                             | 900 (1,000)       |
  | restrict-all            | 750 (850)                               | 850 (950)         |
  | reject-all              | 600 (700)                               | 600 (700)         |
  | allow-all               | 100 (200)                               | 200 (300)         |

  The restrict-all figure here was 850 (950) under a "walking straight to the cottage" heading; that is the right-hand column's number. Two lines reach 1,000, with questions asked: `restrict/reject/restrict` anywhere, `restrict/reject/allow` only after both notices. `pnpm sim` prints the right-hand column. So does the per-line table in `docs/DESIGN_V2.md` — which is correct but does not say so — and `docs/GAME_DESIGN.md` section 7 carries both columns.

- Actions added beyond the plan list: `BEGIN` (intro to explore), `BACK` (Esc closes one panel level), `LEADERBOARD` (results to leaderboard). Rejected actions return the same state plus a typed reason (`tryReduce`).
- `content/game.json` gained `startBasket` (`key`, `letter`) and `scoring.bonusQuestions`. `content/game.seed.json` is left as the original kit seed.
- Core imports use explicit `.ts` extensions so Node can run the sim without a TypeScript runner.

## Phase 2: The forest world (M1)

Goal: walk Purple around the graybox forest on any device.

- [x] (M) Boot: load content + assets (fail loudly on missing), Phaser config (`pixelArt`, `roundPixels`, 480x270, FIT scaling, integer zoom, letterbox).
- [x] (M) Tilemap loader for `map-forest.json` with layers (ground, decor-below, decor-above, collision); objects layer parsing (`spawn-purple`, `npc-*`, `trigger-cottage`).
- [x] (M) Player: 4-direction movement, speed tuned (about 60 px/s logical), tile collision, camera follow with world bounds, depth sorting so Purple walks behind canopy tiles.
- [x] (M) Input layer: keyboard (arrows/WASD, Space/Enter/E), **DOM virtual joystick + A button** (pointer events, multi-touch safe), unified `InputState`. Pause input when `phase !== 'explore'`.
- [x] (S) NPC placement from objects; interaction radius; floating "A" prompt (bobbing, respects reduced motion).
- [x] (S) Event bus + store wiring (ARCHITECTURE section 6). `interact(characterId)` flips `phase` to `dialogue` (UI not built yet; log to console).
- [x] (S) Cottage trigger: emits `enteredCottage`; gate logic uses `canEnterCottage`.
- [x] (S) Perf pass: no per-frame allocations; check 60 fps on a throttled mobile profile.
      Acceptance (M1): Purple walks the whole map on keyboard and touch without clipping through collision; camera is smooth; NPC prompts appear in range; resizing and rotating keep pixels crisp.

Phase 2 notes (2026-10-16):

- Movement and collision are hand-rolled in `apps/game/src/world/logic.ts` (pure, 26 unit tests) rather than Phaser Arcade Physics: deterministic, testable, and no per-frame allocations. Phaser draws the tilemap and sprites, and nothing else.
- Scaling: Phaser runs at a fixed 480x270 with `Scale.NONE`; `ui/stage.ts` sets the canvas CSS size to a whole number of device pixels per game pixel (`integerZoom`), verified at DPR 1, 2 and 3. Phaser's FIT mode produced fractional scales and blurred the art.
- Camera uses `cameraTopLeft` with rounded, clamped scroll, so tiles never shimmer.
- Depth: Purple sorts by her feet; the `decor-above` canopy layer is pinned above everything, so she walks behind tree tops.
- Until Phase 3 there is no title screen: the run auto-starts, and dialogue and the cottage hint appear as a plain DOM toast.
- Measured: 60 fps while moving at 4x CPU throttle and DPR 2, with a flat JS heap. Bundle is now 368 KB gzipped against the 450 KB budget; Preact and the UI still have to fit, so Phase 3 should watch it.
- Not verified: a real phone. Touch is covered by Playwright emulation only; check a Vercel preview on a device before closing M1.

## Phase 3: Brand UI overlay

Goal: every panel from the mocks exists as accessible DOM, driven by the store.

- [x] (M) Base: `Panel` (frame + 40px header + number/title/dots), `DialogueBox`, `Button` (primary Lime, Haze, Deep Purple variants), `Pill`, focus ring styles. Build Storybook-style `/ui-lab` dev page (not shipped) showing every component in every state beside its mock PNG.
- [x] (M) `Title` / `Intro` screens (Grandma's note, quest line, Play button; Cyera logo as-is).
      Built as `apps/game/src/ui/Title.tsx` and covered by e2e (`title-claims.spec.ts`, plus the title
      shots in `game.spec.ts` and `css-contract.spec.ts`) and by `apps/game/test/title.test.ts`.
- [x] (M) `Dialogue`: portrait, typed-in text (skippable; instant under reduced motion), three question options with keyboard navigation and `aria-live`.
- [x] (M) `SkillCard`: icon well, promise row, fine-print row (only if present), Allow/Restrict/Reject (equal width, **no Lime on any verdict button**), focus trap, Esc back-out; `Basket` with five slots.
      This line used to say "Lime on Allow". `docs/UI_FOUNDATIONS.md` section 2, `docs/BRAND_AND_UI.md` and `docs/HANDOFF.md` all forbid it — Lime on Allow makes the unsafe answer the brightest thing on screen — and the shipped card correctly does not do it: there is no Lime in `panels.css` at all. Do not reinstate it from this plan.
- [x] (S) `HUD`: quest pill, joystick and A (from Phase 2) skinned per spec.
- [x] (S) Responsive rules at 375 / 768 / 1280, portrait docking (D5).
- [ ] (M) Visual tests: Playwright screenshots of `/ui-lab` components vs the mock crops, with tolerance; axe scan; contrast test on every token pair used.
- [x] Run `brand-reviewer`; fix findings. Ran 2026-10-16: a fail with twelve findings, all listed and
      resolved under **Brand review** in Phase 5 below, with one open deviation recorded there for sign-off.
      Acceptance: each component visually matches its mock; keyboard-only operation works; axe has no serious or critical violations.

Phase 3 notes (2026-10-16), partial:

- Done: `Panel` (frame, 40px header, number/title/dots), `Dialogue` (portrait, typewriter text skippable and instant under reduced motion, three options with arrow-key navigation and `aria-live`), `SkillCard` (icon well, promise row, fine-print row, Allow/Restrict/Reject, focus trap), `Basket` (five slots), the HUD quest pill, and responsive rules at 375 / 768 / 1280 with portrait docking.
- Not done at the time of this note: Title and Intro screens, the `/ui-lab` page, Playwright screenshot comparison against the mock PNGs. Results and Leaderboard belong to Phases 5 and 6.
  **Since then (2026-10-20):** Title and Intro ship and are e2e-covered, so that box is ticked above. The `/ui-lab` page and the mock screenshot comparison are still the only open items in this phase.
- Item icons moved into `content/game.json` as `items` (basket item id to asset key), with a lint that every basket item has an icon and no icon is listed that never reaches the basket. Keeps rule 3: adding an item needs no code change.
- Two real bugs found by testing: the focus trap re-ran on every render and kept pulling focus back to the canvas, and the world input layer's `preventDefault` on Space and Enter cancelled activation of the panels' own buttons. The input layer now stands down whenever `phase !== 'explore'`, and owns Esc alone.
- Art: `tools/graybox` is now a procedural pixel-art generator (shaded ramps, textured grass, autotiled paths and shores, a winding river with a waterfall, 2x2 tree canopies over two-tile trunks, cottage, market stall, well, lantern post) rather than flat colour rectangles. Still placeholder art: D2 stands, and a pixel artist's work would replace it file for file.
- Bundle is 376 KB gzipped against the 450 KB budget.

## Phase 4: Vertical slice, Rabbit and Cottage Finder (M2)

Goal: one encounter end to end through the real systems.

- [x] (M) Wire Dialogue to content: greet, three asks (record `asked`), "Show me" opens SkillCard (record `inspected`).
- [x] (S) Verdict flow: apply outcome (basket, flags, log), brief verdict toast (shape + text, no color-only), return to explore.
- [ ] (S) Quest marker updates; "route" in the basket unlocks a subtle path hint in the world (a footprint trail graybox).
- [x] (M) Playwright e2e: talk, ask all, inspect, Restrict -> basket has route + key, score 300 so far.
- [ ] (S) Internal demo build deployed to a protected preview URL.
      Acceptance (M2): a stakeholder can play the Rabbit encounter on their phone and desktop with brand-correct UI. Collect feedback on card readability: _can a first-time player find the fine print?_ Adjust copy and layout before replicating to other skills.

Phase 4 notes (2026-10-16): the encounter runs end to end through the real store, content and UI, and
is covered by e2e. Not done: the "route" path hint in the world (a footprint trail), and the protected
preview deploy, which waits on GitHub and Vercel being connected.

## Phase 5: Remaining content, finale, results

Goal: the full game.

- [x] (M) Owl (Word Weaver) and Lantern Keeper (Night Light) encounters via data only; fix any code that needed special-casing (that is a bug in the design).
- [x] (M) Cottage finale: wolf-as-Grandma scene (silhouette in window, paw prints, door sequence); ending chosen from flags (clean / close / wolf's house). No shake, no gore: slow fade and held beat.
      This line used to require _"Grandma, why do you need my key?"_ when `keyStolen`. **That line was
      deliberately removed and must not be reinstated from this plan.** `endings.close` matches on a
      flag count, not a flag identity, so it also drew for two single-flag runs that still had the key
      in the basket on the same screen. The close ending now opens "Grandma, where did you get that?",
      which names nothing. `apps/game/test/content-copy.test.ts` guards the general rule — an arrival
      may not name a thing the player can still see in the basket — and `docs/GAME_DESIGN.md`
      section 8 records why.
- [x] (M) Results screen: score, per-skill recap rows (success vs missed styling), "Post your score" handle field with validation and clear privacy line, **Read the Research** band with the screen's one Lime.
- [x] (S) Replay: reset store, new run id, back to title.
- [ ] (S) **Research review pass**: send all fine-print and recap copy to the research team; apply edits in `content/game.json` only.
- [ ] (M) **Real art swap-in checklist** (as assets arrive): tileset, map, Purple, NPCs, portraits, items; re-verify collision and depth sorting after each swap.
- [x] (S) e2e: perfect run = 1000 and "clean" ending; reject-all (no questions) = 600 and, since 2026-10-17, "The long way round"; allow-all (no questions) = 100 and "wolf's house".
      Acceptance (M3 part 1): all three endings reachable and tested; copy approved by research.

Phase 5 notes (2026-10-16):

- Owl and Lantern Keeper needed no code: both encounters run from `content/game.json` alone, which is
  the design holding up. Adding a fourth skill would need content only.
- Cottage finale: panel 04 with the wolf-as-Grandma portrait, the approach beats, then the ending
  chosen from flags. The key line plays when `keyStolen`. No shake, no gore: a fade and a held beat.
- Results: score, one recap row per skill (success vs missed styling), the basket, handle field with
  validation matching the server rule, the privacy line, and the Read the Research band carrying the
  screen's one Lime.
- Posting a score is stubbed behind `LeaderboardClient`, which reports the board unavailable. The real
  Vercel Function adapter is Phase 6; the game never blocks on it.
- Verified totals in the browser: perfect 1,000, reject-all 600 (now "The long way round"), allow-all 100 (wolf's house),
  and the close-call ending when only the key is taken.
- `docs/COPY_REVIEW.md` lists every player-facing string with its status for the research team.
- Not done: the real art swap-in (D2 still open), and the `/ui-lab` page with screenshot comparison.

### Brand review (2026-10-16)

A `brand-reviewer` pass on the Phase 3 UI returned a fail with twelve findings. Fixed: the one
hard-coded hex, focus rings that failed contrast on light surfaces, Stone body text under 4.5:1,
paragraph margins inherited from the brand theme, basket slots silently shrinking below spec at phone
widths, non-integer pixel-art scaling, the inverted advance caret, Allow being auto-focused on the
skill card, the modal scrim not taking pointer events, unused motion tokens, and the joystick skin.
Also fixed from the same pass: `role="option"` inside `<li>`, and `aria-live` re-announcing the
typewriter on every frame.
**Open deviation, needs sign-off:** the Explore quest pill floats in a HUD rather than sitting in an
Explore panel header. The panel frame is a device of the concept board; in the real game the world
fills the viewport and there is no header to sit in. If design wants the frame, it is a small change.

## Phase 6: Leaderboard

Goal: simple, safe, optional leaderboard.

**Phase 6 landed on 2026-10-20 (commit `3dc0357`), and it did not land in the shape this list
specified.** The boxes below are reconciled against the tree. Where a task was deliberately dropped
rather than done, it is struck through with the reason, so nobody completes it as an oversight.
`apps/api/README.md` is the service's source of truth and `docs/ARCHITECTURE.md` section 8 records
why the shape changed.

- [x] (S) `LeaderboardClient` interface + adapter. **No in-memory mock was needed** — the interface
      shipped in Phase 5 with a stub behind it, and Phase 6 replaced the stub with the real adapter
      behind the same interface. The board is **not a separate screen**: it renders inside
      `Results.tsx`, which is where the handle and the one Lime CTA already were.
      **This sentence was ASPIRATIONAL for a round and is true only from 2026-10-21.** When it was
      written, `top()` was implemented and tested and `grep -rn "\.top("` across `apps/game/src`
      found no caller at all: there were no board elements on Results and no board rule in any
      stylesheet, so a player posted a score and never saw a list, deployed or not
      (docs/PAUL_BRIEF.md section 5 records the measurement). It is recorded here rather than
      quietly corrected because the next reader has no other way to tell which claims in this file
      are load-bearing and which are intent — and two reviewers took this one as evidence the board
      existed.
- [x] (S) The board on Results, and the three-state read behind it (2026-10-21). `readTop()` answers
      `rows`, `empty` or `unavailable` and never reports an ABSENT board as an EMPTY one — the SPA
      catch-all serves `200 text/html` for an undeployed `/api/top`, which the old `LeaderboardEntry[]`
      return could only have rendered as "no runs yet". Rank tints, your own row matched locally,
      one live region, no Lime, and nothing from the wire set as markup.
- [x] (S) The payoff screen cannot state two contradictory things about its own state (2026-10-21).
      After a post, an empty board read said "No runs on the board yet. Yours would be the first."
      directly under "Posted to the board as …". It is the launch case, not a corner: `GET /api/top`
      is served with `s-maxage=60`, and the mount read primes that cache with an empty board before
      the post lands. The empty state now has copy for a visit that has posted, and
      `test/board.test.ts` plus `e2e/leaderboard.spec.ts` fail if a post can sit above a sentence
      claiming there are no runs. Same round: board reads settle by issue order rather than arrival
      order, the board heading has air above it at 375/768/1280 (it had 0.0px at all three), the
      board carries the Deep Purple body BRAND_AND_UI section 3 requires, and "Ask the board again"
      no longer looks exactly like "Walk it again".
- [x] (M) `apps/api` Vercel Functions (Node 22). **Shipped as `POST /api/score` and `GET /api/top`
      over Supabase/PostgREST** (`POST /api/start` joined them in Phase 9 E, so three routes are
      bundled today). ~~`POST /runs`, `POST /runs/:id/submit`, `GET /leaderboard`; HMAC
      token; D1 schema + migrations; week window logic (UTC)~~ — none of this was built. The token
      existed to bind a run to a start time; ranking is by score alone and there is no duration
      column, so it protected nothing. D1 was the pre-D3 Cloudflare plan. One board, no week windows.
- [x] (M) Server-side verification: legal log check and **recompute with `packages/core`** both ship,
      plus a strict body schema that makes a claimed score a 400, a 32 KB metered body gate, a
      `MAX_LOG_EVENTS` of 256, and a duplicate guard. ~~Min-duration plausibility~~ was dropped: the
      clock is the player's and ranking ignores it, so a floor would reject honest fast runs and buy
      nothing. ~~Handle blocklist~~ was dropped because **handles were minted, not typed**
      (`[a-z]+-[a-z]+-[1-9][0-9]`), re-checked on the way out of `GET /api/top`; there was no
      free-text field to moderate. **Superseded 2026-10-22: names are typed now, and `v2.checkName` (core
      `v2/board.ts`) is the blocklist and the shape check, run by the game, by the score route and
      by the store before the insert.** Escape on render is Preact text nodes.
- [x] (S) Rate limiting: `src/limit.ts`, thirty writes a minute, **per instance**. ~~Hashed,
      salt-rotating IP keys~~ dropped — **no IP is read, hashed or stored at all**, which is
      stronger than the task asked for. ~~CORS to embed origins~~ is moot: same origin by D3.
      **The cross-instance control is Vercel firewall rate limiting on `/api/*` and it is NOT ON.**
      See "What is NOT done" below.
- [x] (S) http adapter with timeouts (6 s) and graceful degradation; never blocks results or the CTA.
- [x] (M) Tests: 53 across 5 files when this landed (`apps/api` runs 202 across 12 files today,
      measured 2026-10-22), including the forged-log suite — claimed score, unreachable
      score, a verdict whose card was never opened, a run that never arrived, an oversized body, a
      duplicate. `apps/game/e2e/leaderboard.spec.ts` covers the board; the API-down path is the
      `503` case, asserted in `routes.test.ts` ("when the board is not there").
      **"covers the board" was ASPIRATIONAL for a round, same as the bullet above.** Until
      2026-10-21 that file covered the POST FORM only — four specs, all of them against
      `/api/score` — because there was no board on the page to cover. It covers the board now:
      the three read states, the rank tints, the live region, a successful post above an empty
      board, two reads racing, the vertical rhythm at the three reviewed widths and a Lime sweep in
      every state rather than only the two with rows.
- [ ] (S) Moderation: admin delete endpoint, and `docs/RUNBOOK.md`. **Neither exists.** An
      unauthenticated delete endpoint would be worse than none, and the only secret the service may
      read is the Supabase key, so this needs Vercel deployment protection or a new server-only
      variable first. Removing a row is SQL in the Supabase console until then. D10 is waiting on it.
- [ ] Run `security-reviewer`; fix findings. **Not run on the shipped service.**
      Acceptance (M3): **not met yet.** The service is built and tested in-process, but nothing here
      has run against the live board — this checkout has no credentials — so "a real run posts and
      appears with the correct rank" is unproven. The game is fully playable with the board down,
      which is proven.

### Phase 6: what is NOT done, and must be before the board is believed

Recomputing every score bounds what a row can **say**. It does not bound how many rows a caller can
write. These three are from `apps/api/README.md`; that file is the authority, this is the pointer.

1. **Turn on Vercel firewall rate limiting for `/api/*` and prove it on a preview.** The only
   control that spans instances, and the one thing here that cannot be done from the repository.
2. **Make dedupe durable** (a `log_hash` column + unique index). It is a third column on a table
   whose decision reads "handle and score only", so it **reopens D10** rather than being a quiet
   migration. The code does not write it today, so the SQL is safe to run early.
3. **Set retention.** `created_at` exists and nothing prunes it, against D10's twelve months.

### Phase 6: two calls that are a human's, not an agent's

Neither blocks the work above; both are recorded here so they are not decided by default.

1. **Nine player-facing strings have not been through the Legal review D10 requires.**
   `docs/COPY_REVIEW.md` says leaderboard and privacy copy are reviewed by Legal against D10 and
   that the review has not happened. The strings are `leaderboardTitle`, `leaderboardTitleHighlight`,
   `boardLoading`, `boardReady`, `boardEmpty`, `boardEmptyAfterPost`, `boardDown`, `boardRetry`,
   `boardYouLabel`, `boardRow` and `boardRowYou` — and `boardDown` in particular makes a
   reassurance about where the player's score lives ("Your score is still on this page"), which is
   the class of claim D10 exists to check. `test/board.test.ts` already pins that none of them
   claims a weekly reset the service does not do.
2. **"Wolf Spotters" ships with its Season Mix highlight on "Spotters", and the tension is real.**
   UI_FOUNDATIONS section 8 and BRAND_AND_UI section 3 both name it outright, and BRAND_AND_UI uses
   this exact title as its worked example of a correct highlight; against that, it is the third
   Season Mix word on the Results screen, after "actually" and "agent". The brand rule is one
   highlighted word per HEADING, and the only per-SCREEN budget in the brand is Lime's, so the
   binding docs were followed. If design wants a per-screen cap on Season Mix, it is one line in
   UI_FOUNDATIONS section 3 and one prop in `Results.tsx`.

Also outstanding and cheap: **one preview deploy answers two questions at once** — whether Vercel's
bundler follows `src/content.ts`'s import of `content/game.json` out of the service root, and
whether the top-level `headers` block reaches the `/api/*` function responses as well as the static
build, now that those routes are Vercel Functions of the game service rather than a second service
(ARCHITECTURE section 10). Both fail silently and both are invisible to CI.

## Phase 7: Embed, hardening, release candidate (M4)

- [ ] (M) iframe embed page and `postMessage` contract (ARCHITECTURE section 9); responsive container for the research page's game slot; test inside a copy of the landing page.
      **Partly done already:** the **outbound** half shipped early as `apps/game/src/embed/postMessage.ts`
      and is covered by `apps/game/e2e/embed-origin.spec.ts` — five events, one build-time target
      origin, never `*`, no-op when not framed. What remains is the host side: the embed page itself,
      the responsive container, and a test inside a copy of the landing page.
      **There is no inbound channel and "origin checks" does not describe missing work.** Nothing
      receives, so there is nothing to check. An inbound `otp:pause`/`otp:resume` would be new work
      with a threat model attached — see ARCHITECTURE section 9 — not a gap to close here.
- [ ] (S) Security headers and strict CSP on the static host. **Mostly done:** `vercel.json` ships
      the policy, `apps/game/test/csp.test.ts` guards its text against the built page, and
      `apps/game/e2e/shipped-headers.spec.ts` loads the real `dist` under the real headers in a
      browser and drives every screen with `securitypolicyviolation` as the verdict and a canary so
      an empty list means something. Zero third-party requests is asserted by `smoke.spec.ts`'s
      request handler. SRI is **not applicable**: every asset is same-origin and self-hosted.
      **What is left is the one thing only a deploy answers** — whether Vercel applies the top-level
      `headers` block to the function routes as well as the static build, now that `/api/*` is
      served by the game service's own `api/` directory rather than by a second service. Both
      guards apply the headers themselves and would stay green if it did not.
- [ ] (M) Accessibility audit: keyboard-only, screen reader pass (NVDA/VoiceOver), zoom 200%, reduced motion, contrast; fix.
- [ ] (M) Performance: bundle analysis against budget, asset compression, test on a mid-range Android and an older iPhone. **"Lazy-load leaderboard" is struck**: there is not one dynamic `import()` in `apps/game/src`, the build emits a single chunk, and the board is part of `Results.tsx` rather than a separate screen to split off. Code-splitting it is an option, not a pending task, and ARCHITECTURE section 11 warns against budgeting as if it were done.
- [ ] (S) Cross-browser: latest Chrome, Safari (iOS + macOS), Firefox, Edge. Touch: iOS Safari address-bar resize, Android Chrome.
- [ ] (S) Error handling: asset load failure screen with retry; `window.onerror` surfaces a friendly message; no stack traces to players.
- [ ] (S) Privacy copy and link next to the handle field; Legal review (D10).
      Acceptance (M4): all budgets met, zero axe serious/critical issues, no CSP violations, zero third-party requests, cross-browser matrix green.

## Phase 8: Playtest and launch (M5)

- [ ] (M) Five to eight playtests with real security leaders and practitioners (and one non-technical person). Observe silently; note where they miss the fine print or get stuck. Success: at least 6 of 8 can say, unprompted, what the game was about.
- [ ] (S) Tune copy, difficulty and scoring from findings (data only).
- [ ] (S) Replace "sample" copy and graybox leftovers; check no placeholder strings remain (content lint flag).
- [ ] (S) Launch checklist: production API secrets set, rate limits on, moderation access tested, backups, uptime check, error alert route, rollback plan.
- [ ] (S) Embed in the Off the Path page replacing the "Malicious skill finder game" placeholder; confirm the **Read the Research** button flow and the Security Leader / Practitioner toggle still work.
- [ ] (S) Post-launch dashboard: plays, completion rate, average score, verdict distribution per skill (aggregate, from parent-page events), CTA click-through.
      Acceptance (M5): live, monitored, with a named owner for moderation and content updates.

## Phase 9: v2 — collect, and find out what you collected

Spec: `docs/GAME_DESIGN_V2.md`, approved in shape by the client on 2026-10-21. Decided: v2 replaces v1
on `main`; greedy is punished; the timer is hard; there are six or seven skills; she is Purple. This
reopens the work of Phases 1, 3, 4 and 5. Staffing follows PAUL_BRIEF section 4.

- [x] **A. Rules** (L) — done `87c80ff`, beside v1; Phase D switches the game over. — `packages/core`, test-first, at the 100% gate on all four metrics. The collect
      loop with take / take-limited / leave; the basket as an inventory; the three-minute timer as an
      injected clock (no `Date`); the "never made it" ending; scoring by what each collected skill
      did; a version tag on the run log, so a v1 log can never score as a v2 run.
- [x] **B. Content** (M) — done 2026-10-21 as draft 4, after three refutations (GAME_DESIGN_V2 section 10). Checked by an independent scorer: one run of 2,187 at 1000, the best wolf run 500, the best two-clause rote rule 650. Phase C must lay the cast out in content order, Rabbit first. — six or seven skills and characters as data: what each promises, the card,
      and what it did under each verdict. The mix is tuned through `pnpm sim` until the ceiling, the
      greedy floor and restrict-everything all come out right.
- [x] **C. World** (M) — done 2026-10-22 (`542ede4`): the cast in walking order (Rabbit first, Cat last), v2 wired behind a dev/e2e-only switch with a seeded deal per run, the timer and basket HUD. The switch is gone since Phase D, and the Cat has moved twice since (`f78dc5f`, `2b42743`). — three or four new characters on the map, one regeneration with every
      changed cell claimed; a timer and the basket in the HUD.
      _Progress record, 2026-10-22 (history: the tour is now 113 tiles, see "Shipped in the client rounds"):_ the seven stand in content order —
      the Toadstool moved from (10,22) to (15,22), past the Rabbit's stall on the same verge, the one
      cast move; walk from the spawn rabbit 7, toadstool 10, owl 19, magpie 25, snail 34, lantern
      keeper 44, cat 46; content-order tour 108 tiles (104 before) against the clock test's
      maximum. One regeneration, deterministic (`cmp` clean on a second run); the changed cells are
      the Toadstool's own cell and the old one, plus one tree shifted and one planting added by the
      generator's own pass near the old spot.
      v2 runs in the real forest behind `?otp-v2`, dev and e2e builds only
      (`world/v2-wiring.tsx`): the scene reads either rulebook through `world/run.ts`, the v2 store
      stamps from an injected clock, 180 s ends the run late, the HUD is mounted, and the offer
      and ending panels are labelled placeholders for Phase D. EVERY RUN IS DEALT: the wiring
      draws a seed with `crypto.getRandomValues` for the first run and for every replay (core
      `createState(content, seed)` / `RESET { seed }`), the offer shows the dealt variant's card
      (`variantOf(state.good, skill)`), and the wolf's prints follow core's `ending`, not the data.
      `?otp-v2-seed=N` pins the seed (0 to 34 are the 35 deals). The test clock override
      (`v2Clock`), the switch (`otp-v2`) and the pin (`otp-v2-seed`) are in `csp.test.ts`'s bundle
      grep, which also covers F's first item. `e2e/v2-run.spec.ts`: seeds 0 and 34 deal different
      hands and the same character's opened card changes with them (proved by breaking the
      variant lookup); the seven met in walking order (Purple placed beside each, not walked);
      the careful run scores 100 at Grandma's, the greedy one lets the wolf in at 0; the clock
      override ends a run late.
- [x] **D. Screens** (M) — done 2026-10-22 (`39b8f5f`); the live game is v2 (landing ships without a background until the client's image arrives). The offer, card and reveal described below were reworked by the client rounds of the same day (`3e2473e`, `8c4dc49`, `f78dc5f`); read "Shipped in the client rounds" for what is live. — the how-to-play rewritten for v2; **the reveal screen**; the late
      ending; the Cyera-branded landing page (**blocked on the background image**).
      _Progress record, 2026-10-22 (as of `39b8f5f`):_ the live game is v2 -- no switch and no seed pin;
      the only test hook left is the run clock's `testClock` override on the dot-access-gated debug
      handle (in `csp.test.ts`'s bundle grep with the retired `otp-v2`, `otp-v2-seed`, `v2Clock`).
      A run is started on the server at Begin (`startRun()`, once per run and per replay); its seed
      deals the run and its token is what the Post form posts with. With no answer the game deals
      from `crypto.getRandomValues` and the reveal says posting is unavailable; a late run says it
      is not posted. Screens, on the existing components and styles: landing (00, one Lime, a
      dashed token-only slot labelled as awaiting the client's background image), how-to (00, the
      content's steps, shown once a visit, its button is the skip), offer (02, portrait-less for
      all seven: greeting, promise, Open the card, Take / Leave, Walk on), card (03, the dealt
      variant's two take lines and the leave line), arrive (04, the content's ending lines with
      Grandma's or the wolf's portrait), reveal (05: one row per offer in walking order with Safe /
      Unsafe by glyph and word, what the player did, the promise, the reveal line, the giveaway for
      a bad card, the realWorld term and note; then the score out of 100, the ending, the question
      band and the one Lime, the post form, the board, Walk it again). Words come from
      `content/game.v2.json` (`ui`, `endings`, the cast); the chrome copy v2 did not change (pad,
      music, problem screens, post form, board) is read from `content/game.v2.json` `ui.chrome`
      through `ui/copy.ts` (moved there in Phase F; `game.json` is gone), and the dozen new labels with no content key yet are in
      `ui/copy.ts PENDING` for the content owner. v1 screens removed: Notice, Trifecta, the v1
      Dialogue / SkillCard / Results / Cottage bodies, the errand HUD, `world/v2-wiring.tsx`.
      e2e: `play.spec.ts` (careful 100 and the post body, every reveal row, greedy wolf, late under
      the test clock, no board, replay, keyboard only, 375 / 768 / 1280) and a v2 `a11y.spec.ts`;
      fifteen v1-only specs deleted, the world and title specs moved to v2.
      `e2e/leaderboard.spec.ts` was ported to v2 in Phase F (the start route answers a seed and a
      token; the post body carries the token).
- [x] **E. Leaderboard** (M) — done 2026-10-22: `/api/start` deals the seed in a signed token, `/api/score` replays v2 against it, and `/api/top` reads only rows from `BOARD_SINCE` (2026-10-22T09:25:00Z, which replaced the v2-launch cut `V2_LAUNCH` when speed started to count) and above 0; `supabase/migrations/0006_clear_v1_rows.sql` deletes the v1 rows and is the human's to run. — **including a server-issued start token**, because v2's run-log
      times are client-reported: a log forged with every event at 0ms replays as legal today.
      The API must record when a run began and bound elapsed time on submit. Otherwise — `apps/api` recomputes with the new core in the same change. The table
      is empty today, so no posted score becomes incomparable.
      _Fix round 2026-10-22 (scripted 100s):_ a careful log for the token's seed, claiming 15 ms,
      replayed as legal and scored 100 -- and ties rank earliest first, so a bot's 100s would
      outrank every later honest one for good. Three answers, and what was done with each:
      **(a) done, then replaced** -- `MIN_RUN_MS` (10 s, `apps/api/src/handlers.ts`) floored both the claimed run
      time and the server-observed time since the token, and `8c4dc49` replaced it with `v2.walkFloor` (core `floor.ts`: every meeting and the arrival stamped no sooner than the straight-line walk the log describes, perks included). The rest of this item describes the 10 s floor as it was; `apps/api/test/floor.test.ts` derives it
      from the shipped map (straight line spawn to door, less a tile each end, at `WALK_SPEED`,
      11.2 s) and fails if it drifts above that or more than 2 s under it. It is one floor for every
      score; a per-score floor (a 100 must also meet the three holding good skills) needs the map's distances on
      the server and is **not done**. **(b) out of scope by design** -- GAME_DESIGN_V2 says
      "reading is optional", so requiring an `inspected` per take would refuse the honest lucky
      guess. **(c) the gate:**
  - [ ] **Vercel firewall rate limit on `/api/*`, on and proved on a preview, before the board is
        exposed to the public.** The only cross-instance bound on forged rows. Not on as of 2026-10-22.
- [x] **F. Readiness** (M) — done 2026-10-22: the cleanup and the test hook below, and the full review of `6e1192f` (security, brand, play and accessibility, content and education, docs truth) with its fix round. **What it does not cover:** the perks, minimap, door check, work email and the later screens landed after that review with their own tests and per-round checks, not a second whole-game sweep, and Phase 6's box "run `security-reviewer`" is still unticked. — a test-mode timer override (dot access on `import.meta.env`, and the
      symbol added to `csp.test.ts`'s bundle grep so it cannot ship like the debug handle did); then
      a full functional, security and accessibility sweep of v2.
      _Progress record, 2026-10-22:_ v1 is removed from the repository.
      Gone: `packages/core`'s v1 rules and tests (`content`, `state`, `reducer`, `runlog`,
      `scoring`, `outcomes`; core keeps `camera`, `leaderboard` and the `v2` namespace),
      `content/game.json` and `game.seed.json`, v1's `createLeaderboardClient`, and the v1
      strategies in `tools/sim`, which now runs v2 (`pnpm sim`). The chrome copy moved into
      `ui.chrome` in `content/game.v2.json`. `docs/GAME_DESIGN.md` is marked superseded, not
      deleted. The timer override and the bundle-grep item are done (`testClock`); the sweep
      itself is the review of `6e1192f`, above.

## Phase 10: The Gatekeeper and the river (v2.1)

The client's design of 2026-10-25, approved to build the same day ("let's get this baby going"). The
contract is docs/GATEKEEPER.md. Three builders in parallel worktrees, then the merge, the browser
specs and Paul's review.

- [x] T talks, not E (the key, the round button's letter, the hint)
- [x] Rules and content: the deal constraints, rules 3, Gatekeeper and Bridge Key, Wing Ride over the river, Way Teller retired
- [x] Map and art: Gatekeeper sprite, bridge gate tiles, dead-end sign, Magpie's path south and the landing, the Owl moved east
- [x] Game: the shut gate and its notice, the gate opening on Bridge Key, the flight re-aimed, fork signs removed
- [x] The drawbridge (the client's late change): raised over the whole span, lowered by Bridge Key in a brief fall, walkable once down, instant under reduced motion
- [x] Merge, browser specs, sim and par (2026-10-25: tour 91 tiles, 9.9 s to spare with no perk, derived par 103.4 s against 107 s; e2e 432 passed, 6 skipped)
- [x] Paul's review (2026-10-26: ship with fixes), pushed to main
- [x] Paul's review fixes (2026-10-26): drawbridge and lent-key copy; `gateLockedLeft` and `noWayOver`; the raised east end's bank and rest sill; the leaf sweeps across as it falls; the Gatekeeper one tile west at (22,19); COPY_REVIEW 0c; `prop-forksign` removed (e2e 431 passed, 6 skipped)
- [ ] The Magpie's exact spot from the client's picture
- [x] Leaderboard reset for rules 3 (the client's call, 2026-10-26): `BOARD_SINCE` is 2026-10-25T22:50:00Z, a few minutes after the push that shipped rules 3. Older rows are hidden, not deleted; `supabase/migrations/0008_clear_pre_rules3_rows.sql` deletes them (keeping any with a work email)
- [ ] **Human:** run `0008` in the Supabase SQL editor
- [x] Clearer safe and unsafe card lines on all seven skills (the client, 2026-10-26; `docs/COPY_REVIEW.md` 0d, content `3.0.0-draft.4`). Second pass the same day: Wood Map and Bridge Key say "you only"; Night Light's lesson is now who the light is for (Anyone-with-the-link sharing); Wing Ride's lesson is now Prompt injection (was Supply-chain risk)
- [ ] **Human:** approve 0d's lines; research sign-off on the three real-world changes (Slow Post, Night Light, Wing Ride)
- [x] The phone's landing loses its card as the computer's did (2026-10-26): the picture on top, Purple centred, the words under it on the sky's top colour
- [x] The how-to-play is one of the wood's timber signboards (2026-10-26): the world art's wood ramps, a lit frame, pegs, planks, two stakes on a computer; the words in Offwhite, measured pixel by pixel in heading-contrast
- [x] The phone's minimap keeps Purple in scale (2026-10-26): her diamond is capped at 6px on the one-pixel map, still the biggest mark, no longer a third of its height
- [x] The Cat moved up into the wood (2026-10-26): her own lane north off the road at column 39 and a clearing round her at (38,11), cut late in the generator so nothing else on the map moved; the verge bound 27 -> 33 for the lane's six sides
- [x] The door panel's advance arrow sits in the middle of the panel on a phone (2026-10-26)
- [ ] Research sign-off on the Bridge Key note
- [x] A greeting before every card (the client, 2026-10-26): ONE line in the character's voice saying what they have and how it helps you, then Purple's "Tell me more" opens the card and "No thanks" walks on (a first build had a second line and "Show me"; the client asked for one interaction). Content `3.0.0-draft.7` (seven new `greet` lines, `ui.offer` ask/noThanks; COPY_REVIEW 0e). The clock runs through it, so the walk is **3:30** and par **2:02** (measured: a careful reader arrives at 3:06.6, late at 3:00, 23.4 s to spare at 3:30); the board was reset at launch (`BOARD_SINCE` 2026-10-26T13:10:00Z; older rows are hidden, not deleted)
- [ ] **Human:** approve COPY_REVIEW 0e: the seven opening lines are approved (the client, 2026-10-26); Purple's two replies are not yet
- [x] The card does not say the greeting again (the client, 2026-10-26): it opens on the skill itself, the greeting said once before it
- [x] A finger's tap on the joystick is a one-tile nudge (the client, 2026-10-26: Purple "starts walking without stopping"): `TAP_PX`, one tile, for a touch tap; a mouse click and the walk buttons keep the four-tile step, a hold still walks until let go (`e2e/touch-pad.spec.ts`)
- [x] A shared link previews as the landing (the client, 2026-10-26: LinkedIn): Open Graph and `twitter:card` tags in `index.html`, `public/og-landing.png` the real landing in its wide layout, scaled to 1200x627 (a new picture takes a new name; LinkedIn keeps images by URL), guarded in `test/public-page.test.ts`. The host is the Vercel address until the research-page URL arrives; a page that embeds the game needs its own `og:image`
- [x] The how-to signboard, the client's pass (2026-10-26): its title, way in and controls line centred, the steps' numbers kept down the left; the controls line says "T or Space to talk" (Space always worked); the river's Cyera board carries its logo behind the how-to too, not only during the walk (`e2e/forest-signs.spec.ts`, at the client's 1716x940, since at 1280 the board is out of frame); the landing's shore line at 2.1% of the canvas so the longer line clears the pale cloud

## Readiness findings (sweep of 2026-10-21)

Measured on production and the working tree by four review lenses plus a completeness critic.
Several overlap Phase 7 and are listed once here. Fix before launch; most also apply to v2.
**Re-read 2026-10-22:** this list was written against v1. Two majors expired with it and are
ticked below with the reason; the rest are not re-triaged against v2 and stay as they were.

**Blockers**

- [x] On a phone at 200% zoom, Allow / Restrict / Reject sat 283–435px below the fold and no gesture
      reached them. The panel is its own scrollport now (`51574fc`). **Proven** by real wheel and touch
      gestures on macOS (Chromium 1228 and 1243), and on CI's Linux runner -- whose headless browser
      turns synthetic touch into no scrolling at all, measured with an injected control box -- by
      the computed conditions a finger needs: a scroll container with room, and no blocking
      `touch-action` (`ac1f450`'s diagnostics, then the calibrated test).
- [x] The e2e test for that defect passes because it calls `scrollIntoViewIfNeeded()` itself.
- [x] A failed asset load is silent — a healthy-looking HUD over an empty world. It needs a retry
      screen, and `window.onerror` a friendly message.

**Majors**

- [x] The call to action, "Read the Research", pointed at a 404 (`/off-the-path`). Since 2026-10-23
      it defaults to `https://www.cyera.com/research`, the client's interim choice.
- [x] The privacy line says "no cookies" while `localStorage['otp:music']` persists. Widen the
      sentence or drop the persistence, then guard by enumerating storage after a full run.
- [x] The question buttons eat the first press while a line types, up to nine presses a run — the
      interaction the game is named for. The fix pattern is already in `Dialogue.tsx`.
- [x] Grandma's door note says the words "stayed on the post" — on a door — beneath "anything you
      read now, the wolf reads too". **Expired with v1:** neither sentence is in `content/game.v2.json`
      or `apps/game/src` (grepped 2026-10-22).
- [ ] The title card clipped its thesis sentence at the client's own 1673×449. Probably fixed by the
      fit ladder; re-measure there.
- [ ] Pressing Post is announced to nobody, because the status region mounts with its text already
      in it.
- [ ] A screen-reader player is never told where anyone is.
- [x] Heading structure is incoherent: three of seven screens have no heading. **Expired with v1:**
      in v2 the landing, how-to, every panel, the problem screen and Results each set an `h1`, and the
      forest has a visually hidden one (`App.tsx`, `Title.tsx`, `components.tsx`, `ProblemScreen.tsx`,
      `Results.tsx`; read from source 2026-10-22, not with a screen reader).
- [ ] The question list tells a screen reader the first question is already selected.
- [ ] At 375, 390 and 768 every panel covers the goals and the basket under `aria-modal`.
- [ ] The embed has no host side, and `frame-ancestors` means the first real iframe test is launch day.
- [ ] M4 names an accessibility tool that is not installed anywhere.
- [ ] The 3-second time-to-interactive budget is not measured, and only one of three byte budgets is
      enforced in CI.
- [ ] ARCHITECTURE section 9 and this file describe a replaced embed-origin mechanism. README.md is stale about `apps/api` and the leaderboard client.

**New, from the fixes themselves**

- [ ] An asset request that HANGS (rather than 404ing) still leaves the title up with Begin
      enabled. Only failures are handled; loads need a timeout.
- [ ] Six new player-facing strings (the load and crash screens) have not had the human read
      PAUL_BRIEF requires. They are not leaderboard or privacy strings, so Legal is not needed.

**Minors and nits**: Post's "No reply came back" when a reply did; "Try another name" changes
silently; `#game`'s label reaches nothing; closing a panel drops focus to `body`; text clipped at 200%
on a phone; stale test counts in four documents; the one error screen is unstyled; the placeholder
lint checks one word of five; research sign-off covers about a quarter of the strings; the privacy
copy has no link; Phaser announces its version in the console; five stale build directories in the
checkout; "CAUGHT IT" wraps at 390px; a tile boundary where a direction key does nothing.

**Fixed since the sweep**: the coverage gate measuring a copy of the routes that never shipped (one
copy now, `8656fcb`); PAUL_BRIEF's claim that the dark band was still open; the docs saying
`vercel.json` declares services.

## Risks and mitigations

| Risk                                                                           | Impact           | Mitigation                                                                                                                                                                                 |
| ------------------------------------------------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Production pixel art arrives late or off-style                                 | Schedule         | Graybox with identical names; D2 resolved in Phase 0; art swap checklist.                                                                                                                  |
| Fine print is too easy or impossible to miss                                   | The lesson fails | M2 playtest on the slice; copy only edits; keep the safe skill so inspection is rewarded.                                                                                                  |
| Leaderboard abuse (cheating, offensive handles)                                | Brand risk       | Server recompute, blocklist, rate limits, delete endpoint, optional kill switch to hide the board.                                                                                         |
| Privacy or legal concern about a public leaderboard from a data-security brand | Brand risk       | Handle + score only, no cookies/IP storage, Legal review (D10), board can be disabled without a redeploy.                                                                                  |
| Bundle too heavy on mobile                                                     | Drop-off         | Phase 0 spike; budget checks in CI (the gzip step in `.github/workflows/ci.yml`, added 2026-10-20). NOT lazy loading: there is no dynamic import in the app and the build emits one chunk. |
| Fonts missing at launch                                                        | Off-brand        | Fallbacks look clean; D6 requested in Phase 0.                                                                                                                                             |
| Content drift between research and game                                        | Credibility      | Research sign-off on every string; data-only content; content version in every run.                                                                                                        |
