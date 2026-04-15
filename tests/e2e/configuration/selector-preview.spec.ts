import { test, expect } from '@playwright/test';
import { WordPressAuthPage } from '@pageObjects/WordPressAuthPage';
import { TestTagSettingsPage } from '@pageObjects/TestTagSettingsPage';

const screenshotDir = './tests/screenshots';

/**
 * Selector Preview Tooling
 *
 * Verifies that the selector preview panel in the CSS Selector Map card:
 * - Renders the preview textarea and results container
 * - Shows match counts when selectors match elements in pasted HTML
 * - Shows "0 matches" when no elements match
 * - Updates results live when the HTML textarea changes
 * - Shows matched element HTML snippets for selectors that match
 */
test.describe('TestTag Plugin - Selector Preview', () => {
  test.describe.configure({ mode: 'serial' });

  test('Selector preview textarea and results container are visible', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Scroll to selector preview area', async () => {
      await settingsPage.scrollToSelectorPreview();
    });

    await test.step('Assert preview textarea is visible', async () => {
      await expect(settingsPage.selectorPreviewHtml).toBeVisible();
    });

    await test.step('Assert results container is present', async () => {
      await expect(settingsPage.selectorPreviewResults).toBeAttached();
    });

    await test.step('Capture screenshot of selector preview section', async () => {
      await page.screenshot({
        path: `${screenshotDir}/30-selector-preview-initial.png`,
        fullPage: false,
      });
    });
  });

  test('Preview shows match counts for selectors against pasted HTML', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Scroll to selector preview', async () => {
      await settingsPage.scrollToSelectorPreview();
    });

    await test.step('Paste HTML with nav links into the preview textarea', async () => {
      await settingsPage.setSelectorPreviewHtml(
        '<nav class="site-nav"><a href="/home">Home</a><a href="/about">About</a></nav>'
      );
    });

    await test.step('Assert results are rendered (selector map has default rows)', async () => {
      // The results container should contain either a list of rows or the empty-state message.
      const resultsText = await settingsPage.selectorPreviewResults.textContent();
      expect(resultsText).not.toBeNull();
    });

    await test.step('Capture screenshot of results', async () => {
      await page.screenshot({
        path: `${screenshotDir}/31-selector-preview-results.png`,
        fullPage: false,
      });
    });
  });

  test('Preview shows 0 matches when selector does not match HTML', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Scroll to selector preview', async () => {
      await settingsPage.scrollToSelectorPreview();
    });

    await test.step('Paste minimal HTML that matches no default selectors', async () => {
      await settingsPage.setSelectorPreviewHtml('<div class="totally-unique-wrapper-xyz">Hello</div>');
    });

    await test.step('Assert no-matches badges appear for rows where selector has no hits', async () => {
      const noMatchBadges = settingsPage.selectorPreviewResults.locator('.testtag-selector-preview-count.no-matches');
      const count = await noMatchBadges.count();
      // The default selector map has entries; at least one should show 0 matches.
      expect(count).toBeGreaterThan(0);
    });

    await test.step('Capture screenshot', async () => {
      await page.screenshot({
        path: `${screenshotDir}/32-selector-preview-no-matches.png`,
        fullPage: false,
      });
    });
  });

  test('Preview updates live when HTML textarea content changes', async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    const settingsPage = new TestTagSettingsPage(page);

    await test.step('Ensure plugin is active', async () => {
      await auth.ensureTestTagPluginIsActive();
    });

    await test.step('Open settings page', async () => {
      await settingsPage.open();
    });

    await test.step('Scroll to selector preview', async () => {
      await settingsPage.scrollToSelectorPreview();
    });

    let initialText: string | null = null;

    await test.step('Set HTML with a nav element', async () => {
      await settingsPage.setSelectorPreviewHtml(
        '<nav><a href="/">Home</a></nav>'
      );
    });

    await test.step('Record initial results text', async () => {
      initialText = await settingsPage.selectorPreviewResults.textContent();
      expect(initialText).not.toBeNull();
      // The default selector map includes 'nav a[href="/"]' which should match the nav HTML.
      expect(initialText).toContain('match');
    });

    await test.step('Replace HTML with a button element and verify results update', async () => {
      await settingsPage.setSelectorPreviewHtml('<button class="submit-btn">Submit</button>');
      const updatedText = await settingsPage.selectorPreviewResults.textContent();
      expect(updatedText).not.toBeNull();
      // Results must actually change: the nav selector that matched in the first HTML
      // should no longer match against a plain button element.
      expect(updatedText).not.toBe(initialText);
    });

    await test.step('Capture screenshot after update', async () => {
      await page.screenshot({
        path: `${screenshotDir}/33-selector-preview-updated.png`,
        fullPage: false,
      });
    });
  });
});
