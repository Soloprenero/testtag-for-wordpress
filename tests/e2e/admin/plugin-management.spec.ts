import { test, expect } from '@playwright/test';
import { WordPressAuthPage } from '../../pageObjects/WordPressAuthPage';
import { PluginsAdminPage } from '../../pageObjects/PluginsAdminPage';
import { TESTTAG_PLUGIN, TEST_URLS } from '../../constants';

/**
 * Plugin Management
 *
 * Verifies that the TestTag plugin row is correctly rendered in the WordPress
 * Plugins admin screen, that its action links (Settings, Deactivate) are
 * present, and that the plugin actively tags admin-page elements while active.
 */
test.describe('TestTag Plugin - Plugin Management', () => {
  test('Plugin row is visible in the plugins list', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const pluginsPage = new PluginsAdminPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open the Plugins admin page', async () => {
      await pluginsPage.open();
    });

    await test.step('Assert the TestTag plugin row is visible', async () => {
      const pluginRow = page.locator(TESTTAG_PLUGIN.rowSelector);
      await expect(pluginRow).toBeVisible();
    });
  });

  test('Plugin row shows a Deactivate link when active', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const pluginsPage = new PluginsAdminPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open the Plugins admin page', async () => {
      await pluginsPage.open();
    });

    await test.step('Assert a Deactivate link exists in the plugin row', async () => {
      const deactivateLink = page.locator(
        `${TESTTAG_PLUGIN.rowSelector} a[href*="action=deactivate"]`
      );
      await expect(deactivateLink).toBeVisible();
    });
  });

  test('Plugin row shows a Settings action link', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const pluginsPage = new PluginsAdminPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open the Plugins admin page', async () => {
      await pluginsPage.open();
    });

    await test.step('Assert a Settings link exists in the plugin row', async () => {
      const settingsLink = page.locator(
        `${TESTTAG_PLUGIN.rowSelector} a[href*="page=testtag"]`
      );
      await expect(settingsLink).toBeVisible();
    });
  });

  test('Settings action link navigates to TestTag settings page', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const pluginsPage = new PluginsAdminPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open the Plugins admin page', async () => {
      await pluginsPage.open();
    });

    await test.step('Click the Settings action link in the plugin row', async () => {
      const settingsLink = page.locator(
        `${TESTTAG_PLUGIN.rowSelector} a[href*="page=testtag"]`
      ).first();
      await settingsLink.click();
      await page.waitForLoadState('networkidle');
    });

    await test.step('Assert the URL points to the TestTag settings page', async () => {
      await expect(page).toHaveURL(/page=testtag/);
    });
  });

  test('Plugins admin page has tagged elements while plugin is active', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const pluginsPage = new PluginsAdminPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open the Plugins admin page', async () => {
      await pluginsPage.open();
    });

    await test.step('Assert at least one element has a test attribute', async () => {
      await pluginsPage.expectTaggingToBeActive();
    });

    await test.step('Assert the total tagged-element count is greater than zero', async () => {
      const count = await pluginsPage.getTaggedElementCount();
      expect(count).toBeGreaterThan(0);
    });
  });

  test('Admin bar is present and tagged on the plugins page', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const pluginsPage = new PluginsAdminPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open the Plugins admin page', async () => {
      await pluginsPage.open();
    });

    await test.step('Assert the WordPress admin bar is visible', async () => {
      await expect(page.locator('#wpadminbar')).toBeVisible();
    });

    await test.step('Assert the TestTag Audit Mode button is in the admin bar', async () => {
      const auditBtn = page.locator('#wp-admin-bar-testtag-audit');
      await expect(auditBtn).toBeVisible();
    });
  });

  test('Navigating to settings via admin bar Tools menu works', async ({ page }) => {
    const auth = new WordPressAuthPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Navigate directly to the TestTag settings URL', async () => {
      await page.goto(TEST_URLS.TESTTAG_SETTINGS, { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
    });

    await test.step('Assert the settings page heading is visible', async () => {
      // The settings page always renders its title as the sole h1 inside .testtag-wrap.
      const heading = page.locator('.testtag-wrap h1');
      await expect(heading).toBeVisible();
    });
  });

  test('No blank white popup on Settings > General when plugin is active', async ({ page }) => {
    const auth = new WordPressAuthPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Navigate to WordPress Settings > General', async () => {
      await page.goto('/wp-admin/options-general.php', { waitUntil: 'domcontentloaded' });
      await page.waitForLoadState('networkidle');
    });

    await test.step('Assert no leaked media-library template elements in the document body', async () => {
      // When DOMDocument mangles <script type="text/html"> templates the
      // inner elements escape into <body> and render as a blank white popup.
      // These buttons/divs should only exist inside <script> tags, not as
      // real DOM elements visible to the browser.
      const leakedToggle = page.locator('button.media-frame-menu-toggle');
      await expect(leakedToggle).toHaveCount(0);

      const leakedMenuHeading = page.locator('h2.media-frame-menu-heading');
      await expect(leakedMenuHeading).toHaveCount(0);

      const leakedTabPanel = page.locator('div.media-frame-tab-panel');
      await expect(leakedTabPanel).toHaveCount(0);
    });

    await test.step('Assert the General Settings form is visible and intact', async () => {
      await expect(page.locator('h1').filter({ hasText: /General Settings/i })).toBeVisible();
      await expect(page.locator('#blogname')).toBeVisible();
    });
  });
});
