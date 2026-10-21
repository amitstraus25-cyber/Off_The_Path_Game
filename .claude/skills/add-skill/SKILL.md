---
name: add-skill
description: Add a new skill (and the character who offers it) to the Off the Path game using data only, with tests and content lint. Use when the user asks to add, change, or rebalance a skill, character, ending or screen copy.
---

Adding or editing a skill must never require code changes. If it does, stop and report why; that is a design bug.

1. Read docs/GAME_DESIGN_V2.md (the cards, the deal, the clock) and the current `content/game.v2.json`. `docs/GAME_DESIGN.md` is v1 and superseded: do not follow it.
2. Ask (once) for any missing fields: character name and spawn object, skill name, icon, promise (one line, true in both variants), the good card (take lines and leave line) and its reveal, the bad card (the good card with exactly ONE take line swapped for a plain giveaway line) and its reveal, and the `realWorld` term and note (at most 25 words, two sentences).
3. Edit **only** `content/game.v2.json`. The schema and the content lint live in `packages/core/src/v2/content.ts` (`contentSchema`, `lintContent`); `loadContent` in `v2/load.ts` also plays the trap checks. There is no separate schema file. If a genuinely new field type is required, that file is where it goes, with a note on why.
4. Run `pnpm test`. `loadContent` runs inside the suite (and again at startup). The lint requires: one character per skill, a bad card that swaps one line of the good card and keeps its line count, a short giveaway, a bounded `realWorld`, no vendor names, no placeholder text in a launch build. The trap checks require that the careful run reaches the ceiling in every deal and that no card-blind basket averages above the rote line. `pnpm sim` prints both. `apps/game/test/strings.test.ts` fails on a `ui.chrome` key the UI reads and the file lacks.
5. A new branch in core needs a test: `packages/core` is gated at 100% on statements, branches, functions and lines. A launch build is seven skills, three dealt good, so adding an eighth changes `LAUNCH_CAST` and the clock test; say so rather than working around it.
6. List every new player-facing string so the research team can review it (append to docs/COPY_REVIEW.md).
7. Remind the user the map needs a matching object whose name equals the character's `spawn` field (`npc-<id>` or `bystander-<id>`), and the art needs a sprite sheet in `apps/game/src/assets/manifest.json` and an icon. **The map is generated, not hand-edited in Tiled**: add the spawn in `tools/graybox/src/forest-map.ts` and run `pnpm graybox`, which rewrites every shipped asset, so run it once at the end and diff. The drawing rules are `docs/PIXEL_STANDARD.md`.
