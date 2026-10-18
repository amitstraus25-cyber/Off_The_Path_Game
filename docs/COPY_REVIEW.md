# Copy review: every string a player reads

Research must sign off on every line here before launch (PLAN Phase 5, risk "Content drift between research and game").
Product marketing reviews tone; Legal reviews the leaderboard and privacy lines.

**All of these live in `content/game.json` and are changed there only.** No copy lives in code.
After any change run `pnpm test` (the content lint runs with it) and `pnpm e2e`.

Status key: **PLACEHOLDER** written by engineering and not yet reviewed; **DRAFT** written against the
concept board and not yet reviewed; **APPROVED** signed off by research.

## 1. The fine print (the whole lesson)

These are the lines the game is about. They are written the way real permission prompts read.
Each must map to a real class of behaviour in the research: credential access beyond purpose, data
exfiltration, instruction hijacking.

| Path in `game.json`                       | String                                                                                        | Status                 |
| ----------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------- |
| `skills[cottage-finder].promise.title`    | Finds the route                                                                               | DRAFT (from the board) |
| `skills[cottage-finder].promise.detail`   | Shows a path to Grandma's cottage on your map.                                                | DRAFT (from the board) |
| `skills[cottage-finder].finePrint.title`  | Also copies your cottage key                                                                  | DRAFT (from the board) |
| `skills[cottage-finder].finePrint.detail` | Requests access to your key so it can keep a backup.                                          | DRAFT (from the board) |
| `skills[word-weaver].promise.*`           | Translates the forest / Understands what the creatures say.                                   | **PLACEHOLDER**        |
| `skills[word-weaver].finePrint.*`         | Also forwards everything you say / Sends what Red says to a helper address so it can improve. | **PLACEHOLDER**        |
| `skills[night-light].promise.*`           | Lights the path / Shines a lantern through the dark pines.                                    | **PLACEHOLDER**        |
| `skills[night-light]` has no `finePrint`  | (the genuinely safe skill, decision D1)                                                       | **PLACEHOLDER**        |

**Question for research:** is the Cottage Finder fine print too easy to spot, or about right? The M2
playtest should watch whether a first-time player finds it at all.

## 2. Recap lines (shown on Results, one per skill per verdict)

Nine lines at `skills[*].outcomes.{allow,restrict,reject}.recap`. They explain; they never scold.

| Skill          | Verdict  | Line                                                                                                                    | Status          |
| -------------- | -------- | ----------------------------------------------------------------------------------------------------------------------- | --------------- |
| Cottage Finder | allow    | It also copied your cottage key, and the wolf now has it.                                                               | DRAFT           |
| Cottage Finder | restrict | You took the route and refused the key. The key stayed in your basket.                                                  | DRAFT           |
| Cottage Finder | reject   | Safe, but you walked without a map and lost time.                                                                       | DRAFT           |
| Word Weaver    | allow    | It forwarded everything Red said to the wolf.                                                                           | **PLACEHOLDER** |
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

**Legal must review** `privacyLine` ("We store your handle and score only. No account, no email, no
cookies.") and `handleHint` against decision D10 before launch.

## 6. Things deliberately not said

- No vendor, product or person is ever named. The content lint fails the build on a list of vendor
  words, so this cannot drift in by accident.
- The recap never tells the player they were foolish. "Safe, but costly" is the strongest judgement.
- The wolf reveal has no gore and no jump scare: a slow fade and a held beat.
