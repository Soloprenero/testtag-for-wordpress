/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { test, expect } from '@playwright/test';
import { WordPressAuthPage } from '@pageObjects/WordPressAuthPage';
import { TestTagSettingsPage } from '@pageObjects/TestTagSettingsPage';

const screenshotDir = './tests/screenshots';

/**
 * Selector Validation
 *
 * Verifies that the CSS Selector Map settings UI:
 * - Flags unsupported CSS patterns with inline error messages.
 * - Provides guidance text about supported and unsupported patterns.
 * - Blocks form submission when any selector has an unsupported pattern.
 * - Allows saving when all selectors are valid.
 */
test.describe('Test ID Auto Injector Plugin - Selector Validation', () => {
  test.describe.configure({ mode: 'serial' });

  test('Guidance text is visible in the CSS Selector Map section', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Scroll to the CSS Selector Map section', async () => {
      await settingsPage.scrollToCssSelectorMap();
    });

    await test.step('Assert guidance summary is present', async () => {
      const summary = page.locator('.testtag-selector-help summary');
      await expect(summary).toBeVisible();
      await expect(summary).toContainText(/supported.*unsupported/i);
    });

    await test.step('Open guidance details and verify content', async () => {
      await page.locator('.testtag-selector-help summary').click();
      const helpBody = page.locator('.testtag-selector-help-body');
      await expect(helpBody).toBeVisible();
      await expect(helpBody).toContainText(':has()');
      await expect(helpBody).toContainText(':is()');
    });

    await test.step('Capture screenshot of guidance section', async () => {
      await page.screenshot({
        path: `${screenshotDir}/15-selector-validation-guidance.png`,
        fullPage: false,
      });
    });
  });

  test(':has() selector shows an inline error message', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Add a row with an unsupported :has() selector', async () => {
      await settingsPage.addSelectorMapRow('div:has(.child)', 'div-with-child');
    });

    await test.step('Assert inline error message is shown for :has()', async () => {
      const msg = await settingsPage.getLastRowSelectorMessage();
      expect(msg).toBeTruthy();
      expect(msg).toMatch(/:has\(\)/i);
    });

    await test.step('Capture screenshot of inline error state', async () => {
      await page.screenshot({
        path: `${screenshotDir}/16-selector-validation-has-error.png`,
        fullPage: false,
      });
    });
  });

  test('Sibling combinator selector shows an inline error message', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Add a row with an unsupported sibling combinator selector', async () => {
      await settingsPage.addSelectorMapRow('h2 + p', 'heading-next-para');
    });

    await test.step('Assert inline error message mentions sibling combinators', async () => {
      const msg = await settingsPage.getLastRowSelectorMessage();
      expect(msg).toBeTruthy();
      expect(msg).toMatch(/sibling/i);
    });
  });

  test('Save is blocked when a selector with an unsupported pattern is present', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Add a row with :is() — an unsupported pattern', async () => {
      await settingsPage.addSelectorMapRow('nav :is(a, button)', 'nav-interactive');
    });

    await test.step('Attempt to save and assert navigation did NOT happen (save blocked)', async () => {
      const currentUrl = page.url();
      await settingsPage.saveButton.click();
      // Give the page a brief moment; a blocked submit should keep us on the same URL.
      await page.waitForTimeout(600);
      expect(page.url()).toBe(currentUrl);
    });

    await test.step('Assert a save-blocked banner is visible', async () => {
      const banner = page.locator('#testtag-selector-save-error');
      await expect(banner).toBeVisible();
      await expect(banner).toContainText(/save blocked/i);
    });

    await test.step('Capture screenshot of blocked-save state', async () => {
      await page.screenshot({
        path: `${screenshotDir}/17-selector-validation-save-blocked.png`,
        fullPage: false,
      });
    });
  });

  test('Valid selectors pass validation without error messages', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Add a row with a supported selector', async () => {
      await settingsPage.addSelectorMapRow('nav > a.active', 'nav-active-link');
    });

    await test.step('Assert no error message is shown', async () => {
      const msg = await settingsPage.getLastRowSelectorMessage();
      expect(msg).toBeNull();
    });
  });
});
