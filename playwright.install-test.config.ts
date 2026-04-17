/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 *
 * Standalone Playwright configuration for the plugin zip installation test.
 *
 * This config uses a separate WordPress instance (docker-compose.install-test.yml)
 * that has NO plugin pre-installed, so the test can exercise the full
 * Upload Plugin → Install → Activate flow from a blank site.
 *
 * Run:
 *   npx playwright test --config=playwright.install-test.config.ts
 */
import { defineConfig, devices } from '@playwright/test';

const baseURL = (process.env.TEST_URL || 'http://localhost:8081').trim();

export default defineConfig({
  testDir: './tests/e2e/installation',
  testMatch: '**/*.spec.ts',

  // Installation tests mutate WordPress state and must not overlap.
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  retries: 0,

  // Allow extra time for WordPress to process the zip upload.
  timeout: 120000,

  reporter: [
    ['html', { outputFolder: 'playwright-report-install' }],
    ['list'],
  ],

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'plugin-installation',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './tests/global-setup-install-test.ts',
});
