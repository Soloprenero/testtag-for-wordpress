/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { test } from '@playwright/test';
import { WordPressAuthPage } from '@pageObjects/WordPressAuthPage';
import { TestTagSettingsPage } from '@pageObjects/TestTagSettingsPage';

const screenshotDir = './tests/screenshots';

test.describe('Test ID Auto Injector Plugin - Configuration', () => {
  test('Alternative attribute key (data-cy)', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Select data-cy as attribute key', async () => {
      await settingsPage.setAttributeKey('data-cy');
    });

    await test.step('Save settings', async () => {
      await settingsPage.saveSettings();
    });

    await test.step('Capture full-page screenshot after save', async () => {
      await page.screenshot({
        path: `${screenshotDir}/10-attribute-key-data-cy.png`,
        fullPage: true,
      });
    });
  });
});
