/*
 * Turns off zod's compiled fast path, before any schema in this package is built.
 *
 * WHY. zod 4 compiles object parsers with the Function constructor, and it PROBES for that the
 * moment the first object schema is CONSTRUCTED -- not at the first parse. Under the policy
 * vercel.json ships (`script-src 'self'`, no `'unsafe-eval'`) the probe throws, zod catches it and
 * falls back to the interpreted path, so parsing is correct either way. What is not harmless is
 * what the browser does on the way: it reports an enforced `securitypolicyviolation`, so every
 * visitor to a Cyera research page gets a CSP error in the console on load, on a page whose entire
 * argument is that Cyera takes this seriously. Measured on the shipped build, served behind the
 * real headers: exactly one violation per load, `script-src blocked eval`.
 *
 * WHY HERE, AND WHY FIRST. The probe fires during `content.ts`'s module evaluation, because that
 * file builds its schemas at top level. A module body cannot run before its own imports, so no
 * statement in `apps/game/src/main.ts` -- or anywhere else downstream -- is early enough, and zod
 * memoises the result, so a later call does nothing. Every module in this package that imports
 * `zod` imports this file first, so a direct submodule import cannot get in ahead of it either.
 *
 * NOT A SECURITY CONTROL. `jitless` only selects zod's interpreted parser. It does not relax the
 * policy and it does not change what validates: the same schemas accept and reject the same input.
 * It is a performance switch being set to the only setting the CSP permits anyway.
 *
 * The guard is `apps/game/e2e/shipped-headers.spec.ts`, which loads the built game behind the real
 * headers and fails on any violation at all.
 */
import { config } from 'zod';

config({ jitless: true });
