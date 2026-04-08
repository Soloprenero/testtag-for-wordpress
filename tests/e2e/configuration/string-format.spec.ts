import { test, expect, type Page } from '@playwright/test';
import { WordPressAuthPage } from '../../pageObjects/WordPressAuthPage';
import { TestTagSettingsPage } from '../../pageObjects/TestTagSettingsPage';
import { TEST_URLS } from '../../constants';

const ATTR  = 'data-testid';
const LAYER = 'data-testtag-layer';

let sentinelCounter = 0;

async function injectAndGetTag(page: Page, outerHtml: string): Promise<string | null> {
  const sentinelAttr = 'data-sf-sentinel';
  const sentinelVal  = `sf-${++sentinelCounter}`;

  await page.evaluate(
    ({ html, attr, val }: { html: string; attr: string; val: string }) => {
      const wrap = document.createElement('div');
      wrap.innerHTML = html;
      const el = wrap.firstElementChild as HTMLElement;
      if (el) {
        el.setAttribute(attr, val);
        document.body.appendChild(el);
      }
    },
    { html: outerHtml, attr: sentinelAttr, val: sentinelVal }
  );

  const locator = page.locator(`[${sentinelAttr}="${sentinelVal}"][${LAYER}="dynamic"]`);
  try {
    await locator.waitFor({ state: 'attached', timeout: 5000 });
    return locator.getAttribute(ATTR);
  } catch {
    return page.locator(`[${sentinelAttr}="${sentinelVal}"]`).getAttribute(ATTR);
  }
}

test.describe('String format configuration', () => {
  test.beforeEach(async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    await auth.ensureTestTagPluginIsActive();
  });

  // -- Separator (default / non-customized format mode) ---
  // In default mode the global separator governs BOTH word boundaries inside
  // slugs AND the gap between adjacent tokens (type <-> identifier).

  test.describe('Separator', () => {
    test.beforeEach(async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      // No tokenOrder -> default mode; separator drives both gaps and word boundaries.
      await settings.setStringFormat({ separator: '_' });
      await settings.saveSettings();
    });

    test.afterEach(async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.restoreDefaultStringFormat();
    });

    test('underscore separator applies to token gaps and word boundaries in default format mode -- JS', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      // token gap uses '_' in default mode, not just word boundaries
      expect(jsTag).toBe('button_subscribe_newsletter');
    });

    test('PHP<->JS parity: underscore separator in default format mode', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="button_subscribe_newsletter"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('button_subscribe_newsletter');
    });

    test('PHP<->JS parity: underscore separator -- heading with multi-word id', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="heading_parity_features_heading"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<h3 id="parity-features-heading">Our Features</h3>');
      expect(jsTag).toBe('heading_parity_features_heading');
    });
  });

  // -- Separator vs. format customization ---
  // When the user explicitly saves a token order the format is "customized".
  // In customized mode the global separator governs only word boundaries;
  // per-gap separators control the gap between tokens.
  // Resetting the format to default restores separator-driven gaps.

  test.describe('Separator vs. format customization', () => {
    test.afterEach(async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.restoreDefaultStringFormat();
    });

    test('separator does not affect token gap when format is explicitly customized -- JS', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      // hyphen token gap, underscore word boundary
      await settings.setStringFormat({ tokenOrder: 'type,identifier', formatSeps: '-', separator: '_' });
      await settings.saveSettings();
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      // gap = '-' (explicit formatSeps), word boundaries = '_' (global sep)
      expect(jsTag).toBe('button-subscribe_newsletter');
    });

    test('PHP<->JS parity: separator does not affect token gap when format is explicitly customized', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'type,identifier', formatSeps: '-', separator: '_' });
      await settings.saveSettings();
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="button-subscribe_newsletter"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('button-subscribe_newsletter');
    });

    test('separator applies to token gap again after format is reset to default -- JS', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      // Step 1: save customized format (hyphen token gap, underscore word boundary).
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'type,identifier', formatSeps: '-', separator: '_' });
      await settings.saveSettings();
      // Step 2: reset to default (empty tokenOrder = not customized). Keep separator '_'.
      await settings.open();
      await settings.setStringFormat({ separator: '_', tokenOrder: '', formatSeps: '' });
      await settings.saveSettings();
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      // Back in default mode: '_' governs both token gap and word boundaries.
      expect(jsTag).toBe('button_subscribe_newsletter');
    });
  });

  // -- Token order ---

  test.describe('Token order', () => {
    test.afterEach(async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.restoreDefaultStringFormat();
    });

    test('identifier-only token order removes type prefix in JS-generated tags', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'identifier', formatSeps: '' });
      await settings.saveSettings();
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('subscribe-newsletter');
    });

    test('PHP<->JS parity: identifier-only token order', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'identifier', formatSeps: '' });
      await settings.saveSettings();
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="subscribe-newsletter"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('subscribe-newsletter');
    });

    test('type-suffix order (identifier,type) produces type after identifier in JS', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'identifier,type', formatSeps: '-' });
      await settings.saveSettings();
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('subscribe-newsletter-button');
    });

    test('PHP<->JS parity: type-suffix order', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'identifier,type', formatSeps: '-' });
      await settings.saveSettings();
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="subscribe-newsletter-button"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('subscribe-newsletter-button');
    });
  });

  // -- Per-gap separator ---
  // Per-gap separators are only active when the format is explicitly customized.
  // The global separator controls word boundaries; per-gap seps control token gaps.

  test.describe('Per-gap separator', () => {
    test.beforeEach(async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      // Explicitly customize: underscore token gap, hyphen word boundaries (global sep default '-').
      await settings.setStringFormat({ tokenOrder: 'type,identifier', formatSeps: '_' });
      await settings.saveSettings();
    });

    test.afterEach(async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.restoreDefaultStringFormat();
    });

    test('underscore per-gap separator between type and identifier -- JS', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button id="checkout-btn" type="button">Pay</button>');
      // gap = '_' (per-gap sep), word boundaries = '-' (global sep)
      expect(jsTag).toBe('button_checkout-btn');
    });

    test('PHP<->JS parity: underscore per-gap separator', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="button_parity-checkout-btn"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<button id="parity-checkout-btn" type="button">Pay Now</button>');
      expect(jsTag).toBe('button_parity-checkout-btn');
    });

    test('global separator does not override explicit per-gap separator', async ({ page }) => {
      // Change global sep to '-' while per-gap sep from beforeEach is '_'.
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ separator: '-' });
      await settings.saveSettings();
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button id="parity-checkout-btn" type="button">Pay Now</button>');
      // gap = '_' (explicit formatSeps survives), word boundaries = '-' (global sep)
      expect(jsTag).toBe('button_parity-checkout-btn');
    });
  });

  // -- Live HTML preview ---

  test.describe('Live HTML preview', () => {
    test.beforeEach(async ({ page }) => {
      // Ensure default (non-customized) format mode for predictable preview assertions.
      const settings = new TestTagSettingsPage(page);
      await settings.restoreDefaultStringFormat();
    });

    test('preview textarea is visible and pre-populated with sample HTML', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      const previewHtml = page.locator('#testtag-format-preview-html');
      await expect(previewHtml).toBeVisible();
      const content = await previewHtml.inputValue();
      expect(content.trim()).toContain('<input');
    });

    test('preview result value is shown on page load', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      const previewValue = page.locator('#testtag-format-preview-value');
      await expect(previewValue).toBeVisible();
      const result = await previewValue.textContent();
      expect(result?.trim()).toBeTruthy();
    });

    test('preview result updates when HTML textarea content changes', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      const previewHtml  = page.locator('#testtag-format-preview-html');
      const previewValue = page.locator('#testtag-format-preview-value');
      await previewHtml.fill('<input aria-label="Search query" placeholder="Search..." />');
      await previewHtml.dispatchEvent('input');
      await expect(previewValue).toContainText('search-query', { timeout: 2000 });
    });

    test('preview reflects separator change including the token gap in default format mode', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      const previewHtml  = page.locator('#testtag-format-preview-html');
      const previewValue = page.locator('#testtag-format-preview-value');
      const separatorSel = page.locator('#testtag-separator');
      // h2 aria-label produces heading (type) + about-us-section (identifier),
      // clearly showing both the token gap and word-boundary separator.
      await previewHtml.fill('<h2 aria-label="About Us Section">About</h2>');
      await previewHtml.dispatchEvent('input');
      // Default mode, '-': token gap AND word boundaries both use '-'.
      await expect(previewValue).toHaveText('heading-about-us-section', { timeout: 2000 });
      // Switch to '_': in default mode both the gap AND word boundaries must change.
      await separatorSel.selectOption('_');
      await separatorSel.dispatchEvent('change');
      await expect(previewValue).toHaveText('heading_about_us_section', { timeout: 2000 });
    });

    test('preview token gap does not change when separator changes in explicitly customized format', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'type,identifier', formatSeps: '-' });
      await settings.saveSettings();
      // Re-open in customized mode.
      await settings.open();
      const previewHtml  = page.locator('#testtag-format-preview-html');
      const previewValue = page.locator('#testtag-format-preview-value');
      const separatorSel = page.locator('#testtag-separator');
      await previewHtml.fill('<h2 aria-label="About Us Section">About</h2>');
      await previewHtml.dispatchEvent('input');
      // Customized, '-' global sep: gap='-', word boundaries='-'.
      await expect(previewValue).toHaveText('heading-about-us-section', { timeout: 2000 });
      // Switch global sep to '_': only word boundaries change, gap stays '-'.
      await separatorSel.selectOption('_');
      await separatorSel.dispatchEvent('change');
      await expect(previewValue).toHaveText('heading-about_us_section', { timeout: 2000 });
      // Restore default before afterEach.
      await settings.setStringFormat({ separator: '-', tokenOrder: '', formatSeps: '' });
      await settings.saveSettings();
    });
  });
});
