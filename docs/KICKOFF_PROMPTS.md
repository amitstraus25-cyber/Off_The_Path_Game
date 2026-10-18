# Kickoff prompts for Claude Code

## Setup (once)

1. Create the repo folder, copy this kit into it, `git init`, open a terminal there and start Claude Code. **Do not run `/init`**: `CLAUDE.md` already exists and `/init` would try to regenerate it.
2. Check `/memory` shows `CLAUDE.md`, `/agents` lists `brand-reviewer` and `security-reviewer`, and the skills `add-skill`, `brand-check`, `phase-done` are available.
3. Skim `.claude/settings.json` and adjust permissions to your comfort (it allows project scripts and read-only git, and blocks `.env` reads and `curl`).
4. Work **one phase per session**. Begin each in plan mode, approve the plan, then let it implement. Run `/clear` between phases (project memory stays). Commit after each task.

## Prompt 0: orient and set up (Phase 0)

```
Read CLAUDE.md, then docs/PLAN.md, docs/ARCHITECTURE.md and docs/BRAND_AND_UI.md.
Summarize the project in 8 lines and list anything ambiguous or risky. Then plan Phase 0 only.
Constraints: pin exact dependency versions and skip any package version published in the last 14 days;
ask before adding any dependency not listed in ARCHITECTURE section 2. Do not write game code yet.
Start with the scaffold and CI, then the Phaser-vs-canvas spike, then tools/graybox. Show me the plan first.
```

## Prompt 1: core rules (Phase 1)

```
Plan and implement Phase 1 from docs/PLAN.md, test-first. packages/core must be pure TypeScript (no Phaser, DOM, window,
network, or Date.now; time is injected). Use content/game.seed.json as content/game.json and write the zod schema and
content lint first. Implement the reducer, run log, scoring and outcomes with table-driven tests for every skill x verdict.
Finish with a `pnpm sim` CLI. Report coverage and the totals for reject-all, allow-all and perfect runs.
```

## Prompt 2: the forest (Phase 2)

```
Plan and implement Phase 2. Use the graybox assets from tools/graybox. Phaser renders the world only; no UI text on canvas.
Build: boot/loader that fails on missing assets, tilemap with layered depth, Red movement with collision, camera,
a DOM virtual joystick + A button using pointer events, NPC interaction prompts, and the typed event bus that
switches the store phase. I should be able to walk the whole map on keyboard and on a phone-sized viewport.
Verify crisp pixels at DPR 1, 2 and 3 and report fps.
```

## Prompt 3: brand UI (Phase 3)

```
Plan and implement Phase 3. Read docs/BRAND_AND_UI.md closely and open reference/mocks/*.html to copy exact CSS values.
Build the components and a /ui-lab page (not shipped) showing each component state next to its mock PNG.
Use only CSS variables from the brand theme; Lime at most once per screen; no red/green; pixel art crisp.
Then run the brand-reviewer subagent and fix everything it finds. Add Playwright screenshot + axe tests.
```

## Prompt 4: vertical slice (Phase 4)

```
Plan and implement Phase 4: the Rabbit + Cottage Finder encounter end to end using the real store, content and UI.
Add the Playwright test that talks, asks all three questions, inspects, chooses Restrict, and checks the basket and score.
Deploy a protected preview and give me the URL plus three things you'd want a playtester to tell us about card readability.
```

## Prompt 5: full game (Phase 5)

```
Plan and implement Phase 5. The Owl and Lantern Keeper must be added through content/game.json only; if you need code
special-cases, stop and tell me why. Build the cottage finale, the three endings, the results screen with recap rows,
the handle field and the one-Lime Read the Research band. Add e2e tests for perfect, reject-all and allow-all runs.
List every string the research team must review in docs/COPY_REVIEW.md.
```

## Prompt 6: leaderboard (Phase 6)

```
Plan and implement Phase 6. First ship the mock adapter and leaderboard UI. Then the Worker API per docs/ARCHITECTURE section 8:
HMAC run tokens, server-side score recompute using packages/core, handle validation and blocklist, UTC week window,
hashed IP rate limiting with no raw IP storage. Write the forged-log test suite (inflated score, illegal order,
wrong content version, replayed token). The game must stay fully playable if the API is down. Then run security-reviewer.
```

## Prompt 7: embed and hardening (Phase 7)

```
Plan and implement Phase 7: iframe embed with the postMessage contract and origin checks, strict CSP and security headers,
a Playwright assertion of zero third-party network requests, accessibility audit fixes (keyboard, screen reader labels,
zoom 200%, reduced motion), performance budget checks in CI, and cross-browser notes. Report budget numbers.
```

## Prompt 8: launch (Phase 8)

```
Plan Phase 8: a playtest script and observation sheet, a content lint pass that fails on any placeholder string,
the launch checklist, a runbook (docs/RUNBOOK.md) for moderation and rollback, and the post-launch metrics events.
Do not change game rules; propose data-only tuning from playtest notes.
```

## Handy follow-ups

- "Run the phase-done skill." (checks tests, ticks PLAN.md, summarizes deferrals)
- "Use the brand-reviewer subagent on the diff." / "Use the security-reviewer subagent on apps/api."
- "Add a fourth skill called X that does Y" -> triggers the `add-skill` skill (data only, tests, lint).
- If Claude proposes a dependency, a hard-coded color, or UI text on the canvas, point it at CLAUDE.md golden rules.
