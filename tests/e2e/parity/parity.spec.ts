import { test, expect } from '@tests/fixtures';
import type { Page } from '@playwright/test';
import { WordPressAuthPage } from '@pageObjects/WordPressAuthPage';
import { TEST_URLS } from '@tests/constants';

/**
 * PHP ↔ JS tag-generation parity tests (Issue #2)
 *
 * Each test case verifies that the server-side PHP processor and the
 * client-side dynamic injector produce the *same* data-testid value for
 * the same element HTML, regardless of what string-format settings are
 * currently active.
 *
 * Test structure for every case:
 *   1. PHP: navigate to the parity fixture page and read the data-testid
 *      value the server already assigned — this is the ground truth for
 *      the current settings.
 *   2. JS:  inject an equivalent element dynamically (so the server hasn't
 *      seen it), wait for the dynamic-injector MutationObserver to tag it,
 *      then assert the tag matches the PHP value exactly.
 *
 * Parity is about agreement between the two layers, not about a specific
 * output format.  Tests are intentionally settings-agnostic so they remain
 * valid when string-format tests run concurrently and alter WordPress options.
 *
 * Priority order under test (aria-label → id → name → href path → text):
 *   see includes/class-testtag-html-processor.php  auto_id()
 *   and js/dynamic-injector.js                     autoId()
 */

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
async function injectAndGetTag(page: Page, outerHtml: string, attr: string): Promise<string | null> {
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
    return locator.getAttribute(attr);
  } catch {
    // Injector ran but produced no tag — return whatever (null) is there.
    return page.locator(`[${sentinelAttr}="${sentinelVal}"]`).getAttribute(attr);
  }
}

test.describe('PHP ↔ JS tag-generation parity', () => {
  test.beforeEach(async ({ page }) => {
    const auth = new WordPressAuthPage(page);
    await auth.ensureTestTagPluginIsActive();
    await page.goto(TEST_URLS.PARITY_FIXTURE_PAGE, { waitUntil: 'networkidle', timeout: 60000 });
  });

  // ── Buttons ────────────────────────────────────────────────────

  test('button: aria-label takes priority over text content', async ({ page, testTagSettings }) => {
    const attr = testTagSettings.attributeKey;
    // PHP — read whatever the server produced under the current settings
    const phpTag = await page
      .locator('#parity-fixtures > button[aria-label="Subscribe Newsletter"]')
      .getAttribute(attr);
    expect(phpTag).not.toBeNull();

    // JS — dynamically injected; must match PHP exactly
    const jsTag = await injectAndGetTag(
      page,
      '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>',
      attr,
    );
    expect(jsTag).toBe(phpTag);
  });

  test('button: id used when no aria-label present', async ({ page, testTagSettings }) => {
    const attr = testTagSettings.attributeKey;
    const phpTag = await page
      .locator('#parity-fixtures > button#parity-checkout-btn')
      .getAttribute(attr);
    expect(phpTag).not.toBeNull();

    const jsTag = await injectAndGetTag(
      page,
      '<button id="parity-checkout-btn" type="button">Pay Now</button>',
      attr,
    );
    expect(jsTag).toBe(phpTag);
  });

  test('button: name attribute used when no aria-label or id', async ({ page, testTagSettings }) => {
    const attr = testTagSettings.attributeKey;
    const phpTag = await page
      .locator('#parity-fixtures > button[name="parity-cta"]')
      .getAttribute(attr);
    expect(phpTag).not.toBeNull();

    const jsTag = await injectAndGetTag(
      page,
      '<button name="parity-cta" type="button">Get Started</button>',
      attr,
    );
    expect(jsTag).toBe(phpTag);
  });

  // ── Headings ───────────────────────────────────────────────────

  test('heading: aria-label takes priority over text content', async ({ page, testTagSettings }) => {
    const attr = testTagSettings.attributeKey;
    const phpTag = await page
      .locator('#parity-fixtures > h2[aria-label="Parity Heading Label"]')
      .getAttribute(attr);
    expect(phpTag).not.toBeNull();

    const jsTag = await injectAndGetTag(
      page,
      '<h2 aria-label="Parity Heading Label">Welcome</h2>',
      attr,
    );
    expect(jsTag).toBe(phpTag);
  });

  test('heading: id used when no aria-label present', async ({ page, testTagSettings }) => {
    const attr = testTagSettings.attributeKey;
    const phpTag = await page
      .locator('#parity-fixtures > h3#parity-features-heading')
      .getAttribute(attr);
    expect(phpTag).not.toBeNull();

    const jsTag = await injectAndGetTag(
      page,
      '<h3 id="parity-features-heading">Our Features</h3>',
      attr,
    );
    expect(jsTag).toBe(phpTag);
  });

  // ── Links ──────────────────────────────────────────────────────

  test('link: aria-label takes priority over href and text', async ({ page, testTagSettings }) => {
    const attr = testTagSettings.attributeKey;
    const phpTag = await page
      .locator('#parity-fixtures > a[aria-label="Parity Link Label"]')
      .getAttribute(attr);
    expect(phpTag).not.toBeNull();

    const jsTag = await injectAndGetTag(
      page,
      '<a href="/parity-target-page" aria-label="Parity Link Label">Click here</a>',
      attr,
    );
    expect(jsTag).toBe(phpTag);
  });

  test('link: href path fragment used when no stable attributes present', async ({ page, testTagSettings }) => {
    const attr = testTagSettings.attributeKey;
    const phpTag = await page
      .locator('#parity-fixtures > a[href="/parity-docs"]')
      .getAttribute(attr);
    expect(phpTag).not.toBeNull();

    const jsTag = await injectAndGetTag(
      page,
      '<a href="/parity-docs">Documentation</a>',
      attr,
    );
    expect(jsTag).toBe(phpTag);
  });
});
