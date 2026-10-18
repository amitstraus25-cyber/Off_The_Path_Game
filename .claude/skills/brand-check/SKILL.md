---
name: brand-check
description: Run a Cyera brand and visual-fidelity check on the current UI changes. Use before closing any phase that touches screens, or when asked to check the brand.
---

1. Start the dev server if it is not running and run the Playwright visual suite (`pnpm e2e --grep visual`), noting any screenshot diffs against the mocks in reference/mocks/.
2. Invoke the `brand-reviewer` subagent on the diff and wait for its report.
3. Grep for hard-coded hex values in `apps/game/src` (anything not coming from the brand CSS variables) and for second uses of `--cyera-lime` on any one screen.
4. Summarize: pass/fail per checklist item in docs/BRAND_AND_UI.md section 9, the visual diffs, and a prioritized fix list. Fix the clear violations; ask before changing anything that departs from a mock.
