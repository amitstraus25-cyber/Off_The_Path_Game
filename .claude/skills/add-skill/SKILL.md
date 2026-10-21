---
name: add-skill
description: Add a new skill (and the character who offers it) to the Off the Path game using data only, with tests and content lint. Use when the user asks to add, change, or rebalance a skill, character, outcome, or ending.
---

Adding or editing a skill must never require code changes. If it does, stop and report why; that is a design bug.

1. Read docs/GAME_DESIGN.md sections 4 to 8 and the current `content/game.json`.
2. Ask (once) for any missing fields: character name and spawn object, skill name, promise (title + detail), fine print (title + detail + flag) or "none if safe", best verdict, and what each verdict does to the basket and score.
3. Edit **only** `content/game.json`. The schema and the content lint live in `packages/core/src/content.ts` — `contentSchema` and `loadContent`. There is no `content/game.schema.ts`. If a genuinely new field type is required, that file is where it goes, with a note on why.
4. Run `pnpm test`. There is no `validate-content` script; `loadContent` runs inside the suite (and again at startup), and it must confirm: three outcomes, `bestVerdict` has the maximum points, a safe skill still exists, flags are known, no empty strings, no vendor names. `apps/game/test/strings.test.ts` additionally scans the UI and the file against each other in both directions, so a new string that nothing reads, or a read of a key that does not exist, fails the build.
5. Add or extend table-driven tests in `packages/core/test` for the new skill x verdict combinations, plus an e2e line if a new character appears. `packages/core` is gated at 100% on statements, branches, functions and lines, so a new branch needs a test or the gate breaks. Update scoring expectations in PLAN.md Phase 1/5 and GAME_DESIGN section 7 if totals changed — and say which **run shape** a total belongs to: two of the three errand goals need a notice read, so the same verdicts score differently depending on where Purple walked.
6. List every new player-facing string so the research team can review it (append to docs/COPY_REVIEW.md).
7. Remind the user the map needs a matching object whose name equals the character's `spawn` field (the convention is `npc-<id>`), and the art needs a portrait and an item sprite. **The map is generated, not hand-edited in Tiled**: add the spawn in `tools/graybox/src/forest-map.ts` and run `pnpm graybox`, which rewrites every shipped asset, so run it once at the end and diff. Placeholder sprites come from the same command; the shipped file list is `apps/game/src/assets/manifest.json` and the drawing rules are `docs/PIXEL_STANDARD.md`.
