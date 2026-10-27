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
real-world notes, and the Rabbit's, Gatekeeper's and Magpie's greetings (changed to fit the new
skills; the Gatekeeper replaced the Toadstool and the Way Teller in rules 3, see 0c). The full text is in `docs/GAME_DESIGN_V2.md` section 10; the file is the source of truth.

| Skill        | Approved (client)                                                                              | Draft (engineering), for the human read                                                    |
| ------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Wood Map     | promise; both cards; bad reveal "Your map went to the wolf. He knew where you'd be."           | leave "You walk without a map."; good reveal; note; greet "Hello! I drew this map myself." |
| Bridge Key   | name; icon; the idea: "hands the key back" / "saves a copy for next time" (docs/GATEKEEPER.md) | every line on the cards and reveals, the note and the Gatekeeper's greet: see 0c           |
| Word Weaver  | promise; giveaway "Pins a copy up at every crossing."; bad reveal                              | "Sends word ahead to Grandma." / "Folds it shut, for her eyes only."; good reveal; note    |
| Wing Ride    | promise; giveaway "Takes tonight's route from a stranger's map."; bad reveal                   | "Plans tonight's route from its own map." / "Flies you to your next friend."; greet; note  |
| Slow Post    | promise; giveaway "Lets a friend peek inside on the way."; bad reveal                          | "Carries your parcel, so you walk faster."; good reveal "You walked faster. …"             |
| Night Light  | promise; giveaway "Goes wherever the signs say, without asking you."; bad reveal               | "Waits for you to choose the way." / "Lights your way after dark."; good reveal; note      |
| Long Evening | promise; both cards; bad reveal "You had more time. The wolf had her key."                     | leave "The sun sets on time."; good reveal; note "A skill is an identity too, …"           |

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

### 0c. The Gatekeeper and the river (rules 3, 2026-10-25; Paul's review 2026-10-26)

The client's design (docs/GATEKEEPER.md): the Toadstool and the Way Teller are gone, the Gatekeeper
lends the Bridge Key that lowers a drawbridge, and the Magpie's Wing Ride flies over the river.
Every line below is **DRAFT** until the human read, and three need more than that: the Bridge Key's
real-world note, like every note, needs the research team's sign-off ("Leaked credentials" is
pending it too); and the Wing Ride's promise and giveaway were **APPROVED (client)** lines in rules 2
and were reworded for the river, so they need the client's approval again. The content version is
`3.0.0-draft.1`.

| Path                                   | Was (rules 2, or the first rules 3 draft)                                                             | Now                                                                                                      | For the read                                                                                                       |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `characters[gatekeeper].greet`         | Nobody crosses without my key. I keep this gate.                                                      | Nobody crosses without my key. I keep this bridge.                                                       | The gate became a drawbridge (the client, 2026-10-25).                                                             |
| `skills[bridge-key].promise`           | It opens the bridge gate, so you never have to ask.                                                   | It lowers the drawbridge, so you can cross the river.                                                    | Says what it does and why the player wants it.                                                                     |
| `skills[bridge-key].*.card.take[0]`    | Opens the bridge gate for you.                                                                        | Lowers the drawbridge for you.                                                                           | Same line on both cards.                                                                                           |
| `skills[bridge-key].good.card.take[1]` | Hands the key back once you're across.                                                                | Hands the key back once you're across.                                                                   | Unchanged. The key is the Gatekeeper's, lent.                                                                      |
| `skills[bridge-key].bad.card.take[1]`  | Saves your key for next time.                                                                         | Keeps a copy of the key for next time.                                                                   | **The giveaway**, still the one line the two cards differ on. "Your key" was wrong: the key is lent, not yours.    |
| `skills[bridge-key].*.card.leave`      | The gate stays shut. Find another way over.                                                           | The drawbridge stays up. Find another way over.                                                          | Points at the Wing Ride without naming it.                                                                         |
| `skills[bridge-key].good.reveal`       | Opened the gate and gave the key back.                                                                | Lowered the drawbridge and gave the key back.                                                            |                                                                                                                    |
| `skills[bridge-key].bad.reveal`        | It kept a copy of your key. The wolf found it.                                                        | It kept a copy of the key. The wolf found it.                                                            | Names the wolf, as every bad reveal must.                                                                          |
| `skills[bridge-key].realWorld.note`    | A skill that keeps a copy of a key it was only lent can hand it to anyone. That is how API keys leak. | A skill that saves a key it was only lent leaves it where others can find it. That is how API keys leak. | **Research sign-off.** Term "Leaked credentials", pending the same sign-off. Not yet security-read.                |
| `characters[magpie].greet`             | My cousin and I fly this wood every night. Hop on!                                                    | Can't swim? Hop on. Wings are quicker than bridges.                                                      | She stands on the west bank now, south of the bridge.                                                              |
| `skills[short-cut].promise`            | It flies you to your next friend on the path.                                                         | It flies you over the river to the far bank.                                                             | **Client re-approval** (was an approved line).                                                                     |
| `skills[short-cut].good.card.take[0]`  | Plans tonight's route from its own map.                                                               | Plans the flight from its own map.                                                                       |                                                                                                                    |
| `skills[short-cut].bad.card.take[0]`   | Takes tonight's route from a stranger's map.                                                          | Takes the flight plan from a stranger's map.                                                             | **The giveaway. Client re-approval** (was an approved line).                                                       |
| `skills[short-cut].*.card.take[1]`     | Flies you to your next friend.                                                                        | Flies you over the river.                                                                                | Same line on both cards.                                                                                           |
| `skills[short-cut].*.card.leave`       | You walk every step.                                                                                  | You stay on this side of the river.                                                                      |                                                                                                                    |
| `skills[short-cut].good.reveal`        | Flew you to your next friend.                                                                         | Flew you over the river.                                                                                 |                                                                                                                    |
| `skills[short-cut].bad.reveal`         | It flew you where the wolf's map said.                                                                | It flew you where the wolf's map said.                                                                   | Unchanged.                                                                                                         |
| `ui.chrome.perkWingRide`               | A ride to your next friend.                                                                           | A ride over the river.                                                                                   | Shown for the bad copy too, so it only says what the skill does.                                                   |
| `ui.chrome.perkBridgeGate`             | (new; the first draft said the gate swings open)                                                      | The drawbridge comes down.                                                                               | The toast as the key is taken. Shown for the bad copy too.                                                         |
| `ui.chrome.gateLocked`                 | The gate is locked. The Gatekeeper has the key.                                                       | The drawbridge is up. The Gatekeeper has the key.                                                        | Said when Purple bumps the raised drawbridge without the key.                                                      |
| `ui.chrome.gateLockedLeft`             | (new)                                                                                                 | The drawbridge stays up. Find another way over.                                                          | The same bump once the key was LEFT: the card's own leave line, not a Gatekeeper the player already said no to.    |
| `ui.chrome.noWayOver`                  | (new)                                                                                                 | No way over the river is left.                                                                           | Said once, when a run has left both the Bridge Key and the Wing Ride. No rule or score changes; the clock ends it. |
| `ui.world.signs[dead-end].caption`     | (new; the board stood hidden at the top right as `sign-speed`)                                        | Dead end                                                                                                 | The sign at the end of the north path, where the Owl stood before she crossed the river.                           |

### 0d. Clearer safe and unsafe lines (the client, 2026-10-26)

The client asked for every card to make it plainer what is safe and what is not. The rule for each
giveaway: the safe line names a protection (only, sealed, asks you first, nothing else), the unsafe
line names who gets what (a stranger, anyone, without asking, the door key). Wing Ride and Night
Light keep their giveaway on the first line, so the tell's place still varies between cards (the
test "the giveaway is not always on the same line"). Content version `3.0.0-draft.4` (the client's second pass the same day: Wood Map, Bridge Key, Night Light). All lines
**DRAFT** for the human read; the two real-world changes need the research team's sign-off.

| Path                                       | Was                                                                                                                                          | Now                                                                                                                                               | Why                                                                                                                                       |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `skills[cottage-finder].bad.card.take[1]`  | Sends your map to a stranger.                                                                                                                | Sends a copy of your map to a stranger.                                                                                                           | A copy: the skill still works, which is the point.                                                                                        |
| `skills[cottage-finder].bad.reveal`        | Your map went to the wolf. He knew where you'd be.                                                                                           | It sent your map to the wolf. He knew where you were.                                                                                             | The skill did it, not the map.                                                                                                            |
| `skills[bridge-key].bad.card.take[1]`      | Keeps a copy of the key for next time.                                                                                                       | Keeps a copy of the key for later.                                                                                                                | Shorter; "later" reads as kept, not returned.                                                                                             |
| `skills[short-cut].good.card.take[0]`      | Plans the flight from its own map.                                                                                                           | Plans the flight from its own map only.                                                                                                           | "Only" is the protection.                                                                                                                 |
| `skills[short-cut].bad.card.take[0]`       | Takes the flight plan from a stranger's map.                                                                                                 | Takes its flight plan from a stranger.                                                                                                            | **Client re-approval.** Who wrote the instructions, said plainly.                                                                         |
| `skills[short-cut].good.reveal`            | Flew you over the river.                                                                                                                     | Flew you over the river by its own map.                                                                                                           | Says why it was safe.                                                                                                                     |
| `skills[short-cut].bad.reveal`             | It flew you where the wolf's map said.                                                                                                       | It flew by the stranger's map. The wolf drew it.                                                                                                  | Ties the reveal to the card's stranger.                                                                                                   |
| `skills[word-weaver].bad.card.take[1]`     | Pins a copy up at every crossing.                                                                                                            | Pins a copy at every crossing for anyone.                                                                                                         | "For anyone" is the exposure.                                                                                                             |
| `skills[word-weaver].bad.reveal`           | She expected you. So did the wolf.                                                                                                           | She expected you. So did the wolf. He read it.                                                                                                    | Says how the wolf knew.                                                                                                                   |
| `skills[word-weaver].realWorld.term`       | Oversharing and public exposure                                                                                                              | Public exposure                                                                                                                                   | One name per lesson.                                                                                                                      |
| `skills[slow-post].bad.card.take[1]`       | Lets a friend peek inside on the way.                                                                                                        | Lets a stranger look inside on the way.                                                                                                           | "A friend" sounded harmless, which hid the risk.                                                                                          |
| `skills[slow-post].bad.reveal`             | It reached her. The peeking friend was the wolf.                                                                                             | It reached her. The stranger who looked was the wolf.                                                                                             | Follows the card.                                                                                                                         |
| `skills[slow-post].realWorld.note`         | A friend who peeks is a third party you never agreed to. A skill can deliver your data and share it along the way.                           | Anyone who looks inside on the way is a third party you never chose. A skill can deliver your data and share it too.                              | **Research sign-off.** Follows the card.                                                                                                  |
| `skills[cottage-finder].good.card.take[1]` | Keeps the map for you alone.                                                                                                                 | Keeps your map for you only.                                                                                                                      | The client's words, second pass.                                                                                                          |
| `skills[bridge-key].good.card.take[1]`     | Hands the key back once you're across.                                                                                                       | Hands the key back once you're across, to you only.                                                                                               | The client's words, second pass.                                                                                                          |
| `skills[night-light].promise`              | It lights your way when the sun goes down.                                                                                                   | It lights up the path when the sun goes down.                                                                                                     | **Client re-approval.** The client's second pass: the lesson is who the light is for.                                                     |
| `skills[night-light].*.card.take`          | Waits at every fork for you to choose. / Goes wherever the signs say, without asking you. + Lights your way after dark.                      | Lights up the path for you only. / Lights up the path for anyone to see. + Shines all the way to Grandma's.                                       | **The giveaway** stays on the first line, so its place still varies.                                                                      |
| `skills[night-light].*.reveal`             | Lit your way as dusk fell. / One sign was the wolf's. The light followed it.                                                                 | Lit up the path for you alone. / Anyone could see the light. The wolf followed it.                                                                |                                                                                                                                           |
| `skills[night-light].realWorld`            | Excessive agency: A helper that acts without asking can send, pay or delete before you notice. Keep a human approving the steps that matter. | Anyone-with-the-link sharing: A link anyone can open is open to attackers too. Share what a skill makes with the people who need it, nobody else. | **Research sign-off.** Prompt injection moved to the Wing Ride (below).                                                                   |
| `skills[short-cut].realWorld`              | Supply-chain risk: A skill that fetches its instructions from someone else can change after you said yes, like a map redrawn overnight.      | Prompt injection: A skill that follows instructions a stranger hid in what it reads can be steered by an attacker. Ask who wrote its plan.        | **Research sign-off.** The client, 2026-10-26: the research's own lesson is back, on the card whose giveaway is a stranger's flight plan. |

### 0e. The greeting before the card (the client, 2026-10-26)

Meeting someone opens ONE line in their voice, saying what they have and how it helps you (the
client: "I want it to be clear what each person has and how it can help you"), and Purple's two
replies: "Tell me more" opens the card, which is the more information, and "No thanks" walks on.
The line is on the character, so it is the same for the good and the bad deal and gives nothing
away. It is said once: the card does not repeat it (the client, 2026-10-26). The shape is "I have a [thing]. It helps you [benefit].", kept to about 15
words, because the clock charges the longest of them to every meeting. Each line keeps its
character's opener from before (Hello!, Hoo!, Evening!, Slow, but sure). The card's lines are
unchanged. Content version `3.0.0-draft.7`. The seven `greet` lines are **APPROVED (client)**: the
client approved them as they are in chat on 2026-10-26, so they are not to be reworded here. The
other rows stay **DRAFT** for the human read.

| Path                                      | Was                                                        | Now                                                                                                    |
| ----------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `characters[rabbit].greet`                | Hello! I drew this map myself. Never once lost.            | Hello! I have a map of the whole wood. It'll help you find your way.                                   |
| `characters[gatekeeper].greet`            | Nobody crosses without my key. I keep this bridge.         | I keep this bridge, and I have its key. It lets you cross the river.                                   |
| `characters[magpie].greet`                | Can't swim? Hop on. Wings are quicker than bridges.        | Can't swim? I have wings. I'll fly you over the river.                                                 |
| `characters[owl].greet`                   | Hoo! My sister wove these words. Finest hand in the wood.  | Hoo! I have my sister's woven words. They tell Grandma you're coming.                                  |
| `characters[snail].greet`                 | Slow, but sure. I'll carry your parcel.                    | Slow, but sure. I have a sealed bag. It carries your load, so you walk light.                          |
| `characters[lantern-keeper].greet`        | Evening! I made this lamp for the dark pines.              | Evening! I have a lamp for the dark pines. It lights your path at dusk.                                |
| `characters[cat].greet`                   | Grandma made this for you. The kettle's on.                | I have something Grandma made for you. It holds back the dark a little longer.                         |
| `ui.offer.ask`                            | (new)                                                      | Tell me more                                                                                           |
| `ui.offer.noThanks`                       | (new)                                                      | No thanks                                                                                              |
| `ui.howTo.steps[2]`                       | Reach Grandma in 3:00. Faster scores more.                 | Reach Grandma in 3:00. Faster scores more. (3:30 for one day; back to 3:00 2026-10-27)                 |
| `ui.chrome.startPar` (the one-screen A/B) | Beat par {par} for the speed bonus. The walk ends at 3:00. | Beat par {par} for the speed bonus. The walk ends at 3:00. (3:30 for one day; back to 3:00 2026-10-27) |

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
