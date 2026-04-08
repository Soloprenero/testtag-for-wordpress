import { test, expect } from '@playwright/test';
import { FrontendPage } from '@pageObjects/FrontendPage';
import { TEST_URLS } from '@tests/constants';

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
 * - inline        Attributes hand-authored directly on HTML elements
 *                 (e.g. data-testid on the fixture subtitle)
 */
test.describe('TestTag Plugin - Tagging Layers', () => {
  test.describe('Fixture page structure', () => {
    test('Fixture page shows an always-visible legend and labeled layer sections', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert the in-page fixture legend is visible', async () => {
        const legend = page.locator('#fixture-layer-legend');
        await expect(legend).toBeVisible();
        await expect(legend).toContainText('Fixture Legend (Always Visible)');
      });

      await test.step('Assert all four layer labels are listed in the legend', async () => {
        const legend = page.locator('#fixture-layer-legend');
        await expect(legend).toContainText('Inline');
        await expect(legend).toContainText('Selector map');
        await expect(legend).toContainText('Auto');
        await expect(legend).toContainText('Dynamic');
      });

      await test.step('Assert each layer sample section is present and labeled', async () => {
        await expect(page.locator('#fixture-inline-sample h2')).toContainText('Inline Layer Sample');
        await expect(page.locator('#fixture-selector-sample h2')).toContainText('Selector-map Layer Sample');
        await expect(page.locator('#fixture-auto-sample h2')).toContainText('Auto Layer Sample');
        await expect(page.locator('#fixture-dynamic-sample h2')).toContainText('Dynamic Layer Sample');
      });
    });

    test('Fixture page includes common site elements for broad tagging coverage', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert representative structural elements are visible', async () => {
        await expect(page.locator('#fixture-site-header')).toBeVisible();
        await expect(page.locator('#fixture-primary-nav')).toBeVisible();
        await expect(page.locator('#fixture-main')).toBeVisible();
        await expect(page.locator('#fixture-sidebar')).toBeVisible();
        await expect(page.locator('#fixture-footer')).toBeVisible();
      });

      await test.step('Assert representative interactive and content elements are visible', async () => {
        await expect(page.locator('form.search-form').first()).toBeVisible();
        await expect(page.locator('#fixture-auto-sample button').first()).toBeVisible();
        await expect(page.locator('#fixture-auto-sample input').first()).toBeVisible();
        await expect(page.locator('#fixture-auto-sample select').first()).toBeVisible();
        await expect(page.locator('#fixture-auto-sample textarea').first()).toBeVisible();
        await expect(page.locator('#fixture-content-extras table').first()).toBeVisible();
        await expect(page.locator('#fixture-content-extras ul').first()).toBeVisible();
      });
    });
  });

  test.describe('Selector-map layer', () => {
    test('Fixture search form is tagged by the selector-map layer', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert the search form is tagged with testid "search-form"', async () => {
        // The default selector-map entry maps `.search-form, form[role="search"]`
        // to testid "search-form". Use that testid rather than a theme-class selector.
        const form = page.locator('[data-testid="search-form"]').first();
        await expect(form).toBeVisible();
      });

      await test.step('Assert the search form has data-testtag-layer="selector-map"', async () => {
        const form = page.locator('[data-testid="search-form"]').first();
        await expect(form).toHaveAttribute('data-testtag-layer', 'selector-map');
      });

      await test.step('Assert the test attribute value is "search-form"', async () => {
        const form = page.locator('[data-testid="search-form"]').first();
        await expect(form).toHaveAttribute('data-testid', 'search-form');
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

      await test.step('Capture screenshot showing selector-map tagged elements', async () => {
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

  test.describe('Inline attributes', () => {
    test('Fixture subtitle element carries hand-authored data-testid', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert the fixture subtitle is visible with data-testid="fixture-subtitle"', async () => {
        const subtitle = page.locator('[data-testid="fixture-subtitle"]').first();
        await expect(subtitle).toBeVisible();
      });

      await test.step('Assert the subtitle text contains "Inline Layer Sample"', async () => {
        const subtitle = page.locator('[data-testid="fixture-subtitle"]').first();
        await expect(subtitle).toContainText('Inline Layer Sample');
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
