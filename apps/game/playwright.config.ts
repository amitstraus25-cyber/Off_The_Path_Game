import { defineConfig } from '@playwright/test';

// Locally, set CHROMIUM_PATH to reuse an installed Chromium. CI runs "playwright install chromium".
const executablePath = process.env['CHROMIUM_PATH'];

export default defineConfig({
  testDir: './e2e',
  retries: process.env['CI'] ? 1 : 0,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'VITE_E2E=1 pnpm build && pnpm preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env['CI'],
    timeout: 120_000,
  },
});
