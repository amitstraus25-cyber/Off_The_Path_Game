import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * Builds the game before any spec runs.
 *
 * This used to live in `webServer.command`, next to `vite preview`, which meant the build only ran
 * when Playwright had to start a server. Locally `reuseExistingServer` is on, so a preview left
 * running by an earlier run was reused and **the build was skipped**: every spec then measured a
 * `dist` from before the edit under test. It has produced at least two false results on this
 * project -- a CSS guard that passed against stale stylesheets, and a rule deliberately broken to
 * check that the Results guards could catch it, which they appeared not to and in fact do.
 *
 * As a global setup it always runs. The preview server can still be reused, because `vite preview`
 * reads `dist` from disk per request and `index.html` is served uncached, so a reused server picks
 * the rebuilt files up.
 */
/**
 * The name `dist` is stamped with, so a later reader can tell WHICH KIND of build is on disk.
 *
 * `test/csp.test.ts` asserts that a production bundle carries no `__otp`, no `isSolidAt` and no
 * `mapObjects`. It reads `apps/game/dist`, and it decided whether to run from `process.env.VITE_E2E`
 * -- the environment of the TEST process, which says nothing about the environment of the BUILD
 * that produced the directory it is about to read. So running e2e and then `pnpm test` reported the
 * debug handle shipping to players, every time, on a tree where it does not. Two separate reviewers
 * hit it on the same afternoon and one nearly filed it as a defect.
 *
 * A stamp in the directory itself cannot drift from the directory's contents. It needs no cleanup,
 * because Vite empties `outDir` on every build: the next plain `pnpm build` removes this file as a
 * side effect of writing the bundle the guard wants to read.
 */
export const E2E_STAMP = '.e2e-build';

export default function build(): void {
  const cwd = fileURLToPath(new URL('.', import.meta.url));
  execFileSync('pnpm', ['build'], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, VITE_E2E: '1' },
  });
  writeFileSync(
    fileURLToPath(new URL(`dist/${E2E_STAMP}`, import.meta.url)),
    'Built by e2e-build.ts with VITE_E2E=1, so the debug hooks are present ON PURPOSE.\n' +
      'test/csp.test.ts skips its bundle check while this file exists. Run `pnpm build` to clear it.\n',
  );
}
