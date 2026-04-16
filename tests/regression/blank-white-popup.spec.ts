/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { test, expect } from '@playwright/test';
import { WordPressAuthPage } from '@pageObjects/WordPressAuthPage';

/**
 * Regression: blank white popup on admin pages
 *
 * PHP's DOMDocument (libxml) mangles <script type="text/html"> template
 * content, causing Backbone.js / Underscore.js media-library elements to
 * escape into <body> and render as visible HTML.  The fix in
 * TestTag_HTML_Processor::process_html() stashes those script blocks before
 * passing the page to DOMDocument and restores them afterwards.
 *
 * @see includes/class-testtag-html-processor.php
 */
test.describe('Regression: no blank white popup on admin pages', () => {
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
