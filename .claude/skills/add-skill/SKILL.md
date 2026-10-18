---
name: add-skill
description: Add a new skill (and the character who offers it) to the Off the Path game using data only, with tests and content lint. Use when the user asks to add, change, or rebalance a skill, character, outcome, or ending.
---

Adding or editing a skill must never require code changes. If it does, stop and report why; that is a design bug.

1. Read docs/GAME_DESIGN.md sections 4 to 8 and the current `content/game.json`.
2. Ask (once) for any missing fields: character name and spawn object, skill name, promise (title + detail), fine print (title + detail + flag) or "none if safe", best verdict, and what each verdict does to the basket and score.
3. Edit **only** `content/game.json` (and `content/game.schema.ts` if a genuinely new field type is required, with a note on why).
4. Run the content lint (`pnpm run validate-content`). It must confirm: three outcomes, `bestVerdict` has the maximum points, a safe skill still exists, flags are known, no empty strings, no vendor names.
5. Add or extend table-driven tests in `packages/core/test` for the new skill x verdict combinations, plus an e2e line if a new character appears. Update scoring expectations in PLAN.md Phase 1/5 tests if totals changed.
6. List every new player-facing string so the research team can review it (append to docs/COPY_REVIEW.md).
7. Remind the user the Tiled map needs a matching `npc-<id>` object and the art needs a portrait and item sprite (docs/ASSETS.md); graybox placeholders can be regenerated with `tools/graybox`.
