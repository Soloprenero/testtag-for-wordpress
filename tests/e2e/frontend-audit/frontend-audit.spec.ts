import { test } from '@playwright/test';
import { FrontendPage } from '../../pageObjects/FrontendPage';
import { TEST_URLS } from '../../constants';

const screenshotDir = './tests/screenshots';

test.describe('TestTag Plugin - Frontend + Audit', () => {
  test('Fixture permalink resolves', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await test.step('Navigate to fixture page', async () => {
      await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    });

    await test.step('Assert URL resolves and page is not a 404', async () => {
      await frontendPage.expectFixturePermalinkResolved();
    });
  });

  test('Fixture seeded elements are tagged', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await test.step('Navigate to fixture page', async () => {
      await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    });

    await test.step('Assert seeded elements carry TestTag attributes', async () => {
      await frontendPage.expectFixtureTaggedElementsPresent();
    });
  });

  test('Frontend page with TestTag attributes', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await test.step('Navigate to fixture page', async () => {
      await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    });

    await test.step('Inject dynamic fixture element', async () => {
      await frontendPage.injectDynamicFixtureElement();
    });

    await test.step('Assert all core tagging layers are present', async () => {
      await frontendPage.expectAllCoreLayersPresent();
    });

    await test.step('Capture full-page screenshot', async () => {
      await page.screenshot({
        path: `${screenshotDir}/07-frontend-testtag-attributes.png`,
        fullPage: true,
      });
    });
  });

  test('Audit Mode legend visible', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await test.step('Navigate to fixture page', async () => {
      await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    });

    await test.step('Inject dynamic fixture element', async () => {
      await frontendPage.injectDynamicFixtureElement();
    });

    await test.step('Assert all core tagging layers are present', async () => {
      await frontendPage.expectAllCoreLayersPresent();
    });

    await test.step('Enable Audit Mode via keyboard shortcut', async () => {
      await frontendPage.enableAuditMode();
    });

    await test.step('Scroll to bottom and capture legend screenshot', async () => {
      await frontendPage.scrollToBottom();
      await page.screenshot({
        path: `${screenshotDir}/08-audit-mode-legend.png`,
        fullPage: true,
      });
    });
  });

  test('Audit Mode disabled normal view', async ({ page }) => {
    const frontendPage = new FrontendPage(page);

    await test.step('Navigate to fixture page', async () => {
      await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
    });

    await test.step('Inject dynamic fixture element', async () => {
      await frontendPage.injectDynamicFixtureElement();
    });

    await test.step('Assert all core tagging layers are present', async () => {
      await frontendPage.expectAllCoreLayersPresent();
    });

    await test.step('Enable Audit Mode', async () => {
      await frontendPage.enableAuditMode();
    });

    await test.step('Disable Audit Mode and verify legend is hidden', async () => {
      await frontendPage.disableAuditMode();
    });

    await test.step('Capture full-page screenshot of normal view', async () => {
      await page.screenshot({
        path: `${screenshotDir}/09-audit-mode-disabled.png`,
        fullPage: true,
      });
    });
  });
});
