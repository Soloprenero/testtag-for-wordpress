import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';
import path from 'path';

/**
 * Playwright configuration for TestTag WordPress plugin screenshots
 * 
 * This configuration:
 * - Takes screenshots of admin pages and settings
 * - Takes screenshots of frontend functionality (audit mode, element tagging)
 * - Runs against a local WordPress installation with the plugin active
 * - Stores screenshots in tests/screenshots/ for visual regression testing
 */

const isTrue = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};
const dockerPort = (process.env.WORDPRESS_PORT || '8080').trim() || '8080';
const baseURL = (process.env.TEST_URL || `http://localhost:${dockerPort}`).trim();
const isDockerMode = isTrue(process.env.USE_DOCKER);
const skipWebServer = isTrue(process.env.SKIP_WEB_SERVER) || isDockerMode;
const skipGlobalSetup = isTrue(process.env.SKIP_GLOBAL_SETUP);
const authFile = path.join(__dirname, 'tests', '.auth', 'admin-auth.json');

const config: PlaywrightTestConfig = {
  testDir: './tests',
  testMatch: '{e2e,regression}/**/*.spec.ts',
  
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,

  // Increased timeout for Docker/WordPress startup
  timeout: process.env.CI ? 90000 : 60000,

  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results.json' }],
  ],

  use: {
    baseURL,
    storageState: skipGlobalSetup ? undefined : authFile,
    testIdAttribute: 'data-testid',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment for cross-browser testing:
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  // Tests use page objects to handle setup in Docker mode.
  globalSetup: skipGlobalSetup ? undefined : './tests/global-setup.ts',
  globalTeardown: isDockerMode ? './tests/global-teardown.ts' : undefined,

  // In Docker mode, containers are managed outside Playwright.
  webServer: skipWebServer ? undefined : {
    // Keep process alive for Playwright webServer lifecycle. Detached
    // docker compose up -d exits immediately and is treated as early-exit.
    command: 'docker compose up',
    url: baseURL,
    reuseExistingServer: !isTrue(process.env.CI),
    timeout: 120 * 1000,
  },
};

export default defineConfig(config);
