# Off the Path: Claude Code starter kit

Everything needed to start building **"That's Not My Grandma"**, the pixel adventure for Cyera's Off the Path research page, with Claude Code.

## What's inside

| Path                      | What it is                                                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `CLAUDE.md`               | Project memory Claude Code loads every session: goal, golden rules, brand + security rules, definition of done.                     |
| `docs/PLAN.md`            | **Start here.** Phased build plan (Phases 0 to 8) with tasks, effort sizes, acceptance criteria, milestones, open decisions, risks. |
| `docs/GAME_DESIGN.md`     | Story, metaphor mapping, characters, skills, verdict rules, scoring, endings.                                                       |
| `docs/ARCHITECTURE.md`    | Stack, repo layout, domain model, state machine, leaderboard API, embed contract, CSP, budgets, tests.                              |
| `docs/BRAND_AND_UI.md`    | Cyera tokens and exact component specs lifted from the mocks; brand QA checklist.                                                   |
| `docs/ASSETS.md`          | Art manifest, the production-art gap, and the graybox placeholder strategy.                                                         |
| `docs/KICKOFF_PROMPTS.md` | Copy-paste prompts for each phase and how to run sessions.                                                                          |
| `content/game.seed.json`  | Starter game content (data-driven; copy to `content/game.json`).                                                                    |
| `.claude/agents/`         | `brand-reviewer`, `security-reviewer` subagents.                                                                                    |
| `.claude/skills/`         | `add-skill`, `brand-check`, `phase-done` workflows.                                                                                 |
| `.claude/settings.json`   | Conservative permissions (allow project scripts, block `.env` reads and `curl`).                                                    |
| `reference/`              | Concept PDF, approved gameplay board, branded UI mocks (PNG + HTML), brand tokens and official logos.                               |

## Getting started

1. Make a new repo, copy this folder's contents into it, `git init`.
2. Open a terminal there, run `claude`, and paste **Prompt 0** from `docs/KICKOFF_PROMPTS.md`. Do not run `/init`.
3. Resolve the open decisions in `docs/PLAN.md` (especially **D1 safe skill**, **D2 production art**, **D3 backend**).
4. Work one phase per session; finish each with the `phase-done` skill and `/clear`.

## Things to know before you start

- **Production art does not exist yet.** The approved pixel art is a flattened concept board. Engineering proceeds on generated graybox placeholders; ask the design team for real tiles and sprites (spec in `docs/ASSETS.md`).
- **Fonts are not included.** Haffer and Season Mix are licensed; request the `.woff2` files from the Brand Kit. Inter/Georgia fallbacks are used meanwhile.
- **Illustrations and technical icons are not included** and must not be invented; they come from the design team.
- **Some content is placeholder** (Word Weaver, Night Light, recap copy). Research must review every player-facing string.
- The Results mock shows Night Light as malicious; the recommended design (D1) makes it safe. Update the mock copy to match whichever you choose.
- The concept PDF lists Lilac as `#D390FF`; the brand kit value is `#D28EFF`. This kit uses the brand kit value.
- Version numbers in the docs are intentionally unspecified. Claude Code should pin current stable versions that are at least 14 days old when scaffolding.
