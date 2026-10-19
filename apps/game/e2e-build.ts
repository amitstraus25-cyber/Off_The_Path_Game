import { execFileSync } from 'node:child_process';
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
export default function build(): void {
  const cwd = fileURLToPath(new URL('.', import.meta.url));
  execFileSync('pnpm', ['build'], {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, VITE_E2E: '1' },
  });
}
