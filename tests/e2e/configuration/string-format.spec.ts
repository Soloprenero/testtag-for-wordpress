import { test, expect, type Page } from '@playwright/test';
import { TestTagSettingsPage, type StringFormatOptions } from '../../pageObjects/TestTagSettingsPage';
import { WordPressRestClient } from '../../helpers/wp-api';
import { TEST_URLS, TEST_USERS, TESTTAG_PLUGIN } from '../../constants';

const ATTR  = 'data-testid';
const LAYER = 'data-testtag-layer';

const TEST_BASE_URL = (
  process.env.TEST_URL || `http://localhost:${(process.env.WORDPRESS_PORT || '8080').trim() || '8080'}`
).trim();

// ── Helpers ───────────────────────────────────────────────────────────────────

// Serial mode means all tests in this file run on a single worker, so a
// module-level counter is safe.
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

/**
 * Create a short-lived authenticated REST client, run the callback, then
 * dispose.  Used by beforeAll/afterAll hooks which cannot receive test-scoped
 * Playwright fixtures.
 */
async function withApiClient<T>(fn: (client: WordPressRestClient) => Promise<T>): Promise<T> {
  const client = new WordPressRestClient(TEST_BASE_URL);
  await client.init(TEST_USERS.ADMIN.username, TEST_USERS.ADMIN.password);
  try {
    return await fn(client);
  } finally {
    await client.dispose();
  }
}

/**
 * Apply string-format settings via the WordPress REST API (no browser needed).
 * Relies on the format options being registered with show_in_rest: true in PHP.
 */
async function 
 applySettings(options: StringFormatOptions): Promise<void> {
  await withApiClient(client =>
    client.setTestTagFormatSettings({
      separator:  options.separator,
      tokenOrder: options.tokenOrder,
      formatSeps: options.formatSeps,
    })
  );
}

/**
 * Reset all TestTag string-format options to factory defaults via REST API.
 * Called in afterAll of every suite that mutates settings so that suites are
 * fully isolated from one another.
 */
async function restoreDefaults(): Promise<void> {
  await withApiClient(client => client.resetTestTagFormatSettings());
}

// ── Suite ─────────────────────────────────────────────────────────────────────
//
// Serial mode is applied to the outer describe so that suites that alter
// WordPress settings never overlap.  Tests WITHIN each suite do not modify
// settings — they share the configuration applied once by that suite's
// beforeAll — and are therefore structurally safe for parallel execution
// should a future runner support sequential-group / parallel-member semantics.

test.describe('String format configuration', () => {
  test.describe.configure({ mode: 'serial' });

  test.beforeAll(async () => {
    await withApiClient(async client => {
      try {
        await client.activatePlugin(TESTTAG_PLUGIN.slug);
      } catch {
        // Some environments don't expose the plugins REST endpoint; carry on.
      }
    });
  });

  // ── Separator (default / non-customized format mode) ──────────────────────
  //
  // In default mode the global separator governs BOTH word boundaries inside
  // slugs AND the gap between adjacent tokens (type <-> identifier).

  test.describe('Separator: "_" in default format mode', () => {
    test.beforeAll(async () => {
      await applySettings({ separator: '_' });
    });

    test.afterAll(async () => {
      await restoreDefaults();
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

  // ── Separator vs. format customization ───────────────────────────────────
  //
  // When the user explicitly saves a token order the format is "customized".
  // In customized mode the global separator governs only word boundaries;
  // per-gap separators control the gap between tokens.

  test.describe('Separator vs format customization: hyphen gap, underscore word boundary', () => {
    // hyphen token gap (formatSeps), underscore word boundary (separator)
    test.beforeAll(async () => {
      await applySettings({ tokenOrder: 'type,identifier', formatSeps: '-', separator: '_' });
    });

    test.afterAll(async () => {
      await restoreDefaults();
    });

    test('separator does not affect token gap when format is explicitly customized -- JS', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      // gap = '-' (explicit formatSeps), word boundaries = '_' (global sep)
      expect(jsTag).toBe('button-subscribe_newsletter');
    });

    test('PHP<->JS parity: separator does not affect token gap when format is explicitly customized', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="button-subscribe_newsletter"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('button-subscribe_newsletter');
    });
  });

  // This test deliberately exercises the transition from customized → default,
  // so it must manage settings inside the test itself.  It lives in its own
  // group to make the isolation boundary explicit.
  test.describe('Separator vs format customization: resetting to default restores gap behavior', () => {
    test.afterAll(async () => {
      await restoreDefaults();
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

  // ── Token order ───────────────────────────────────────────────────────────

  test.describe('Token order: identifier only', () => {
    test.beforeAll(async () => {
      await applySettings({ tokenOrder: 'identifier', formatSeps: '' });
    });

    test.afterAll(async () => {
      await restoreDefaults();
    });

    test('identifier-only token order removes type prefix in JS-generated tags', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('subscribe-newsletter');
    });

    test('PHP<->JS parity: identifier-only token order', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="subscribe-newsletter"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('subscribe-newsletter');
    });
  });

  test.describe('Token order: type suffix (identifier,type)', () => {
    test.beforeAll(async () => {
      await applySettings({ tokenOrder: 'identifier,type', formatSeps: '-' });
    });

    test.afterAll(async () => {
      await restoreDefaults();
    });

    test('type-suffix order (identifier,type) produces type after identifier in JS', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('subscribe-newsletter-button');
    });

    test('PHP<->JS parity: type-suffix order', async ({ page }) => {
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(page.locator(`[${ATTR}="subscribe-newsletter-button"]`).first()).toBeAttached();
      const jsTag = await injectAndGetTag(page, '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>');
      expect(jsTag).toBe('subscribe-newsletter-button');
    });
  });

  // ── Per-gap separator ─────────────────────────────────────────────────────
  //
  // Per-gap separators are only active when the format is explicitly customized.
  // The global separator controls word boundaries; per-gap seps control token gaps.
  //
  // All three tests share: tokenOrder='type,identifier', formatSeps='_', separator='-'.
  // The third test asserts that explicitly setting separator='-' (the already-applied
  // default) still does not override the per-gap sep — proving it's a property of
  // the persisted config, not a transient interaction.

  test.describe('Per-gap separator: underscore gap, hyphen word boundary', () => {
    test.beforeAll(async () => {
      await applySettings({ tokenOrder: 'type,identifier', formatSeps: '_', separator: '-' });
    });

    test.afterAll(async () => {
      await restoreDefaults();
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
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      const jsTag = await injectAndGetTag(page, '<button id="parity-checkout-btn" type="button">Pay Now</button>');
      // gap = '_' (explicit formatSeps), word boundaries = '-' (global sep)
      expect(jsTag).toBe('button_parity-checkout-btn');
    });
  });

  // ── Live HTML preview ─────────────────────────────────────────────────────

  test.describe('Live HTML preview: default format mode', () => {
    test.beforeAll(async () => {
      await restoreDefaults();
    });

    // These tests only interact with the client-side preview widget; they never
    // persist settings, so no afterAll restore is needed.

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
      // Note: the selector change is client-side only and is not saved.
    });
  });

  test.describe('Live HTML preview: explicitly customized format mode', () => {
    test.beforeAll(async () => {
      await applySettings({ tokenOrder: 'type,identifier', formatSeps: '-' });
    });

    test.afterAll(async () => {
      await restoreDefaults();
    });

    test('preview token gap does not change when separator changes in explicitly customized format', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
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
      // Note: the selector change is client-side only and is not saved.
    });
  });
});
