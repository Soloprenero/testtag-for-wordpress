import { test, expect } from '@playwright/test';
import { FrontendPage } from '../../pageObjects/FrontendPage';
import { TEST_URLS } from '../../constants';

const screenshotDir = './tests/screenshots';

/**
 * Tagging Layers
 *
 * Verifies that each TestTag tagging layer operates correctly on the
 * seeded fixture page:
 *
 * - selector-map  Elements matched by the configured CSS Selector Map
 * - auto          Interactive elements (buttons, inputs, links) tagged by
 *                 the layer-marker script
 * - dynamic       Elements added to the DOM after page load, detected by
 *                 the MutationObserver in dynamic-injector.js
 * - custom        Attributes hand-authored directly on HTML elements
 *                 (e.g. data-testid on the fixture subtitle)
 */
test.describe('TestTag Plugin - Tagging Layers', () => {
  test.describe('Selector-map layer', () => {
    test('Fixture search form is tagged by the selector-map layer', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert the search form has data-testtag-layer="selector-map"', async () => {
        const form = page.locator('form.search-form[data-testtag-layer="selector-map"]').first();
        await expect(form).toBeVisible();
      });

      await test.step('Assert the search form carries a test attribute', async () => {
        const form = page.locator('form.search-form[data-testtag-layer="selector-map"]').first();
        const hasTestAttr = await form.evaluate(el =>
          ['data-testid', 'data-cy', 'data-test'].some(a => el.hasAttribute(a))
        );
        expect(hasTestAttr).toBe(true);
      });

      await test.step('Assert the test attribute value matches the configured testid', async () => {
        const form = page.locator('form.search-form[data-testtag-layer="selector-map"]').first();
        const testAttrValue = await form.evaluate(el => {
          for (const a of ['data-testid', 'data-cy', 'data-test']) {
            const v = el.getAttribute(a);
            if (v) return v;
          }
          return null;
        });
        expect(testAttrValue).toBe('search-form');
      });
    });

    test('At least one selector-map element is visible on the fixture page', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert at least one selector-map element is visible', async () => {
        await expect(page.locator('[data-testtag-layer="selector-map"]').first()).toBeVisible();
      });

      await test.step('Capture screenshot showing selector-map tagged elements', async ({ page: _p } = { page }) => {
        await page.screenshot({
          path: `${screenshotDir}/30-tagging-layer-selector-map.png`,
          fullPage: true,
        });
      });
    });
  });

  test.describe('Auto (dynamic) layer', () => {
    test('Auto layer tags interactive elements on the fixture page', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert at least one auto-tagged element is visible', async () => {
        await expect(page.locator('[data-testtag-layer="auto"]').first()).toBeVisible();
      });
    });

    test('Auto-tagged elements carry a test attribute', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Collect all auto-tagged elements', async () => {
        const autoEls = page.locator('[data-testtag-layer="auto"]');
        const count = await autoEls.count();
        expect(count).toBeGreaterThan(0);
      });

      await test.step('Assert the first auto-tagged element has a test attribute', async () => {
        const firstAuto = page.locator('[data-testtag-layer="auto"]').first();
        const hasTestAttr = await firstAuto.evaluate(el =>
          ['data-testid', 'data-cy', 'data-test'].some(a => el.hasAttribute(a))
        );
        expect(hasTestAttr).toBe(true);
      });
    });
  });

  test.describe('Dynamic layer (MutationObserver)', () => {
    test('Element injected after load receives data-testtag-layer="dynamic"', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Inject a button element into the DOM', async () => {
        await frontendPage.injectDynamicFixtureElement();
      });

      await test.step('Assert the injected element has layer="dynamic"', async () => {
        await expect(
          page.locator('#testtag-dynamic-fixture[data-testtag-layer="dynamic"]')
        ).toBeAttached();
      });

      await test.step('Assert the injected element carries a test attribute', async () => {
        const dynEl = page.locator('#testtag-dynamic-fixture[data-testtag-layer="dynamic"]');
        const hasTestAttr = await dynEl.evaluate(el =>
          ['data-testid', 'data-cy', 'data-test'].some(a => el.hasAttribute(a))
        );
        expect(hasTestAttr).toBe(true);
      });

      await test.step('Capture screenshot of dynamic element tagged state', async () => {
        await page.screenshot({
          path: `${screenshotDir}/31-tagging-layer-dynamic.png`,
          fullPage: true,
        });
      });
    });

    test('All three core layers are simultaneously present after injection', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Inject dynamic element', async () => {
        await frontendPage.injectDynamicFixtureElement();
      });

      await test.step('Assert selector-map, auto, and dynamic layers all coexist', async () => {
        await frontendPage.expectAllCoreLayersPresent();
      });
    });
  });

  test.describe('Custom attributes', () => {
    test('Fixture subtitle element carries hand-authored data-testid', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert the fixture subtitle is visible with data-testid="fixture-subtitle"', async () => {
        const subtitle = page.locator('[data-testid="fixture-subtitle"]').first();
        await expect(subtitle).toBeVisible();
      });

      await test.step('Assert the subtitle text contains "TestTag Layer Fixture"', async () => {
        const subtitle = page.locator('[data-testid="fixture-subtitle"]').first();
        await expect(subtitle).toContainText('TestTag Layer Fixture');
      });
    });

    test('Fixture subtitle carries both data-testid and data-cy from seeded content', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert data-cy="fixture-subtitle" is also present', async () => {
        const el = page.locator('[data-cy="fixture-subtitle"]').first();
        await expect(el).toBeVisible();
      });

      await test.step('Assert data-test="fixture-subtitle" is also present', async () => {
        const el = page.locator('[data-test="fixture-subtitle"]').first();
        await expect(el).toBeVisible();
      });
    });
  });
});
