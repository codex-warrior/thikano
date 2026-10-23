import { defineConfig, devices } from '@playwright/test';

/**
 * Expects the Firebase emulators to be running and freshly seeded (npm run test:e2e does both).
 * Starts the Next dev servers itself. Locally you can reuse installed Chrome: E2E_CHANNEL=chrome.
 */
const channel = process.env.E2E_CHANNEL;
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', ...(channel ? { channel } : {}) },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], ...(channel ? { channel } : {}) } }],
  webServer: [
    { command: 'npm run dev -w @thikano/web', url: 'http://localhost:3000/contact', reuseExistingServer: !process.env.CI, timeout: 180_000, cwd: '..' },
    { command: 'npm run dev -w @thikano/owner', url: 'http://localhost:3001/login', reuseExistingServer: !process.env.CI, timeout: 180_000, cwd: '..' },
    { command: 'npm run dev -w @thikano/admin', url: 'http://localhost:3002/login', reuseExistingServer: !process.env.CI, timeout: 180_000, cwd: '..' },
  ],
});
