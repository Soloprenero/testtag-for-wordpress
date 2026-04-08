import { test, expect, type Page } from '@playwright/test';
import { WordPressAuthPage } from '../../pageObjects/WordPressAuthPage';
import { TestTagFactory } from '../../helpers/TestTagFactory';
import { TEST_URLS } from '../../constants';

/**
 * PHP ↔ JS tag-generation parity tests (Issue #2)
 *
 * Each test case verifies that:
 *   1. Factory: TestTagFactory.computeTag() calls the tag engine (js/tag-engine.js)
 *      directly in Node.js — no browser, no page.evaluate().  This produces
 *      the canonical expected tag value without hard-coding strings.
 *      A regression guard asserts the computed value against a known-good
 *      string so algorithm regressions are caught.
 *   2. PHP: navigate to the parity fixture page; the element was already
 *      tagged server-side — assert the expected tag is present.
 *   3. JS:  inject an equivalent element dynamically (so the server hasn't
 *      seen it), wait for the dynamic-injector MutationObserver to tag it,
 *      then assert the tag matches the factory value (tests the full
 *      MutationObserver → autoId path independently of the factory).
 *
 * Three independent assertions per case:
 *   factory says X  →  PHP fixture page has X  →  JS dynamic injection produces X
 *
 * Priority order under test (aria-label → id → name → href path → text):
 *   see includes/class-testtag-html-processor.php  auto_id()
 *   and js/tag-engine.js                           autoId()
 */

const ATTR = 'data-testid';
const LAYER = 'data-testtag-layer';

/**
 * Monotonically increasing counter for unique sentinel attribute values.
 * Avoids any possibility of collision that could arise from time-based IDs
 * during rapid test execution.
 */
let sentinelCounter = 0;

/**
 * Injects an HTML element string into document.body, waits for the
 * dynamic-injector to tag it (signalled by data-testtag-layer="dynamic"),
 * and returns the generated data-testid value — or null when the injector
 * runs but produces no tag for that element (e.g. no stable attribute and
 * text fallback disabled).
 */
async function injectAndGetTag(page: Page, outerHtml: string): Promise<string | null> {
  const sentinelAttr = 'data-parity-sentinel';
  const sentinelVal  = `parity-${++sentinelCounter}`;

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

  // Wait for the dynamic-injector to set data-testtag-layer="dynamic".
  // This guarantees the injector has finished processing, whether or not
  // it produced a tag (elements that return null are not tagged).
  const locator = page.locator(`[${sentinelAttr}="${sentinelVal}"][${LAYER}="dynamic"]`);
  try {
    await locator.waitFor({ state: 'attached', timeout: 5000 });
    return locator.getAttribute(ATTR);
  } catch {
    // Injector ran but produced no tag — return whatever (null) is there.
    return page.locator(`[${sentinelAttr}="${sentinelVal}"]`).getAttribute(ATTR);
  }
}

test.describe('PHP ↔ JS tag-generation parity', () => {
  // Factory is browser-free — created once and reused across all tests.
  const factory = new TestTagFactory();

  test.beforeEach(async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    await auth.ensureTestTagPluginIsActive();
    await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
  });

  // ── Buttons ────────────────────────────────────────────────────

  test('button: aria-label takes priority over text content', async ({ page }) => {
    const html = '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>';

    // Factory hooks into window.TESTTAG._autoId() — the real plugin logic.
    const expectedTag = await factory.computeTag(html);
    // Regression guard: alert if the plugin algorithm changes.
    expect(expectedTag).toBe('button-subscribe-newsletter');

    // PHP — server rendered
    await expect(
      page.locator(`[${ATTR}="${expectedTag}"]`).first()
    ).toBeAttached();

    // JS — dynamically injected (exercises the full MutationObserver path)
    const jsTag = await injectAndGetTag(page, html);
    expect(jsTag).toBe(expectedTag);
  });

  test('button: id used when no aria-label present', async ({ page }) => {
    const html = '<button id="parity-checkout-btn" type="button">Pay Now</button>';

    const expectedTag = await factory.computeTag(html);
    expect(expectedTag).toBe('button-parity-checkout-btn');

    // PHP
    await expect(
      page.locator(`[${ATTR}="${expectedTag}"]`).first()
    ).toBeAttached();

    // JS
    const jsTag = await injectAndGetTag(page, html);
    expect(jsTag).toBe(expectedTag);
  });

  test('button: name attribute used when no aria-label or id', async ({ page }) => {
    const html = '<button name="parity-cta" type="button">Get Started</button>';

    const expectedTag = await factory.computeTag(html);
    expect(expectedTag).toBe('button-parity-cta');

    // PHP
    await expect(
      page.locator(`[${ATTR}="${expectedTag}"]`).first()
    ).toBeAttached();

    // JS
    const jsTag = await injectAndGetTag(page, html);
    expect(jsTag).toBe(expectedTag);
  });

  // ── Headings ───────────────────────────────────────────────────

  test('heading: aria-label takes priority over text content', async ({ page }) => {
    const html = '<h2 aria-label="Parity Heading Label">Welcome</h2>';

    const expectedTag = await factory.computeTag(html);
    expect(expectedTag).toBe('heading-parity-heading-label');

    // PHP
    await expect(
      page.locator(`[${ATTR}="${expectedTag}"]`).first()
    ).toBeAttached();

    // JS
    const jsTag = await injectAndGetTag(page, html);
    expect(jsTag).toBe(expectedTag);
  });

  test('heading: id used when no aria-label present', async ({ page }) => {
    const html = '<h3 id="parity-features-heading">Our Features</h3>';

    const expectedTag = await factory.computeTag(html);
    expect(expectedTag).toBe('heading-parity-features-heading');

    // PHP
    await expect(
      page.locator(`[${ATTR}="${expectedTag}"]`).first()
    ).toBeAttached();

    // JS
    const jsTag = await injectAndGetTag(page, html);
    expect(jsTag).toBe(expectedTag);
  });

  // ── Links ──────────────────────────────────────────────────────

  test('link: aria-label takes priority over href and text', async ({ page }) => {
    const html = '<a href="/parity-target-page" aria-label="Parity Link Label">Click here</a>';

    const expectedTag = await factory.computeTag(html);
    expect(expectedTag).toBe('link-parity-link-label');

    // PHP
    await expect(
      page.locator(`[${ATTR}="${expectedTag}"]`).first()
    ).toBeAttached();

    // JS
    const jsTag = await injectAndGetTag(page, html);
    expect(jsTag).toBe(expectedTag);
  });

  test('link: href path fragment used when no stable attributes present', async ({ page }) => {
    const html = '<a href="/parity-docs">Documentation</a>';

    const expectedTag = await factory.computeTag(html);
    expect(expectedTag).toBe('link-parity-docs');

    // PHP
    await expect(
      page.locator(`[${ATTR}="${expectedTag}"]`).first()
    ).toBeAttached();

    // JS
    const jsTag = await injectAndGetTag(page, html);
    expect(jsTag).toBe(expectedTag);
  });
});
