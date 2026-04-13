import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';
import type { TestTagSettings } from './tests/fixtures';
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

const config: PlaywrightTestConfig<object, { testTagSettings: TestTagSettings }> = {
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  
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
    // ── Settings profile setup projects ───────────────────────────────────────
    // Each setup project configures WordPress with one settings profile before
    // its dependent test project runs.  Profile projects MUST NOT run against
    // the same WordPress instance simultaneously — run one profile at a time:
    //
    //   npx playwright test --project=default          # default profile only
    //   npx playwright test --project=data-cy          # data-cy profile only
    //   npx playwright test --project=settings-validation
    //
    // In CI, each profile can be a separate job with its own WordPress instance.
    {
      name: 'setup:default',
      testMatch: '**/setup/default.setup.ts',
    },
    {
      name: 'setup:data-cy',
      testMatch: '**/setup/data-cy.setup.ts',
    },

    // ── Settings-agnostic suites — one project per profile ────────────────────
    // The same tests run against every profile; tests derive all expected values
    // from the testTagSettings fixture rather than hardcoding attribute names or
    // separator characters.
    {
      name: 'default',
      dependencies: ['setup:default'],
      use: {
        ...devices['Desktop Chrome'],
        testIdAttribute: 'data-testid',
        testTagSettings: { attributeKey: 'data-testid', separator: '-', tokenOrder: '' },
      },
      testMatch: [
        '**/frontend-audit/**/*.spec.ts',
        '**/admin/**/*.spec.ts',
        '**/parity/**/*.spec.ts',
      ],
    },
    {
      name: 'data-cy',
      dependencies: ['setup:data-cy'],
      use: {
        ...devices['Desktop Chrome'],
        testIdAttribute: 'data-cy',
        testTagSettings: { attributeKey: 'data-cy', separator: '-', tokenOrder: '' },
      },
      testMatch: [
        '**/frontend-audit/**/*.spec.ts',
        '**/admin/**/*.spec.ts',
        '**/parity/**/*.spec.ts',
      ],
    },

    // ── Settings-validation suites ────────────────────────────────────────────
    // These tests explicitly verify settings behavior and manage their own
    // settings state via beforeAll/afterAll.  They run serially to avoid
    // interfering with each other and start from the default profile.
    {
      name: 'settings-validation',
      dependencies: ['setup:default'],
      use: {
        ...devices['Desktop Chrome'],
        testIdAttribute: 'data-testid',
        testTagSettings: { attributeKey: 'data-testid', separator: '-', tokenOrder: '' },
      },
      testMatch: '**/configuration/**/*.spec.ts',
      fullyParallel: false,
    },
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
