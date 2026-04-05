import { test } from '@playwright/test';
import { WordPressAuthPage } from '../../pageObjects/WordPressAuthPage';
import { TestTagSettingsPage } from '../../pageObjects/TestTagSettingsPage';
import { PluginsAdminPage } from '../../pageObjects/PluginsAdminPage';

const screenshotDir = './tests/screenshots';

test.describe('TestTag Plugin - Admin Interface', () => {
  test('Settings page', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await auth.ensureTestTagPluginIsActive();
    await settingsPage.open();

    await page.screenshot({
      path: `${screenshotDir}/01-settings-page.png`,
      fullPage: true,
    });
  });

  test('Attribute key section', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await auth.ensureTestTagPluginIsActive();
    await settingsPage.open();
    await settingsPage.scrollToAttributeConfiguration();

    await page.screenshot({
      path: `${screenshotDir}/02-attribute-key-section.png`,
      fullPage: false,
    });
  });

  test('CSS Selector Map section', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await auth.ensureTestTagPluginIsActive();
    await settingsPage.open();
    await settingsPage.scrollToCssSelectorMap();

    await page.screenshot({
      path: `${screenshotDir}/03-css-selector-map.png`,
      fullPage: false,
    });
  });

  test('Plugins admin page is tagged', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const pluginsPage = new PluginsAdminPage(page);

    await auth.ensureTestTagPluginIsActive();
    await pluginsPage.open();
    await pluginsPage.expectTaggingToBeActive();

    await page.screenshot({
      path: `${screenshotDir}/04-plugins-admin-page.png`,
      fullPage: true,
    });
  });
});
