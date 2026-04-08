import { test, expect, type Page } from '@playwright/test';
import { WordPressAuthPage } from '../../pageObjects/WordPressAuthPage';
import { TestTagSettingsPage } from '../../pageObjects/TestTagSettingsPage';
import { TEST_URLS } from '../../constants';

const ATTR  = 'data-testid';
const LAYER = 'data-testtag-layer';

let sentinelCounter = 0;

/**
 * Injects an HTML element into document.body, waits for the dynamic
 * injector to tag it, and returns the generated data-testid value.
 */
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

  test.afterEach(async ({ page }) => {
    const settings = new TestTagSettingsPage(page);
    await settings.restoreDefaultStringFormat();
  });

  // ── Separator ──────────────────────────────────────────────────────────

  test.describe('Separator', () => {
    test('underscore separator applies to word boundaries in JS-generated tags', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ separator: '_' });
      await settings.saveSettings();

      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });

      const jsTag = await injectAndGetTag(
        page,
        '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>'
      );
      expect(jsTag).toBe('button_subscribe_newsletter');
    });

    test('PHP↔JS parity: underscore separator', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ separator: '_' });
      await settings.saveSettings();

      // PHP path — page is freshly rendered with the new separator setting
      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(
        page.locator(`[${ATTR}="button_subscribe_newsletter"]`).first()
      ).toBeAttached();

      // JS path — dynamic injector must produce the same value
      const jsTag = await injectAndGetTag(
        page,
        '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>'
      );
      expect(jsTag).toBe('button_subscribe_newsletter');
    });

    test('PHP↔JS parity: underscore separator — heading with multi-word id', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ separator: '_' });
      await settings.saveSettings();

      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(
        page.locator(`[${ATTR}="heading_parity_features_heading"]`).first()
      ).toBeAttached();

      const jsTag = await injectAndGetTag(
        page,
        '<h3 id="parity-features-heading">Our Features</h3>'
      );
      expect(jsTag).toBe('heading_parity_features_heading');
    });
  });

  // ── Token order ────────────────────────────────────────────────────────

  test.describe('Token order', () => {
    test('identifier-only token order removes type prefix in JS-generated tags', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'identifier', formatSeps: '' });
      await settings.saveSettings();

      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });

      const jsTag = await injectAndGetTag(
        page,
        '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>'
      );
      expect(jsTag).toBe('subscribe-newsletter');
    });

    test('PHP↔JS parity: identifier-only token order', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'identifier', formatSeps: '' });
      await settings.saveSettings();

      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(
        page.locator(`[${ATTR}="subscribe-newsletter"]`).first()
      ).toBeAttached();

      const jsTag = await injectAndGetTag(
        page,
        '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>'
      );
      expect(jsTag).toBe('subscribe-newsletter');
    });

    test('type-suffix order (identifier,type) produces type after identifier in JS', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'identifier,type', formatSeps: '-' });
      await settings.saveSettings();

      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });

      const jsTag = await injectAndGetTag(
        page,
        '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>'
      );
      expect(jsTag).toBe('subscribe-newsletter-button');
    });

    test('PHP↔JS parity: type-suffix order', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'identifier,type', formatSeps: '-' });
      await settings.saveSettings();

      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(
        page.locator(`[${ATTR}="subscribe-newsletter-button"]`).first()
      ).toBeAttached();

      const jsTag = await injectAndGetTag(
        page,
        '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>'
      );
      expect(jsTag).toBe('subscribe-newsletter-button');
    });
  });

  // ── Per-gap separator ──────────────────────────────────────────────────

  test.describe('Per-gap separator', () => {
    test('underscore per-gap separator between type and identifier — JS', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      // type_identifier (global slug sep stays hyphen)
      await settings.setStringFormat({ tokenOrder: 'type,identifier', formatSeps: '_' });
      await settings.saveSettings();

      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });

      const jsTag = await injectAndGetTag(
        page,
        '<button id="checkout-btn" type="button">Pay</button>'
      );
      // type=button, identifier=checkout-btn → type_identifier
      expect(jsTag).toBe('button_checkout-btn');
    });

    test('PHP↔JS parity: underscore per-gap separator', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();
      await settings.setStringFormat({ tokenOrder: 'type,identifier', formatSeps: '_' });
      await settings.saveSettings();

      await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
      await expect(
        page.locator(`[${ATTR}="button_parity-checkout-btn"]`).first()
      ).toBeAttached();

      const jsTag = await injectAndGetTag(
        page,
        '<button id="parity-checkout-btn" type="button">Pay Now</button>'
      );
      expect(jsTag).toBe('button_parity-checkout-btn');
    });
  });

  // ── Live HTML preview ──────────────────────────────────────────────────

  test.describe('Live HTML preview', () => {
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

      // Default sample is a button — result must be non-empty
      const result = await previewValue.textContent();
      expect(result?.trim()).toBeTruthy();
    });

    test('preview result updates when HTML textarea content changes', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();

      const previewHtml  = page.locator('#testtag-format-preview-html');
      const previewValue = page.locator('#testtag-format-preview-value');

      await previewHtml.fill('<input aria-label="Search query" placeholder="Search…" />');
      // Trigger the input event so the JS re-evaluates
      await previewHtml.dispatchEvent('input');

      await expect(previewValue).toContainText('search-query', { timeout: 2000 });
    });

    test('preview result reflects current separator setting', async ({ page }) => {
      const settings = new TestTagSettingsPage(page);
      await settings.open();

      const previewHtml  = page.locator('#testtag-format-preview-html');
      const previewValue = page.locator('#testtag-format-preview-value');
      const separatorSel = page.locator('#testtag-separator');

      await previewHtml.fill('<h2 aria-label="About Us Section">About</h2>');
      await previewHtml.dispatchEvent('input');
      await expect(previewValue).toContainText('about-us-section', { timeout: 2000 });
      const hyphenResult = await previewValue.textContent();
      expect(hyphenResult).toContain('about-us-section');

      // Switch to underscore and verify the preview immediately reflects it
      await separatorSel.selectOption('_');
      await separatorSel.dispatchEvent('change');
      await expect(previewValue).toContainText('about_us_section', { timeout: 2000 });
      const underscoreResult = await previewValue.textContent();
      expect(underscoreResult).toContain('about_us_section');
    });
  });
});
