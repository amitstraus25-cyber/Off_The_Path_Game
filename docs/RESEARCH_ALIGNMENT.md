# Research alignment and a proposal to raise the game

Written 2026-10-16 after reading the published research on malicious agent skills, including Cyera's
own. It is for the game design, research and marketing owners to argue with. Sources are listed at the end.

> **"Nothing here has been built" was true when this was written and is not true now.** Most of
> section 4's headline proposals have shipped, so read this as the argument for the current design
> rather than as a wish list, and check `content/game.json` and `packages/core` before proposing any
> of it again:
>
> - **4.1, the trifecta as the spine** — built. `capabilities` in `content/game.json`, `trifectaLive`
>   and `liveCapabilities` in `packages/core`, the HUD chip in `Trifecta.tsx`.
> - **4.2, a skill with no fine print that still costs you** — built, as Night Light plus the forest
>   post's `whenExposed`. The notice fires only with all three legs live.
> - **4.4 / the errand** — built, as `scoring.errandGoals` and the two notices.
> - **4.5, score the boundary** — built, as `scoring.boundaryBonus` (200), and D7 is recorded resolved
>   in `docs/PLAN.md` on the strength of it. Reject-all is no longer 600 of 1,000 against a careful
>   run; it draws its own ending and the best full-errand line beats it.
>
> **Still genuinely open and still blocking:** open question 4 below. `docs/PLAN.md` D1, the amended
> Night Light direction, is the card that carries the thesis, and research has not confirmed it.
> `docs/GAME_DESIGN.md` section 4 and `docs/UX_REVIEW.md` decision D both say it should not publish
> unconfirmed.
>
> **Checked and not built:** 4.3 (Restrict is still one of three buttons, not a permission manifest),
> 4.6 (nothing edits Grandma's note), 4.7 (inspection is still a page), 4.9 (there is no run-to-run
> variation — there is no randomness anywhere in `packages/core` or `apps/game/src`, by design).
> 4.8 shipped only as far as the arrival beat; there is no refusal at the door. Of 4.10, the CTA
> question is in place as `ctaPrompt`; the other two items are not.

---

## 1. The headline problem

**The game currently teaches a lesson Cyera's own research says is not sufficient.**

The game's loop is: a character offers a skill, the player opens the card, reads the promise and the
fine print, and decides. The lesson a player takes away is _"read carefully before you accept."_

Cyera's research, [When Language Becomes the Attack Vector: The Lethal Trifecta of AI
Agents](https://www.cyera.com/research/when-language-becomes-the-attack-vector-the-lethal-trifecta-of-ai-agents)
(Yuval Sarel and Ofek Itach, 6 March 2026), argues close to the opposite:

- The attack is **zero-click**. "The user never asks for anything."
- The payload is **ordinary language inside normal business content**, so there is no malicious code
  to block and nothing suspicious to read.
- Agents behave exactly as built, data leaves through sanctioned tools, and no DLP alert fires.
- Therefore security teams **cannot prompt-engineer or train their way out of it**; the answer is
  architectural boundaries. The companion blog closes on "Hard boundaries are not optional."

So a security leader who plays the game as it stands could reasonably leave thinking _"I should teach
my people to read permission prompts carefully."_ That is the wrong takeaway, and it is the specific
belief the research sets out to dismantle.

**To be fair to the current design**, the fine-print mechanic is not wrong, it is _half the story_.
It accurately models the **skill-marketplace / supply-chain** threat, where the malicious instruction
really does sit in the skill's own description and really can be caught by review. That half is well
documented (Snyk's ToxicSkills audit, MCP tool poisoning, the OWASP Agentic Skills Top 10) and the
game covers it well. What is missing is the **runtime** half, which is the half Cyera researches.

The fix is not to throw away the card. It is to add the beat where careful reading is not enough.

---

## 2. What the research actually says

### 2.1 The Lethal Trifecta (Cyera's frame, originally named by Simon Willison)

An agent is exposed when it has all three of:

1. **Access to private data** — internal mail, documents, secrets.
2. **Access to untrusted content** — incoming mail, web pages, shared PDFs. Once that text is in the
   context window the agent cannot reliably tell data from instructions.
3. **External communication** — sending mail, loading an image, posting to a ticket or chat tool.

Any two are survivable. All three together turn an injected sentence into data theft. CSA reports its
AIRQ assessment found **98% of evaluated agents carry all three conditions at once**.

Cyera's worked examples: a meeting invite whose description tells the assistant to include internal
notes in its auto-reply; a résumé PDF with embedded instructions; instructions hidden in spreadsheet
cell comments; a support ticket that asked for "any relevant internal documentation" and, in an
unverified customer anecdote, produced 47 emails carrying internal documents.

**This is the single most important thing the game does not currently model.** Today each skill is
judged alone. In the research the danger is the _combination_, and no individual skill looks wrong.

### 2.2 The marketplace half (what the game already models well)

Snyk's [ToxicSkills](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/) audit
scanned 3,984 skills from ClawHub and skills.sh: 13.4% had a critical issue, 36.8% had at least one
issue, and 76 were confirmed malicious. Of the confirmed malicious ones, **91% combine prompt
injection with conventional malware**. Their eight-category taxonomy is a useful checklist for
writing skill content:

| Category                      | Risk     | In fairy-tale terms                                    |
| ----------------------------- | -------- | ------------------------------------------------------ |
| Prompt injection detection    | critical | hidden instructions that drift from the stated purpose |
| Malicious code detection      | critical | a backdoor sewn into the lining                        |
| Suspicious download detection | critical | a parcel from an unknown road                          |
| Credential handling           | high     | asking to hold your key "for safekeeping"              |
| Secret detection              | high     | keys left written on the thing itself                  |
| Third-party content exposure  | medium   | **it reads notices written by strangers**              |
| Unverifiable dependencies     | medium   | it fetches new orders after you approved it            |
| Direct money access           | medium   | reaching straight for the purse                        |

Two of those map onto game beats that do not exist yet and should: **third-party content exposure**
is the trifecta's second leg, and **unverifiable dependencies** means _the thing you approved can
change its mind later_.

### 2.3 Persistence and impersonation

CSA's note on [SKILL.md agent context
poisoning](https://labs.cloudsecurityalliance.org/research/csa-research-note-skill-md-agent-context-poisoning-20260506/)
adds two beats worth stealing:

- **Persistence.** Payloads instruct the agent to write modified instructions into other context
  files such as `CLAUDE.md` or `AGENTS.md`, so the compromise survives removal of the skill that
  planted it, and spreads to colleagues who pull the same repository.
- **Concealment and impersonation.** Instructions hidden in Unicode tag characters that reviewers
  cannot see but the model still processes; typosquatted names with inflated download counts for
  social proof. Snyk linked 341 malicious skills to a single ClawHub campaign.

### 2.4 What defenders are told to do

Cyera recommends four boundary layers, and these are the real "right answers" a player should leave
with:

1. **Identity and scoped permissions** — least privilege, time-bound, effective access is the
   intersection of user permissions and agent scope.
2. **Data-flow enforcement** — every tool call is a checkpoint; if a session touched restricted data,
   block external writes for the rest of the session.
3. **Session isolation** — no shared state, no auto-fetching external content, one controlled gate.
4. **Human-in-the-loop approval** — when an action crosses a trust boundary, **the agent drafts and a
   human sends**.

Layer 2 is a game mechanic waiting to happen. Layer 4 is the cottage door.

---

## 3. Audit of the current content

| Current element                                                | Maps to                                                  | Verdict                                                                                               |
| -------------------------------------------------------------- | -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Cottage Finder: "also copies your cottage key"                 | Credential handling; over-privileged skill (OWASP AST03) | **Accurate.** Keep.                                                                                   |
| Word Weaver: "forwards everything you say to a helper address" | Data exfiltration; the third trifecta leg                | **Accurate.** Keep.                                                                                   |
| Night Light: honest on inspection, dangerous by default        | Untrusted-content exposure; the trifecta's reading leg   | **Changed 2026-10-16** in 4.2's direction. Research has not confirmed: open question 4 is still open. |
| Owl: "a traveler left this with me"                            | Supply chain                                             | Right instinct, currently only flavour. Make it load-bearing.                                         |
| Restrict = "the hidden action is stripped"                     | Least privilege                                          | Right idea, but one button cannot express a permission _manifest_.                                    |
| Fine print is plain text at the same size as the promise       | Marketplace review                                       | Fine for that half. Insufficient alone.                                                               |
| Reject-all scores 600 of 1,000                                 | —                                                        | **Wrong signal.** See 4.5.                                                                            |

### The three gaps, in priority order

1. **No combination risk.** Every skill is judged in isolation. The research's whole claim is that
   the danger is cumulative and that each part looks innocent.
2. **No zero-click beat.** Every attack in the game is visible on the card at decision time. In the
   research the instruction arrives _later_, inside content the agent reads.
3. **Nothing persists.** Every consequence is scored at the cottage and forgotten.

---

## 4. Proposals

Ordered by value for effort. Each says what it buys as a _game_ and what it buys as _truth_.

### 4.1 Make the trifecta the spine of the game — **the big one**

Every skill card gains three capability marks, and this is what the player is really deciding about:

| Mark                         | In the forest                                    | In the research        |
| ---------------------------- | ------------------------------------------------ | ---------------------- |
| **Reaches into your basket** | it can see the key, the letter, Grandma's note   | access to private data |
| **Listens to strangers**     | it reads signposts, notices, what passers-by say | untrusted content      |
| **Sends word ahead**         | it can send a message, leave a mark, call a bird | external communication |

No single mark is dangerous. The wolf can only act when **all three are live at once** across
everything Red is carrying. A running indicator in the HUD shows which legs are lit; when the third
one lights, the forest quietly changes (colour grade, the music thins, paw prints appear).

- **As a game:** this turns three independent multiple-choice questions into one combinatorial puzzle
  with real tension and no memorisable answer. The player is managing a budget, not taking a quiz.
  It is the difference between a worksheet and a game.
- **As truth:** it _is_ Cyera's research, made playable. It also fixes the "reject everything" problem
  honestly, because the interesting play becomes "which two legs can I afford?"

### 4.2 One skill with no fine print that still costs you — **the second big one**

Night Light stays genuinely clean on inspection, because it genuinely is. But it **listens to
strangers**: its whole job is to light up what is written on things in the dark.

Later, off the path, there is a notice nailed to a tree. If Red is carrying Night Light _and_
something that reaches into the basket _and_ something that sends word ahead, the notice's hidden
line executes. No card could have warned the player. They did everything the fine-print lesson asked.

- **As a game:** this is the twist the whole thing needs. It reframes everything the player just did
  and is the moment they will describe to a colleague.
- **As truth:** this is the zero-click attack, exactly as Cyera describes it. It is the one beat that
  moves the takeaway from "read carefully" to "bound what it can do."

### 4.3 Restrict becomes a permission manifest, not a button

Replace the single Restrict with per-capability toggles on the card: grant the route, refuse the key.
Allow becomes "grant everything", Reject "grant nothing", and Restrict is whatever the player builds
in between.

- **As a game:** the most interesting decision in the game stops being a three-way guess.
- **As truth:** this is a least-privilege manifest (OWASP AST03) and Cyera's scoped permissions.

### 4.4 Make "off the path" mean something

The campaign is called Off the Path and the path is currently decorative. Leaving it should be how
you find **provenance**: the woodcutter who remembers the traveller, the crate the compasses arrived
in, a maker's mark. It is also where the untrusted notices are. Risk and reward in the same act, and
the campaign name finally describes a mechanic.

This also makes **"Who made it?"** load-bearing instead of flavour: pair it with a **typosquatted
skill** (two near-identical compasses, different makers, one with a homoglyph in the name) that can
only be told apart by going and looking. That is registry impersonation, which is a documented
campaign, not a hypothetical.

### 4.5 Score the boundary, not the individual verdicts

Today: three independent scores plus a question bonus; reject-all gets 600 of 1,000, which the plan
already flags as too generous (decision D7).

Proposed: two separate things, both shown.

- **Did you finish the errand?** Reject-all should **fail** it — you arrive empty-handed, which is the
  equivalent of switching the agent off. That is not a 600.
- **Did you ever let all three legs light at once?** This is the safety score.

The best run is the one that got Grandma her basket _and_ never completed the trifecta. That is the
sentence we want a security leader to repeat.

### 4.6 Something that persists across the run

One skill quietly edits **Grandma's note** — Red's own instructions, the thing in the basket the
player read on the title screen. Drop the skill later and the edit stays. On the results screen the
note is shown again with the changed line highlighted.

- **As truth:** this is the `CLAUDE.md` / `AGENTS.md` persistence finding, and it is the beat that
  explains why "just remove the bad skill" is not a remediation.

### 4.7 Inspection should be an action, not a page

Hold the lantern to the card and a line appears that was not there before. Turn the card over for the
maker's mark. One skill's fine print is _literally invisible_ until lit, which is the Unicode
tag-character trick from the research made physical.

- **As a game:** inspecting becomes something you _do_, which is the difference between a game and a
  slideshow, and it makes the lantern meaningful beyond its own card.

### 4.8 The cottage door is the human-in-the-loop gate

At the door, Red is about to hand the basket over. One confirmation: _"Give the basket to Grandma?"_
If the player kept their boundaries, they get a tell (the paw prints, the voice is wrong, the lamp is
lit when it should not be) and can still refuse. If all three legs were lit, the handover already
happened and the prompt never appears.

- **As truth:** this is Cyera's fourth boundary, "the agent drafts and a human sends", as the last
  beat of the story.

### 4.9 Rotate which skill is malicious between runs

Within the same taxonomy, swap which offer carries which trick per run. Replay stops being recall.

### 4.10 Smaller things worth doing

- Make basket contents matter individually: the key opens the cottage, the letter carries the
  address, so losing each has a different visible ending, not just a flag count.
- Show a one-line "what this was" on each recap row (credential access, exfiltration, supply chain),
  so the player leaves with vocabulary they can use in a meeting.
- The CTA question currently reads "Who wrote the instructions your agent follows?" That is well
  aimed; keep it and make the final scene pay it off literally by showing the wolf's handwriting on
  the notice from 4.2.

---

## 5. What I would build first

If only two things are done, do **4.1 (the trifecta spine)** and **4.2 (the zero-click twist)**. They
are what make the game match the research, and they are also what make it a game rather than a quiz.
**4.3** and **4.5** fall out of 4.1 cheaply once it exists. **4.8** is nearly free and gives the
ending a point.

Everything here is data and rules, which the current architecture is already built for: skills,
capabilities and outcomes live in `content/game.json`, the rules live in `packages/core`. The trifecta
would add a capability list per skill and a cumulative check, not a rewrite.

---

## 6. Open questions for the research team

1. Is the Lethal Trifecta piece the research this campaign points at? If so, the game should be built
   around it, and the current design is aimed somewhere else.
2. Are we comfortable dramatising the unverified "47 emails" anecdote, or should the game stay with
   the mechanism and avoid implied incident claims?
3. Should the game name the attack classes in the recap (exfiltration, supply chain, over-privilege),
   or stay entirely inside the fairy tale and let the research page do the naming?
4. Decision D1 said Night Light is "genuinely safe." Proposal 4.2 keeps it honest on inspection but
   makes it the untrusted-content leg. Does research prefer that, or a skill that is safe full stop?

---

## Sources

- [When Language Becomes the Attack Vector: The Lethal Trifecta of AI Agents](https://www.cyera.com/research/when-language-becomes-the-attack-vector-the-lethal-trifecta-of-ai-agents) — Cyera Research, Yuval Sarel and Ofek Itach, 6 March 2026
- [The Lethal Trifecta: Why AI Agents Require Architectural Boundaries](https://www.cyera.com/blog/the-lethal-trifecta-why-ai-agents-require-architectural-boundaries) — Cyera
- [The lethal trifecta for AI agents](https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/) — Simon Willison, 16 June 2025
- [Snyk ToxicSkills study](https://snyk.io/blog/toxicskills-malicious-ai-agent-skills-clawhub/) — 3,984 skills scanned, eight-category taxonomy
- [Agent Context Poisoning: SKILL.md and the New AI Supply Chain Attack Surface](https://labs.cloudsecurityalliance.org/research/csa-research-note-skill-md-agent-context-poisoning-20260506/) — Cloud Security Alliance
- [Poisoned Skills: AI Agent Marketplace Supply Chain Attacks](https://labs.cloudsecurityalliance.org/research/csa-research-note-ai-skill-supply-chain-attacks-20260624-csa/) — Cloud Security Alliance
- [OWASP Agentic Skills Top 10](https://owasp.org/www-project-agentic-skills-top-10/) — AST01 Malicious Skills, AST03 Over-Privileged Skills (draft, v1.0 targeted Q4 2026)
- [OWASP MCP Tool Poisoning](https://owasp.org/www-community/attacks/MCP_Tool_Poisoning)
- [MCPTox: A Benchmark for Tool Poisoning Attack on Real-World MCP Servers](https://arxiv.org/pdf/2508.14925)
- [MalSkillBench: A Runtime-Verified Benchmark of Malicious Agent Skills](https://arxiv.org/pdf/2606.07131)

**A caution on figures.** Several numbers above come from single vendor studies or preprints
(detection rates, the 98% AIRQ figure, the 341-skill campaign). Verify against the originals before
any of them appears in player-facing copy or marketing.
