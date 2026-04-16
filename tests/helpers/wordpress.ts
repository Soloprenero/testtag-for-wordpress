/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import type { Page } from '@playwright/test';
import { TESTTAG_PLUGIN, TEST_URLS, TEST_USERS } from '@tests/constants';

/**
 * WordPress helper utilities for Playwright tests
 */

/**
 * Log in to WordPress admin
 */

async function completeFirstRunSetupIfNeeded(page: Page): Promise<void> {
  const continueButton = page.getByRole('button', { name: 'Continue' });
  const hasContinueButton = await continueButton
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (hasContinueButton) {
    await continueButton.click();
    await page.waitForLoadState('domcontentloaded');
  }

  const installTitle = page.locator('input#weblog_title');
  const hasInstallForm = await installTitle
    .isVisible({ timeout: 1000 })
    .catch(() => false);
  if (hasInstallForm) {
    await installTitle.fill('TestTag Screenshot Tests');
    await page.fill('input#user_login', TEST_USERS.ADMIN.username);
    await page.fill('input#admin_email', TEST_USERS.ADMIN.email);

    const passwordField = await page.$('input#pass1-text, input#pass1');
    if (passwordField) {
      await passwordField.fill('password');
    }

    const weakPasswordConfirm = await page.$('input#pw-weak');
    if (weakPasswordConfirm) {
      await weakPasswordConfirm.check();
    }

    await page.click('input#submit, button#submit');
    await page.waitForLoadState('domcontentloaded');
  }
}

export async function loginToWordPress(
  page: Page,
  username: string = TEST_USERS.ADMIN.username,
  password: string = TEST_USERS.ADMIN.password
): Promise<void> {
  // Navigate to login page with increased timeout for slow Docker startup
  await page.goto(TEST_URLS.LOGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });

  // A fresh container can show WordPress install pages before login exists.
  for (let i = 0; i < 3; i++) {
    const hasLoginField = await page.$('input[name="log"]');
    if (hasLoginField) {
      break;
    }

    await completeFirstRunSetupIfNeeded(page);

    const loginAfterSetup = await page.$('input[name="log"]');
    if (loginAfterSetup) {
      break;
    }

    await page.goto(TEST_URLS.LOGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }

  // Return to login page after first-run setup.
  if (!page.url().includes(TEST_URLS.LOGIN)) {
    await page.goto(TEST_URLS.LOGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
  }
  
  // Wait for login form with generous timeout
  await page.waitForSelector('input[name="log"]', { timeout: 30000 });
  
  // Fill in credentials
  await page.fill('input[name="log"]', username);
  await page.fill('input[name="pwd"]', password);
  
  // Click login
  await page.click('input[type="submit"]');
  
  // Wait for dashboard to load
  await page.waitForURL(/\/wp-admin\//, { timeout: 30000 });
  await page.waitForLoadState('networkidle');

  // Ensure plugin is active in case this is a fresh installation.
  await page.goto(TEST_URLS.PLUGINS);
  const activateLink = page
    .locator(`${TESTTAG_PLUGIN.rowSelector} a[href*="action=activate"]`)
    .first();
  if (await activateLink.count()) {
    await activateLink.click();
    await page.waitForLoadState('networkidle');
  }
}

/**
 * Navigate to WordPress admin dashboard
 */
export async function goToDashboard(page: Page): Promise<void> {
  await page.goto(TEST_URLS.ADMIN_HOME);
  await page.waitForLoadState('networkidle');
}

/**
 * Navigate to TestTag settings page
 */
export async function goToTestTagSettings(page: Page): Promise<void> {
  await page.goto(TEST_URLS.TESTTAG_SETTINGS);
  await page.waitForLoadState('networkidle');
}


/**
 * Enable audit mode on frontend
 */
export async function enableAuditMode(page: Page): Promise<void> {
  // Keyboard shortcut: Alt+Shift+T
  await page.keyboard.press('Alt+Shift+T');
  await page.locator('#testtag-audit-legend').waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Disable audit mode on frontend
 */
export async function disableAuditMode(page: Page): Promise<void> {
  // Keyboard shortcut: Alt+Shift+T
  await page.keyboard.press('Alt+Shift+T');
  await page.locator('#testtag-audit-legend').waitFor({ state: 'hidden', timeout: 5000 });
}

/**
 * Navigate to a frontend page
 */
export async function goToFrontendPage(
  page: Page,
  pagePath: string = TEST_URLS.FRONTEND_HOME
): Promise<void> {
  await page.goto(pagePath);
  await page.waitForLoadState('networkidle');
}

/**
 * Wait for a specific element to have test attributes
 */
export async function waitForTestAttribute(
  page: Page,
  selector: string,
  attribute: string = 'data-testid'
): Promise<void> {
  await page.waitForFunction(
    ({ selector, attribute }) => {
      const element = document.querySelector(selector);
      return element && element.hasAttribute(attribute);
    },
    { selector, attribute },
    { timeout: 5000 }
  );
}
