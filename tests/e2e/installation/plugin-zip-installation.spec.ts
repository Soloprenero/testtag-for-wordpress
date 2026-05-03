/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { WordPressAuthPage } from '@pageObjects/WordPressAuthPage';
import { TESTTAG_PLUGIN, TEST_URLS, TEST_USERS } from '@tests/constants';

const ZIP_PATH = path.resolve(process.cwd(), 'dist', 'test-id-auto-injector.zip');

/**
 * Plugin Zip Installation
 *
 * Verifies that the plugin zip produced by the release build can be uploaded
 * through the WordPress "Upload Plugin" admin UI, installed, and activated on
 * a blank WordPress site that has no prior knowledge of the plugin.
 *
 * This test is intentionally self-contained: it performs its own login and
 * does NOT rely on any prior plugin activation, fixture pages, or settings.
 */
test.describe('Plugin Zip Installation', () => {
  test('Plugin installs and activates successfully from zip upload', async ({ page }) => {
    const auth = new WordPressAuthPage(page);

    await test.step('Install WordPress and log in as admin', async () => {
      await auth.ensureInstalledAndLogin(TEST_USERS.ADMIN.username, TEST_USERS.ADMIN.password);
    });

    await test.step('Navigate to the plugin upload page', async () => {
      await page.goto('/wp-admin/plugin-install.php?tab=upload', {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });
      await page.waitForLoadState('networkidle');
    });

    await test.step('Upload the plugin zip file', async () => {
      const fileInput = page.locator('input[type="file"][name="pluginzip"]');
      await expect(fileInput).toBeAttached({ timeout: 10000 });
      await fileInput.setInputFiles(ZIP_PATH);
    });

    await test.step('Submit the installation form', async () => {
      const submitButton = page.locator('#install-plugin-submit');
      await expect(submitButton).toBeEnabled({ timeout: 10000 });
      await submitButton.click();
      await page.waitForLoadState('networkidle', { timeout: 60000 });
    });

    await test.step('Verify plugin installed successfully', async () => {
      // WordPress shows "Plugin installed successfully." on the install result page.
      await expect(page.locator('.wrap')).toContainText(/installed successfully/i, {
        timeout: 30000,
      });
    });

    await test.step('Activate the plugin', async () => {
      const activateLink = page
        .locator('a')
        .filter({ hasText: /activate plugin/i })
        .first();
      await expect(activateLink).toBeVisible({ timeout: 10000 });
      await activateLink.click();
      await page.waitForLoadState('networkidle', { timeout: 30000 });
    });

    await test.step('Verify plugin is active in the plugins list', async () => {
      // WordPress redirects to plugins.php after activation.
      await expect(page).toHaveURL(/plugins\.php/, { timeout: 15000 });

      const pluginRow = page.locator(TESTTAG_PLUGIN.rowSelector);
      await expect(pluginRow).toBeVisible();

      // A "Deactivate" link confirms the plugin is now active.
      const deactivateLink = pluginRow.locator('a[href*="action=deactivate"]');
      await expect(deactivateLink).toBeVisible();
    });

    await test.step('Verify the plugin settings page is accessible', async () => {
      await page.goto(TEST_URLS.TESTTAG_SETTINGS, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForLoadState('networkidle');

      // The settings page always renders its title as the sole h1 inside .testtag-wrap.
      const heading = page.locator('.testtag-wrap h1');
      await expect(heading).toBeVisible();
    });

    await test.step('Verify the plugin is tagging elements on an admin page', async () => {
      await page.goto(TEST_URLS.PLUGINS, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      });
      await page.waitForLoadState('networkidle');

      // At least one element should carry a test attribute once the plugin is active.
      const taggedElements = page.locator('[data-testid], [data-cy], [data-test]');
      await expect(taggedElements.first()).toBeVisible({ timeout: 10000 });
    });
  });
});
