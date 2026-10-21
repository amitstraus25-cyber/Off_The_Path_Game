import { defineConfig } from '@playwright/test';

// Locally, set CHROMIUM_PATH to reuse an installed Chromium. CI runs "playwright install chromium".
const executablePath = process.env['CHROMIUM_PATH'];

export default defineConfig({
  testDir: './e2e',
  retries: process.env['CI'] ? 1 : 0,
  // The build runs here, not in webServer.command, so that reusing a preview server cannot skip it
  // and leave every spec measuring a stale dist. See e2e-build.ts.
  globalSetup: './e2e-build.ts',
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: executablePath ? { executablePath } : {},
    // On CI, a failing test keeps its trace (DOM, network, console, every action). CI used to fail
    // with one line of output and nothing else, on a Linux runner nobody here can reproduce; the
    // trace is uploaded by .github/workflows/ci.yml so the next failure arrives with evidence.
    trace: process.env['CI'] ? 'retain-on-failure' : 'off',
  },
  webServer: {
    /*
     * Playwright starts the server before globalSetup runs, so a checkout with no `dist` has
     * nothing to preview: this builds only in that case, and globalSetup does the build that
     * actually matters on every run. `vite preview` reads `dist` per request, so the rebuild
     * underneath a server started here -- or reused from an earlier run -- is picked up.
     */
    command: '(test -d dist || VITE_E2E=1 pnpm build) && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
