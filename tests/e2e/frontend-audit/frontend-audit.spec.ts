import { test } from '@playwright/test';
import { FrontendPage } from '../../pageObjects/FrontendPage';
import { TEST_URLS } from '../../constants';

const screenshotDir = './tests/screenshots';

test.describe('TestTag Plugin - Frontend + Audit', () => {
  test('Fixture permalink resolves', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    await frontendPage.expectFixturePermalinkResolved();
  });

  test('Fixture seeded elements are tagged', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    await frontendPage.expectFixtureTaggedElementsPresent();
  });

  test('Frontend page with TestTag attributes', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    await frontendPage.injectDynamicFixtureElement();
    await frontendPage.expectAllCoreLayersPresent();

    await page.screenshot({
      path: `${screenshotDir}/07-frontend-testtag-attributes.png`,
      fullPage: true,
    });
  });

  test('Audit Mode legend visible', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    await frontendPage.injectDynamicFixtureElement();
    await frontendPage.expectAllCoreLayersPresent();
    await frontendPage.enableAuditMode();
    await frontendPage.scrollToBottom();

    await page.screenshot({
      path: `${screenshotDir}/08-audit-mode-legend.png`,
      fullPage: true,
    });
  });

  test('Audit Mode disabled normal view', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    await frontendPage.injectDynamicFixtureElement();
    await frontendPage.expectAllCoreLayersPresent();
    await frontendPage.enableAuditMode();
    await frontendPage.disableAuditMode();

    await page.screenshot({
      path: `${screenshotDir}/09-audit-mode-disabled.png`,
      fullPage: true,
    });
  });
});
