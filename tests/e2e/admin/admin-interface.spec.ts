import { test } from '@playwright/test';
import { WordPressAuthPage } from '@pageObjects/WordPressAuthPage';
import { TestTagSettingsPage } from '@pageObjects/TestTagSettingsPage';
import { PluginsAdminPage } from '@pageObjects/PluginsAdminPage';

const screenshotDir = './tests/screenshots';

test.describe('TestTag Plugin - Admin Interface', () => {
  test('Settings page', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Capture full-page screenshot', async () => {
      await page.screenshot({
        path: `${screenshotDir}/01-settings-page.png`,
        fullPage: true,
      });
    });
  });

  test('Attribute key section', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Scroll attribute key field into view', async () => {
      await settingsPage.scrollToAttributeConfiguration();
    });

    await test.step('Capture viewport screenshot of attribute key section', async () => {
      await page.screenshot({
        path: `${screenshotDir}/02-attribute-key-section.png`,
        fullPage: false,
      });
    });
  });

  test('CSS Selector Map section', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Scroll CSS Selector Map heading into view', async () => {
      await settingsPage.scrollToCssSelectorMap();
    });

    await test.step('Capture viewport screenshot of CSS Selector Map section', async () => {
      await page.screenshot({
        path: `${screenshotDir}/03-css-selector-map.png`,
        fullPage: false,
      });
    });
  });

  test('Plugins admin page is tagged', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const pluginsPage = new PluginsAdminPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open plugins admin page', async () => {
      await pluginsPage.open();
    });

    await test.step('Assert at least one tagged element is visible', async () => {
      await pluginsPage.expectTaggingToBeActive();
    });

    await test.step('Capture full-page screenshot', async () => {
      await page.screenshot({
        path: `${screenshotDir}/04-plugins-admin-page.png`,
        fullPage: true,
      });
    });
  });
});
