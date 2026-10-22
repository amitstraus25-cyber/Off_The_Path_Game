# Copy review: part of what a player reads

Research must sign off on every line here before launch (PLAN Phase 5, risk "Content drift between research and game").
Product marketing reviews tone; Legal reviews the leaderboard and privacy lines.

> ## This document does not cover the copy yet, and sign-off on it is the launch gate
>
> It was titled "every string a player reads". **Measured 2026-10-20: it names 29 of the 86 keys in
> `content/game.json`'s `strings` object.** The 57 it does not name include every bystander line, the
> notices, the errand goals, the take-it-on-trust copy, the trifecta chip, the touch controls, the
> music control, the arrival beats per ending, and the three-way boundary result — which is to say,
> most of what was added after this file was written, and all of the copy that carries the lesson the
> asset exists to teach.
>
> It also predates five commits against `game.json`, so some lines quoted below have since changed in
> the shipped file. **Where this document and `content/game.json` disagree, the file is right.**
>
> The fix is mechanical and is not done: regenerate the tables from the shipped file so coverage
> cannot drift again, rather than adding rows by hand. `apps/game/test/strings.test.ts` already scans
> both directions between the file and the UI and would be the place to hang a coverage check.
> `docs/UX_REVIEW.md` finding 13 is the long version of this.

## 0. The v2 skills, as shipped in `content/game.v2.json` (draft 8, 2026-10-22)

**This section is current; sections 1 to 4 below describe v1's `game.json`, which is gone.** The
client approved the seven skills in chat on 2026-10-22: for each, the name, the promise, the
giveaway line, the bad reveal, the lesson (`realWorld.term`) and the perk are theirs, word for word,
and are **APPROVED (client)** -- not to be reworded here. Wood Map's and Long Evening's whole cards
were given too. Everything else on the cards and reveals was written by engineering to fit the
approved lines and is **DRAFT**: the good card's other line, the leave lines, the good reveals, the
real-world notes, and the Rabbit's, Toadstool's and Magpie's greetings (changed to fit the new
skills). The full text is in `docs/GAME_DESIGN_V2.md` section 10; the file is the source of truth.

| Skill        | Approved (client)                                                                    | Draft (engineering), for the human read                                                    |
| ------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Wood Map     | promise; both cards; bad reveal "Your map went to the wolf. He knew where you'd be." | leave "You walk without a map."; good reveal; note; greet "Hello! I drew this map myself." |
| Way Teller   | promise; giveaway "Obeys any note pinned to a tree."; bad reveal                     | "Shows who lives down each path." / "Trusts only its own signposts."; good reveal; greet   |
| Word Weaver  | promise; giveaway "Pins a copy up at every crossing."; bad reveal                    | "Sends word ahead to Grandma." / "Folds it shut, for her eyes only."; good reveal; note    |
| Wing Ride    | promise; giveaway "Takes tonight's route from a stranger's map."; bad reveal         | "Plans tonight's route from its own map." / "Flies you to your next friend."; greet; note  |
| Slow Post    | promise; giveaway "Lets a friend peek inside on the way."; bad reveal                | "Carries your parcel, so you walk faster."; good reveal "You walked faster. …"             |
| Night Light  | promise; giveaway "Goes wherever the signs say, without asking you."; bad reveal     | "Waits for you to choose the way." / "Lights your way after dark."; good reveal; note      |
| Long Evening | promise; both cards; bad reveal "You had more time. The wolf had her key."           | leave "The sun sets on time."; good reveal; note "A skill is an identity too, …"           |

One question for the read, not settled here: Long Evening's note says "a non-human identity"
outright, which is the client's framing and research's to confirm. (The other, "person" or
"human" in Night Light's note, was settled by the content review below: "human".)

### 0a. Changed by the content review (2026-10-22, late)

Six strings in `content/game.v2.json`, all **DRAFT** until the human read. The content version
was **not** bumped (`2.0.0-draft.8`): it is load-bearing, since a run log played under one version
is refused by a server on another (`runlog.ts`, `content-mismatch`), and no rule changed.

| Path                                 | Was                                                                                                                 | Now                                                                                                                                  | Why                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| `ui.chrome.doorWelcome`              | Grandma is at the door already.                                                                                     | No need to knock. Word went ahead of you.                                                                                            | Blocking. Said when either copy of Word Weaver was taken, so it must not claim a safe arrival.                                       |
| `skills[word-weaver].good.reveal`    | Sent word ahead. She was at the door.                                                                               | Sent word ahead. She was expecting you.                                                                                              | Blocking. Pairs with the bad reveal "She expected you. So did the wolf."                                                             |
| `ui.chrome.landingPremise`           | Three good skills, four malicious ones. Take only the good three and race to Grandma.                               | Little Purple is your AI agent. Three skills on the path are good, four are malicious. Take only the good three and race to Grandma. | Names what the game stands for. Must fit the title card at 568x320, 667x375 and 844x390 (`e2e/title-steps.spec.ts`, `play.spec.ts`). |
| `skills[night-light].realWorld.note` | A helper that acts on every sign without asking skips your say on the steps that matter. Keep a person in the loop. | A helper that acts on every sign without asking leaves you out. Keep a human in the loop for steps that matter.                      | Plainer; "human in the loop" is the term of art. 22 words in 2 sentences (the lint allows 25 in 2).                                  |
| `ui.chrome.perkMinimap`              | The map is yours.                                                                                                   | A map of the wood.                                                                                                                   | A perk toast is shown for the bad copy too. "Yours" vouched for a map the bad copy sends to a stranger.                              |
| `ui.chrome.perkWingRide`             | Hold tight. Off to your next friend!                                                                                | A ride to your next friend.                                                                                                          | Same rule: the game's own neutral voice, saying what the skill does, not cheering a ride the bad copy routes by the wolf's map.      |

The other perk toasts were read against the same rule and left alone, because each says only what
the skill does in either copy: `perkForkSigns`, `perkEarlyWelcome`, `perkWingRideNobody`,
`perkWalkFaster`, `perkLantern`, `perkRewind`. `docs/GAME_DESIGN_V2.md` section 10 now quotes the
new Word Weaver reveal and Night Light note too (Paul's round, 2026-10-22); the file is still the
source of truth.

### 0b. Paul's design round (2026-10-22, night)

Every string the round added or changed, all **DRAFT** until the human read. PAUL_BRIEF section 7
is why this table exists: no test can confirm what a sentence means, and these are sentences. The
content version was **not** bumped, for the reason in 0a; no rule changed.

| Path                        | Was                                                                  | Now                                                                                                  | For the read                                                                                                                                                           |
| --------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ui.reveal.caught`          | You spotted {caught} of {bad} bad skills.                            | You kept {caught} of {bad} bad skills out of your basket.                                            | **Blocking.** Reverses the afternoon round's "spotted". Now counts the basket, read or not (a run that walked past all four to a 100 read "0"); shown on every ending. |
| `ui.chrome.landingAgent`    | (new: the first sentence of `landingPremise`)                        | Little Purple is your AI agent.                                                                      | Its own line so the fit ladder can never hide it on a landscape phone.                                                                                                 |
| `ui.chrome.landingPremise`  | Little Purple is your AI agent. Three skills on the path are good, … | Three skills on the path are good, four are malicious. Take only the good three and race to Grandma. | The rest of the premise; still yields on a short card.                                                                                                                 |
| `endings.late.lines[0]`     | You found the door long after dark.                                  | The light went before you found the door.                                                            | The late ending never reached a door; the old line said it did.                                                                                                        |
| `ui.chrome.arriveAskLate`   | (new; late runs read "Step inside")                                  | See what happened                                                                                    | The late ending's way on to the reveal.                                                                                                                                |
| `ui.chrome.arriveChipLabel` | (new)                                                                | At Grandma's door (U+2019)                                                                           | The Arrive header's chip, beside the "N of 7 met" count. Late runs show `worldGoal` ("Find Grandma") instead.                                                          |
| `ui.chrome.arriveSpeaker`   | (new)                                                                | Purple                                                                                               | The speaker eyebrow over the Arrive lines (UI_FOUNDATIONS section 8, 04), replaced by the ending's title on the last beat.                                             |
| `ui.chrome.landingChip`     | (new)                                                                | Cyera research                                                                                       | The header chip on Title, How to play and Results. Brand to confirm the wording.                                                                                       |
| `ui.chrome.howToGoing`      | (new)                                                                | Starting…                                                                                            | The start button while the server is asked for the run.                                                                                                                |
| `ui.reveal.unanswered`      | You walked past                                                      | Passed by                                                                                            | The tile's line for a card never answered; one line at every width now.                                                                                                |
| `ui.chrome.revealTilesHint` | Tap a card to flip it and see why.                                   | Tap or click a card to flip it and see why.                                                          | Says the desktop's gesture too.                                                                                                                                        |
| `ui.chrome.controlsHint`    | Arrows or WASD to walk, Space to talk, Esc to go back.               | Arrows or WASD to walk, E to talk, Esc to go back.                                                   | E is the key UI_FOUNDATIONS section 8 names; Space and Enter still work. Also the title's hint.                                                                        |
| `endings.wolf.title`        | That's not Grandma                                                   | That's not Grandma (U+2019)                                                                          | Typographic apostrophe only.                                                                                                                                           |
| `ui.landing.subtitle`       | That's not my grandma                                                | That's not my grandma (U+2019)                                                                       | Typographic apostrophe only.                                                                                                                                           |

Two smaller things for the same read. The reveal tiles' accessible names are now "Wood Map, Caught
it, Safe, You took, See why" -- the face's own words, punctuated -- which a screen-reader user hears
and nobody sees. And the late ending's portrait is Purple's, not Grandma's, so its first beat's
label "Little Purple on the doorstep" (in `Cottage.tsx`, not content) is still a claim about a
doorstep the late run never reached: it wants a content key and a line of its own.

**All of these live in `content/game.json` and are changed there only.** Copy that lives in `.tsx`
instead is a bug, and `docs/UX_REVIEW.md` finding 13 records roughly 35 of them.
After any change run `pnpm test` (the content lint and the two-way string scan run with it) and `pnpm e2e`.

Status key: **PLACEHOLDER** written by engineering and not yet reviewed; **DRAFT** written against the
concept board and not yet reviewed; **APPROVED** signed off by research.

## 1. The fine print (the whole lesson)

These are the lines the game is about. They are written the way real permission prompts read.
Each must map to a real class of behaviour in the research: credential access beyond purpose, data
exfiltration, instruction hijacking.

| Path in `game.json`                       | String                                                                                                                                                                                                                                                                                     | Status                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `skills[cottage-finder].promise.title`    | Finds the route                                                                                                                                                                                                                                                                            | DRAFT (from the board)                                   |
| `skills[cottage-finder].promise.detail`   | Shows a path to Grandma's cottage on your map.                                                                                                                                                                                                                                             | DRAFT (from the board)                                   |
| `skills[cottage-finder].finePrint.title`  | Also copies your cottage key                                                                                                                                                                                                                                                               | DRAFT (from the board)                                   |
| `skills[cottage-finder].finePrint.detail` | Requests access to your key so it can keep a backup.                                                                                                                                                                                                                                       | DRAFT (from the board)                                   |
| `skills[word-weaver].promise.*`           | Translates the forest / Understands what the creatures say.                                                                                                                                                                                                                                | **PLACEHOLDER**                                          |
| `skills[word-weaver].finePrint.*`         | Also forwards everything you say / Sends what Little Purple says to a helper address so it can improve.                                                                                                                                                                                    | **PLACEHOLDER**                                          |
| `skills[night-light].promise.*`           | Lights the path / Shines a lantern through the dark pines.                                                                                                                                                                                                                                 | **PLACEHOLDER**                                          |
| `skills[night-light]` has no `finePrint`  | Honest on inspection — nothing is hidden. **Not "the genuinely safe skill"**: D1 was amended 2026-10-16, its stated purpose _is_ the risk, and its best verdict is Restrict. `docs/RESEARCH_ALIGNMENT.md` open question 4 asks research to confirm this direction and is still unanswered. | **PLACEHOLDER**, and the direction itself is unconfirmed |

**Question for research:** is the Cottage Finder fine print too easy to spot, or about right? The M2
playtest should watch whether a first-time player finds it at all.

## 2. Recap lines (shown on Results, one per skill per verdict)

Nine lines at `skills[*].outcomes.{allow,restrict,reject}.recap`. They explain; they never scold.

| Skill          | Verdict  | Line                                                                                                                    | Status          |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| Cottage Finder | allow    | It also copied your cottage key, and the wolf now has it.                                                               | DRAFT           |
| Cottage Finder | restrict | You took the route and refused the key. The key stayed in your basket.                                                  | DRAFT           |
| Cottage Finder | reject   | Safe, but you walked without a map and lost time.                                                                       | DRAFT           |
| Word Weaver    | allow    | It forwarded everything Little Purple said to the wolf.                                                                 | **PLACEHOLDER** |
| Word Weaver    | restrict | Stripping the forwarding left a translator that barely works.                                                           | **PLACEHOLDER** |
| Word Weaver    | reject   | Nothing useful was left once the hidden part was removed, so rejecting it was right.                                    | **PLACEHOLDER** |
| Night Light    | allow    | Nothing was hidden in it. You let it read whatever it was held to, and that was the trouble.                            | **PLACEHOLDER** |
| Night Light    | restrict | You kept the lantern and chose what to hold it to. It lit what you pointed at, and nothing else read to you on the way. | **PLACEHOLDER** |
| Night Light    | reject   | Safe, but the pines were dark and slow going.                                                                           | **PLACEHOLDER** |

## 3. Character dialogue

`characters[*].greet` and the three `asks[*].reply` lines, twelve in total. The Owl's lines carry the
supply-chain beat ("A traveler left this with me"); the Rabbit is honest and cheerful; the Lantern
Keeper made the thing themself, which is why it is safe.
Rabbit: DRAFT (from the board). Owl and Lantern Keeper: **PLACEHOLDER**.

The three question labels are fixed across every character: "What does it need?", "Who made it?",
"Show me." Only the first two earn the question bonus.

## 4. Endings

| Ending      | Lines                                                                                             | Status                                 |
| ----------- | ------------------------------------------------------------------------------------------------- | -------------------------------------- |
| `clean`     | The door opens. Grandma waves from her chair. Somewhere behind the trees, the wolf sighs.         | DRAFT                                  |
| `close`     | Grandma, why do you need my key? / The wolf is at the door, holding something it should not have. | DRAFT (first line from the board)      |
| `wolfhouse` | Someone wrote those instructions. It wasn't you.                                                  | DRAFT (the line the whole game is for) |

## 5. Screen copy (`strings`)

Title and intro: `title`, `titleHighlight`, `subtitle`, `introNote`, `introBody`, `play`, `controlsHint`.
Arrival: `arriveTitle`, `arriveLines` (pipe-separated beats), `arriveAsk`.
Results: `resultsTitle`, `scoreLabel`, `scoreOutOf`, `recapHeading`, `postHeading`, `handleLabel`,
`handlePlaceholder`, `handleHint`, `privacyLine`, `post`, `replay`, `verdictAllowed`,
`verdictRestricted`, `verdictRejected`.
World: `quest`, `cottageHint`.
Call to action: `cta`, `ctaPrompt`.
Leaderboard: `leaderboardTitle`, `leaderboardDown`.

All **PLACEHOLDER** except `cta`, `ctaPrompt`, `quest` and `leaderboardTitle`, which come from the mocks.

**Legal must ALSO review the work-email copy (the client's decision, 2026-10-22)**, which is shown
only once `OTP_WORK_EMAIL=required` is set and is in `content/game.v2.json` under `ui.contact`:
`emailLabel` ("Work email"), `emailHint` ("Never shown on the board."), the consent line `consent`
("Cyera may contact me about this research.", recorded as consent version `research-contact-v1`),
the four refusal sentences, and `privacy`, which REPLACES `privacyLine` while the address is asked
for: "Your name and score go on the public board. Your work email is kept privately, only so Cyera
can contact you about this research, and is never shown. No account, no cookies." The consent line
is versioned: if Legal changes a word of it, the version changes too (`consentVersion`), and core's
`test/v2/contact.test.ts` fails until both are updated, because every stored address records the
version it was given under. `privacyLine` itself is unchanged and is still the line shown with the
flag off, where it is still true.

**Legal must review** `privacyLine` ("We store your handle and score only. No account, no email, no
cookies.") and `handleHint` against decision D10 before launch. **That review has not happened**, and
two things should go into it rather than being settled here:

- ~~The sentence describes an API that does not exist yet.~~ **Resolved 2026-10-21:** the leaderboard
  API is live and reads the database, and it stores a handle and a score only, as the sentence says.
- ~~The game does write one `localStorage` boolean, for the music preference.~~ **Resolved
  2026-10-21, by changing the code rather than this sentence:** the music preference now lives in
  memory for the page and is never persisted, so a reload starts silent. Nothing is written to
  `localStorage`, `sessionStorage`, cookies or IndexedDB during a full run, and
  `e2e/storage-empty.spec.ts` enumerates all four to keep it that way. The flag below stands as the
  reason it had to be fixed: "no cookies" on a data security company's own research page is the one
  sentence an unfriendly reader will test, and the literal truth of it was not enough while the
  implicature was false. **For Legal:** the sentence itself is unchanged.

## 6. Things deliberately not said

- No vendor, product or person is ever named. The content lint fails the build on a list of vendor
  words, so this cannot drift in by accident.
- The recap never tells the player they were foolish. "Safe, but costly" is the strongest judgement.
- The wolf reveal has no gore and no jump scare: a slow fade and a held beat.
