import { test } from '@playwright/test';
import { WordPressAuthPage } from '../../pageObjects/WordPressAuthPage';
import { TestTagSettingsPage } from '../../pageObjects/TestTagSettingsPage';

const screenshotDir = './tests/screenshots';

test.describe('TestTag Plugin - Configuration', () => {
  test('Alternative attribute key (data-cy)', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await auth.ensureTestTagPluginIsActive();
    await settingsPage.open();
    await settingsPage.setAttributeKey('data-cy');
    await settingsPage.saveSettings();

    await page.screenshot({
      path: `${screenshotDir}/10-attribute-key-data-cy.png`,
      fullPage: true,
    });
  });
});
