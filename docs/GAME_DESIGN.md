# Game design: Off the Path, "That's Not My Grandma"

Source: `reference/Off_the_Path_-_Game_and_Campaign_Concept.pdf` (Amit Straus, Oct 14 2026).
Items marked **[PLACEHOLDER]** are drafts invented for this plan and must be confirmed by the
research / product marketing team before launch. Items marked **[DECISION]** appear in PLAN.md's decisions table.

## 1. Purpose and audience

- Make the research claim playable before the reader opens the research: **"Attackers Are Writing the Instructions Your AI Agents Follow."**
- Audience: security leaders and security practitioners. Many will play on a phone between meetings.
- Session length target: **4 to 6 minutes**. Replayable in under 4 once you know the trick.
- Tone: warm fairy tale with a note of quiet suspense. Never scary, never preachy, never blame the player.

## 2. The metaphor (keep this mapping intact)

| In the story                               | In the research                         | What it teaches                                                     |
| ------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------- |
| Red Riding Hood                            | The AI agent                            | The agent has a legitimate task and will use whatever it is handed. |
| Delivery to Grandma                        | The intended task                       | The goal stays the same while the route can be tampered with.       |
| Forest characters and their offers         | Third-party skills and capabilities     | Useful help arrives from sources the agent did not write.           |
| A friendly character passing a skill along | A compromised skill in the supply chain | The sender can be honest and the skill still malicious.             |
| The wolf                                   | The attacker                            | Hidden instructions sit behind a useful offer.                      |
| Allow / Restrict / Reject                  | Review of a skill before use            | The player decides what the agent is permitted to do.               |
| Grandma's cottage                          | The outcome                             | Each choice leads back to the instruction that caused it.           |

## 3. Core loop: four beats

1. **Explore.** Top-down forest. Walk with keyboard (arrows/WASD) or on-screen joystick. Quest marker "Find Grandma" is always visible. Characters stand near landmarks and offer a skill.
2. **Question.** Talk (A button / Space / Enter / tap) to a character. Dialogue offers three questions: **What does it need?**, **Who made it?**, **Show me.** The first two give flavor and clues; **Show me** opens the skill card. Asking is optional but rewarded.
3. **Inspect.** The skill card shows the **promise** (what it says it does) and, when present, the **fine print** (a hidden action that is visible on close reading). Player chooses **Allow**, **Restrict** or **Reject**. The basket at the bottom shows what Red is carrying.
4. **Arrive.** At the cottage, the wolf-as-Grandma encounter plays out according to the choices. A short recap ties each consequential choice to the hidden instruction behind it. Then results, leaderboard, and the call to action: **Read the Research**.

## 4. Verdict semantics (important to get right)

- **Allow**: Red gets the skill with every permission it asks for (including the hidden one).
- **Restrict**: Red gets the skill, scoped. The hidden action is stripped; and where a skill's _stated_ purpose is itself a capability, Restrict bounds whether that capability runs at all. On Night Light, whose purpose is to read what strangers wrote, Restrict grants nothing: the lantern lights only what Red holds it to. This is the "least privilege" move, and it is the one verdict that can express an architectural boundary rather than careful reading.
- **Reject**: Red does not take the skill. Safe, but the benefit is lost (no route on the map, etc.).
- Each skill defines which verdict is best. **A skill with no fine print must exist** so "reject everything" is not the winning strategy. [DECISION D1, amended 2026-10-16: Night Light is still honest on inspection — it has no fine print — but it is no longer safe by default. Its best verdict is Restrict; Allow leaves it reading what strangers wrote. `docs/RESEARCH_ALIGNMENT.md` open question 4 asks research to confirm this direction and **has not been answered**.]
- The skill card must make the right answer _discoverable_, not obvious: the fine print is real text on the card, in plain language, at the same size as the promise.

## 5. Characters (first version: four)

| Character                                            | Where                      | Offers                                               | Notes                                                                                                                                                                       |
| ---------------------------------------------------- | -------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rabbit                                               | Market stall by the bridge | **Compass: "Cottage Finder"** (in the concept board) | Honest, cheerful, passes it along directly.                                                                                                                                 |
| Owl                                                  | Tree near the signpost     | **Translator: "Word Weaver"** [PLACEHOLDER]          | Friendly and sincere but got it from a stranger. This is the _supply chain_ beat: "A traveler left it with me."                                                             |
| Lantern keeper [art TBD, suggest hedgehog or badger] | Lantern post at the bridge | **Lantern: "Night Light"** [PLACEHOLDER]             | Honest on inspection: nothing is hidden. Its stated purpose _is_ the risk, so trusting it wholesale is the mistake. Rewards the player who inspects and then **bounds** it. |
| Wolf, as "Grandma"                                   | The cottage                | Nothing; reveals outcomes                            | Appears only at the end: silhouette in the window, paw prints on the path (both in the board).                                                                              |

## 5a. Bystanders (added 2026-10-18)

Four people in the forest who are not characters. They offer nothing, grant nothing and are never
scored: no skill, no capability, no verdict, no log entry. Greeting one shows a named bubble for a
few seconds and the run is exactly where it was. They exist so the walk between decisions has
something in it, and so that "someone is talking to me" stops meaning "a decision is coming".

They live outside the rules on purpose. `packages/core` knows about them only through the content
schema and four lint rules, all of which exist to keep a bystander from being mistaken for one of
the three characters.

| Bystander | Where                            | The joke                                                                 | What it rhymes with                                              |
| --------- | -------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| Toadstool | Beside the signpost at the start | Gives directions with total authority, from a traveller, never checked   | Supply chain: he is passing on something he never looked at      |
| Magpie    | At the well, before the bridge   | Keeps a tally of how many have taken one, with no idea what it is        | Popularity as a trust signal; primes the Rabbit's "very popular" |
| Snail     | The gate approach                | A courier who does not open parcels and never checks whose name is on it | The honest intermediary, and the one who declined a faster way   |

Each also has a `whenExposed` line that replaces the others once all three capabilities are live.
These are dread rather than warning: in character, about the speaker's own cheerful fault, never
about the player's decision. They are the only places in the forest that remark on the trifecta at
all, and none of them knows what it is remarking on.

The Cat is the only one past the notice post, so every decision is already made before she speaks.
She is held to the same bar as the others and it is tightest on her, because she is closest to the
reveal: her exposed line reports a small grievance of her own, not a danger to Red. "Someone is in
her chair, and I do not know them" was cut for exactly that reason. A bystander who has perceived
the threat makes the other three read as negligent rather than funny, and turns the ending from a
surprise into a confirmation.

**Rules for anything added here.** A bystander must never name a skill, a verdict or a mistake,
must never point the player at a character, and must never give directions a player could act on
and get lost by. The nonsense has to be unfollowable, not plausibly wrong.

Because the forest now contains people who are not characters, `strings.cottageHint` says "I should
hear all three travellers first." rather than "talk to everyone": a player held at the door must
not go back looking for a decision that was never there.

## 5b. Where the walk ends (changed 2026-10-18)

`trigger-cottage` is the **doorstep**, not the garden gate.

It used to be the gate, which is the only gap in the fence, and that put the end of the run in
front of the note on Grandma's door. A player who did the natural thing, meet all three travellers
and then walk east, had the run taken off her at the gate and could never reach the note, so the
`sign` errand goal was advertised in the HUD on every run and could not be earned in that order.
It was reachable only by slipping through the gate with a verdict still outstanding, reading the
note and walking back, which nobody does.

Two rules now hold, and both are tested:

- **Nothing a goal needs sits behind the end of the walk.** The map test floods from the spawn
  with `trigger-cottage` treated as a wall. A plain collision flood fill cannot see this, because
  the trigger is a terminator rather than an obstacle and its tiles are deliberately walkable.
- **A notice, and the trigger that ends the walk, must lie on the line a due-east walker actually
  walks.** `overlaps` is a point test on Red's feet, and a player who only holds Right keeps her
  feet on row 21 for the whole map. A one-row rect is invisible to that player. The first attempt
  at this fix put the trigger on the doorstep row alone, which meant she walked past the door and
  out across the lawn and the run never ended, which is worse than the bug being fixed. The note
  and the trigger now both span rows 19 to 21, the note in the lane immediately west of the
  doorstep, so every approach from the garden crosses the note first and the trigger second
  whichever row she walks, and the two rects never share a tile.

The door note is reachable, not unavoidable: a player who leaves the lane and crosses the lawn
behind the cottage can still miss it. That is on purpose. The forest post must be unavoidable
because it carries the lesson; this one is a scored errand, and forcing the panel on every run,
including the restrict/reject/restrict line where `strangers` is never earned and the goal cannot
be met anyway, would buy nothing and cost a click.

There are two 1,000-point lines, not one, both with the two bonus questions asked:
restrict/reject/restrict keeps the lantern bounded and scores the ceiling with one errand goal from
anywhere on the map, and restrict/reject/allow trades the lantern's best verdict for the capability
that reads the door note and ties it with two — but only if she actually reads both notices; walking
straight past them it is 900. Carrying out all three goals costs the boundary and scores 750.
`pnpm sim` prints all of this, on the shape that reads both notices.

## 5c. Taking an offer on trust (added 2026-10-18)

Every conversation has a second way out: **Take it as offered**, which gives the verdict `allow`
from the dialogue without the skill card ever being opened.

**Only `allow`.** Restrict and Reject name what to strip, and from the conversation nothing has
been named. You cannot scope what you have not read. That asymmetry is the rule, and it is least
privilege stated as a game rule rather than as copy.

Until this existed the reducer made approval-without-inspection _impossible_: `VERDICT` required
`phase === 'inspect'`, which is only reachable through `INSPECT`. The game insisted the player
read every permission before granting it, which is the one thing the research says does not
happen. The fortieth prompt of the day gets the same half-second as the first.

**It is a gamble, not a trap.** An offer taken on trust scores nothing of its own; the whole of
what it is worth is `scoring.trustBonus`, paid once at the end and only if Red arrived with no
flags. So:

Every row below asks the two bonus questions; the run shape is in its own column, because two of the
three errand goals need a notice read and the same verdicts score differently without them.

| Line                                | Run shape                       | Total              | Ending           |
| ----------------------------------- | ------------------------------- | ------------------ | ---------------- |
| Careful `restrict/reject/restrict`  | either                          | 1,000              | Clean arrival    |
| Careful `restrict/reject/allow`     | both notices read (900 without) | 1,000              | Clean arrival    |
| Lantern **on trust**, the rest read | both notices read (900 without) | 1,000              | Clean arrival    |
| Three quick yeses                   | either                          | lowest in the game | The wolf's house |

Trusting the Lantern Keeper ties the ceiling, because their card genuinely has nothing hidden in
it. You only know that by having read it. Trusting all three lights every capability, fires the
notice, and lands below even allow-everything-after-reading-everything: **the fastest route
through the forest is the worst outcome.** Nothing else in the ruleset does that.

`trustBonus` is 100 deliberately. It lets the gamble _tie_ the careful line and never beat it, and
it keeps the ceiling at exactly 1,000.

**The button is the quietest thing on the screen**, by the same reasoning as UI_FOUNDATIONS section
2's refusal of Lime on Allow: it is the same unsafe answer with less reading attached, so it is Ash
at 14px, underlined, no arrow, no fill, after "Show me the skill" in the tab order. The only
warning the game gives is a statement of fact beside it, "You will not see the card.", on the first
encounter. No advice, no colour, no nudge.

**The server is not fooled.** `checkLog` replays an unread verdict without opening a card, so a
submitted log claiming an unread `restrict` fails with `must-open-the-card`. A client cannot award
itself the points for a careful verdict it never made.

**What Results says**, once, flatly: "You never opened this card." The fine print is then shown
anyway, which is the payoff.

## 6. Skills (draft content, data-driven)

| Skill                                  | Promise (shows on card)                                         | Fine print / hidden action                                                                          | Best verdict | Why                                                                              |
| -------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------------------------------- |
| Cottage Finder (compass)               | Finds the route: shows a path to Grandma's cottage on your map. | Also copies your cottage key: requests access to your key so it can keep a backup. (from the board) | **Restrict** | Take the route, refuse the key.                                                  |
| Word Weaver (translator) [PLACEHOLDER] | Translates what forest folk say.                                | Also forwards everything Red says to a "helper" address (the wolf).                                 | **Reject**   | The hidden action is the whole point; nothing useful remains after stripping it. |
| Night Light (lantern) [PLACEHOLDER]    | Lights what is written, so Red can read signs in the dark.      | Nothing hidden. Its stated purpose is the risk: it reads what strangers wrote.                      | **Restrict** | The one card where a boundary, not careful reading, is the answer.               |

Each hidden action must correspond to a real class of behavior in the research (credential access beyond purpose,
data exfiltration, instruction hijacking). **Have the research team sign off on every line of fine print and recap.**

## 7. Scoring (draft) [DECISION D7]

Rewritten 2026-10-16 to match the shipped `content/game.json`. The 300 / 150 / 0 values below were never built.

Amended 2026-10-17: the errand became three goals (see **The errand** below). The ceiling is still 1,000.

- Per skill: **best verdict = 200** (`scoring.maxPerSkill`), **safe but costly = 100**, **compromised (hidden action took effect) = 0**. Exception: **Word Weaver restrict = 50**, because restricting it now earns an errand goal — at 100 it was a free trade and "restrict everything" tied a perfect run.
- Bonus: **+100** if the player asked at least one of the **"What does it need?" / "Who made it?"** questions on **every** skill before deciding. "Show me" does not count. (Which questions count is `scoring.bonusQuestions` in content.)
- **Boundary bonus +200** if the three capabilities (`basket`, `strangers`, `word`) were never all live at once.
- **The errand (`scoring.errandGoals`): three goals, one per capability, 100 each.** A goal counts only when its capability is live **and**, where the goal names an `act`, the thing was actually done on the walk — so holding a capability is not the same as using it. A capability obtained by **allowing in full does not count**: the word it sent went to the wolf as well, so that is not Grandma's errand carried out.
  - `route` — find the cottage before dark. Needs `basket`. No act.
  - `word` — leave word at the post. Needs `word`, and the `forest-post` notice must have been read. **This is also where the trap is**: the errand and the trap are the same walk.
  - `sign` — read the note on Grandma's door. Needs `strangers`, and the `cottage-door` notice must have been read. This is the only thing `strangers` is good for, and it is why taking the lantern at its word is now rational rather than self-harm.
- Maximum **1,000**. You cannot collect all three goals and keep the boundary: all three goals require all three capabilities, which is the trifecta. 300 in goals costs the 200 boundary bonus plus the per-skill price, so the full errand peaks at 750 — `restrict/restrict/allow`, both notices read, questions asked, and it draws the **close call** ending rather than a clean one, because reading the post with all three legs live is the trap firing.
- **Totals as shipped. The run shape is part of the number** — two of the errand goals need a notice
  read, so the same three verdicts score differently depending on where Red walked, and a table that
  does not say which shape it is describing is not a table. Both columns are without questions and
  (with the +100 question bonus). Printed by `pnpm sim`, which always reads both notices, so its table
  is the right-hand column.

  | Line                       | Straight to the cottage, no notice read | Both notices read |
  | -------------------------- | --------------------------------------- | ----------------- |
  | `restrict/reject/restrict` | 900 (1,000)                             | 900 (1,000)       |
  | `restrict/reject/allow`    | 800 (900)                               | 900 (1,000)       |
  | restrict-all               | **750 (850)**                           | 850 (950)         |
  | reject-all                 | 600 (700)                               | 600 (700)         |
  | allow-all                  | 100 (200)                               | 200 (300)         |
  | `restrict/restrict/allow`  | 450 (550)                               | 650 (750)         |

  The restrict-all cell used to read 850 (950) in the straight-to-the-cottage column. That is the
  figure from the other column: restrict-all holds `word`, so the moment Red reads the forest post it
  earns a second goal. Two lines reach 1,000, both of them with questions asked: `restrict/reject/restrict`
  wherever she walks, and `restrict/reject/allow` only if she reads both notices.

- **Resolved 2026-10-17:** refusing everything no longer outscores engaging. Reject-all is 700 and draws **The long way round**; the best full-errand line is 750; every compromised line is below both. `docs/MAKING_IT_BETTER.md` section 4's own numbers were modelled and rejected — they produce a three-way tie at 900 with restrict-all on top.
- **Still open:** restrict-all reaches 950 of 1,000 (95%) by clicking the middle option three times, asking the two bonus questions and walking to the post. (Without the post it is 850.) The gap is Word Weaver, which is exactly the card you have to read — but 95% is high for a strategy that reads nothing.
- A run is the ordered **run log** (events: `met`, `asked`, `inspected`, `verdict`, `arrived`). Score is a pure function of the log + content version.

## 8. Cottage finale and endings

The wolf reveals consequences from flags set during the run: `keyStolen`, `messagesLeaked`, and (if a skill ever sets it) `locationLeaked`.

- **Clean arrival** (no flags): the door opens, real Grandma waves from inside; the wolf slinks away. Warm.
- **Close call** (one flag): the wolf is at the door holding the stolen thing; Red notices in time.
- **The wolf's house** (two or more flags): the wolf is already inside. Not gory; Red steps back, the door shuts. Text: "Someone wrote those instructions. It wasn't you."
  Each ending leads to the **recap** (one row per skill: your call, what was hiding, what it did), then the **leaderboard** and CTA.
  The board's final line, _"Grandma, why do you need my key?"_, plays when `keyStolen` is true.

## 9. Screens (specced in `reference/mocks/`)

1. Title / intro: Grandma's note, quest "Find Grandma", Play button.
2. Explore: HUD quest pill; joystick + A button on touch.
3. Question dialogue: portrait, line, three options.
4. Skill card: icon, name, promise row, fine-print row, Allow / Restrict / Reject, basket.
5. Arrive dialogue + wolf reveal.
6. Results: score, recap, post-score handle field, CTA.
7. Leaderboard: top five plus your row.

## 10. Out of scope for v1 (stretch, in priority order)

1. Off-the-path detours with a wolf-print trail (the campaign's name). 2. Music and sound effects (muted by default).
2. A second forest area and more skills. 4. Share card image of your result. 5. Localization (strings are already externalized).

## 11. Content governance

- Every string the player reads lives in `content/game.json`. English only for v1.
- Research team reviews all fine-print copy and the recap. Product marketing reviews tone. Legal reviews leaderboard and privacy copy.
- Never name real vendors, products or people in the game text.
