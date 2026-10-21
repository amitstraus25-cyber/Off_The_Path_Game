/*
 * GET /api/top, served as an ordinary Vercel Function of the GAME service.
 *
 * The implementation lives in @otp/api and is unchanged; this file exists only to put a route
 * where Vercel will certainly find one. The second-service route did not work: `services.api`
 * with a null framework failed schema validation outright (which failed every deployment for six
 * hours), and with the key removed the deployment succeeds but the service still produces no
 * functions and /api/top returns Vercel's own 404 rather than anything of ours.
 *
 * A `<root>/api/*` directory beside a static build is the oldest and most widely supported
 * convention Vercel has, and it needs no multi-service support on any plan. Vite ignores this
 * directory because it sits outside `src`.
 *
 * THE `.ts` ON THE TWO IMPORTS BELOW IS DELIBERATE. DO NOT TIDY IT AWAY.
 * It looks like a TypeScript-only affectation that `allowImportingTsExtensions` happens to permit,
 * and the obvious cleanup is to drop it. That cleanup was proposed, tested and REFUTED here on
 * 2026-10-21, on node 22.23.1 -- the version `engines.node` pins and the one the platform runs:
 *
 *   import('@otp/api/src/deps.ts')  -> loads, exports `deps`
 *   import('@otp/api/src/deps')     -> ERR_MODULE_NOT_FOUND
 *
 * Node's ESM resolver does no extension searching for a bare-specifier subpath. A bundler such as
 * esbuild does, so the extensionless form works under a bundler and ONLY under a bundler. Nobody
 * here can tell from a checkout which of the two Vercel applies to this directory, and we do not
 * have to: the form WITH the extension is the one that resolves under both. It is the safe branch
 * of a question we cannot answer, which is why it stays until someone measures the platform itself.
 *
 * AND NOTHING IN THIS REPOSITORY WILL STOP YOU IF YOU DO TIDY IT AWAY. Measured 2026-10-21: drop
 * the `.ts` from the `handlers` import below and `pnpm --filter @otp/game build` still exits 0.
 * tsconfig.base.json sets `"moduleResolution": "Bundler"`, and Bundler resolution does exactly the
 * extension searching node's ESM resolver refuses to do -- so tsc resolves both forms and has no
 * opinion about which one the platform will get. The config below catches a module that is NOT
 * THERE; it cannot catch a module that is there under a name only a bundler will find. Between
 * that cleanup and a dead board on the platform there is this paragraph and nothing else.
 *
 * Typechecked by apps/game/tsconfig.api.json, wired into this app's `typecheck` AND `build`
 * scripts. `build` is the one that matters, and it was missing: vercel.json gives the game service
 * no buildCommand, so the platform runs this package's `build` script and never runs `typecheck`.
 * A config wired into `typecheck` alone gates CI while leaving the deploy -- the path it exists to
 * protect -- exactly as unguarded as it was before (trap 3: read the deployment, not the pipeline).
 * Proved by breaking it: with `handlers.ts` renamed to `handlerz.ts`, `pnpm --filter @otp/game
 * build` exits 2 on `api/top.ts: error TS2307` (no line:col quoted here on purpose -- editing this
 * very comment moved it from 35 to 58 while it was being written), and it fails BEFORE `vite build`
 * runs, so
 * no dist is produced and the deploy fails instead of shipping a dead board. Cost of the added
 * step, measured over three runs: 0.59-0.64s against a build of about four seconds.
 *
 * This config is NOT, however, "the only thing in the repository that reads these two route files
 * at all". That sentence stood here until 2026-10-21 and was simply false. `eslint .` resolves a
 * config for this directory and lints these files -- proved by planting an unused binding here and
 * watching `@typescript-eslint/no-unused-vars` report it by path -- and `prettier --check .`
 * formats them, proved the same way. What neither tool does is RESOLVE AN IMPORT: with the broken
 * `handlerz.ts` in place, `eslint .` exits 0 and prettier is happy, and only
 * `tsc -p tsconfig.api.json` says TS2307. The real gap was never "nothing reads these files", it
 * was "nothing TYPECHECKS them", because `tsc -p tsconfig.json` does not include this directory.
 * Until this config existed a broken import here could surface only as a dead leaderboard on a
 * deploy nobody was watching.
 */
import { deps } from '@otp/api/src/deps.ts';
import { handleTop } from '@otp/api/src/handlers.ts';

/*
 * `export default { fetch }`, NOT `export default function handler(request)`.
 *
 * The bare default function is a shape Vercel's own functions reference does not document for a
 * project without a framework. It documents exactly two: named method exports
 * (`export function GET(request)`) and this one, an object carrying `fetch`. The bare function was
 * what shipped first, and it is the kind of mistake that cannot fail in CI -- it typechecks, it
 * lints, and it is wrong only on the platform, as a 500 or a route that answers nothing.
 *
 * `fetch` rather than named methods because `handleTop` and `handleScore` already branch on
 * `request.method` themselves, and that branch is load-bearing: `handleScore` answers a non-POST
 * with `405` and an `Allow: POST` header, which is the ONLY way this project can tell "no function
 * is mounted" (404) from "a function is mounted and refused the method" (405). Named exports would
 * hand method routing to the platform and take that instrument away.
 */
export default {
  fetch: (request: Request): Promise<Response> => handleTop(request, deps),
};
