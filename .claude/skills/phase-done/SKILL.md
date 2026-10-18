---
name: phase-done
description: Close out a build phase from docs/PLAN.md with verification and a summary. Use when a phase's tasks are finished or the user says the phase is done.
---

1. Run `pnpm typecheck`, `pnpm lint`, `pnpm test`, and `pnpm build`; run `pnpm e2e` if the phase touched UI or flow. Everything must pass.
2. Open docs/PLAN.md for the phase: confirm each task is genuinely done, tick the boxes, and check the phase's **Acceptance** line against evidence (commands run, screenshots, numbers).
3. For UI phases run the `brand-check` skill; for API/embed phases run the `security-reviewer` subagent.
4. Update CLAUDE.md "Commands" and docs/ARCHITECTURE.md if reality drifted from the plan.
5. Write a short close-out note at the bottom of the phase in PLAN.md: what shipped, what was deferred or assumed, open questions for the humans, and the decisions table rows that changed.
6. Suggest the commit message, then suggest running `/clear` before the next phase.
