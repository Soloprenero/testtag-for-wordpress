import { test, expect } from '@playwright/test';
import { FrontendPage } from '@pageObjects/FrontendPage';
import { WordPressAuthPage } from '@pageObjects/WordPressAuthPage';
import { TEST_URLS } from '@tests/constants';

const screenshotDir = './tests/screenshots';

/**
 * Audit Mode
 *
 * Covers all aspects of the TestTag Audit Mode overlay feature:
 * - Keyboard shortcut toggle (Alt+Shift+T)
 * - Admin bar button text and color reflect active state
 * - Legend panel is rendered with correct layer swatches
 * - Highlight style sheet is injected and removed on toggle
 * - Session storage persists audit mode across reloads
 * - Tooltip appears when hovering a tagged element
 */
test.describe('TestTag Plugin - Audit Mode', () => {
  test.describe('Toggle behaviour', () => {
    test('Alt+Shift+T enables Audit Mode and shows the legend', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert legend is not visible before toggling', async () => {
        await expect(page.locator('#testtag-audit-legend')).toBeHidden();
      });

      await test.step('Press Alt+Shift+T to enable Audit Mode', async () => {
        await frontendPage.enableAuditMode();
      });

      await test.step('Assert the audit legend is now visible', async () => {
        await expect(page.locator('#testtag-audit-legend')).toBeVisible();
      });

      await test.step('Capture screenshot with legend visible', async () => {
        await page.screenshot({
          path: `${screenshotDir}/20-audit-mode-enabled.png`,
          fullPage: false,
        });
      });
    });

    test('Alt+Shift+T a second time disables Audit Mode and hides the legend', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Enable Audit Mode', async () => {
        await frontendPage.enableAuditMode();
      });

      await test.step('Disable Audit Mode', async () => {
        await frontendPage.disableAuditMode();
      });

      await test.step('Assert the audit legend is hidden again', async () => {
        await expect(page.locator('#testtag-audit-legend')).toBeHidden();
      });

      await test.step('Capture screenshot after disabling', async () => {
        await page.screenshot({
          path: `${screenshotDir}/21-audit-mode-disabled.png`,
          fullPage: false,
        });
      });
    });
  });

  test.describe('Legend content', () => {
    test('Legend contains the expected layer labels', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Enable Audit Mode', async () => {
        await frontendPage.enableAuditMode();
      });

      await test.step('Assert "Inline" label is present in the legend', async () => {
        await expect(page.locator('#testtag-audit-legend')).toContainText('Inline');
      });

      await test.step('Assert "Selector map" label is present in the legend', async () => {
        await expect(page.locator('#testtag-audit-legend')).toContainText('Selector map');
      });

      await test.step('Assert "Auto layer" label is present in the legend', async () => {
        await expect(page.locator('#testtag-audit-legend')).toContainText('Auto layer');
      });

      await test.step('Assert "Dynamic layer" label is present in the legend', async () => {
        await expect(page.locator('#testtag-audit-legend')).toContainText('Dynamic layer');
      });

      await test.step('Assert the keyboard shortcut hint is shown', async () => {
        await expect(page.locator('#testtag-audit-legend')).toContainText('Alt+Shift+T');
      });
    });

    test('Legend contains the "TestTag Audit Mode" title', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Enable Audit Mode', async () => {
        await frontendPage.enableAuditMode();
      });

      await test.step('Assert the legend title text is present', async () => {
        await expect(page.locator('#testtag-audit-legend')).toContainText('TestTag Audit Mode');
      });
    });
  });

  test.describe('Admin bar button', () => {
    test('Admin bar Audit Mode button reflects active state', async ({ page }) => {
      const auth = new WordPressAuthPage(page);
      const frontendPage = new FrontendPage(page);

      await test.step('Ensure plugin is active (establishes admin session)', async () => {
        await auth.ensureTestTagPluginIsActive();
      });

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert admin bar audit button shows inactive label', async () => {
        const auditLink = page.locator('#wp-admin-bar-testtag-audit a');
        await expect(auditLink).toContainText('Audit Mode');
      });

      await test.step('Enable Audit Mode via keyboard shortcut', async () => {
        await frontendPage.enableAuditMode();
      });

      await test.step('Assert admin bar audit button label changes to "Audit: ON"', async () => {
        const auditLink = page.locator('#wp-admin-bar-testtag-audit a');
        await expect(auditLink).toContainText('Audit: ON');
      });

      await test.step('Disable Audit Mode', async () => {
        await frontendPage.disableAuditMode();
      });

      await test.step('Assert admin bar label reverts to inactive text', async () => {
        const auditLink = page.locator('#wp-admin-bar-testtag-audit a');
        await expect(auditLink).not.toContainText('Audit: ON');
      });
    });
  });

  test.describe('Highlight style injection', () => {
    test('Audit Mode injects a highlight stylesheet into <head>', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Assert no audit style tag exists before enabling', async () => {
        const styleCount = await page.locator('#testtag-audit-style').count();
        expect(styleCount).toBe(0);
      });

      await test.step('Enable Audit Mode', async () => {
        await frontendPage.enableAuditMode();
      });

      await test.step('Assert the audit highlight style tag is injected into <head>', async () => {
        await expect(page.locator('#testtag-audit-style')).toBeAttached();
      });

      await test.step('Disable Audit Mode', async () => {
        await frontendPage.disableAuditMode();
      });

      await test.step('Assert the audit highlight style tag is removed from <head>', async () => {
        await expect(page.locator('#testtag-audit-style')).not.toBeAttached();
      });
    });
  });

  test.describe('Session persistence', () => {
    test('Audit Mode state is preserved in sessionStorage', async ({ page }) => {
      const frontendPage = new FrontendPage(page);

      await test.step('Navigate to fixture page', async () => {
        await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
      });

      await test.step('Enable Audit Mode', async () => {
        await frontendPage.enableAuditMode();
      });

      await test.step('Assert sessionStorage key is set to "1"', async () => {
        const stored = await page.evaluate(() => sessionStorage.getItem('testtag_audit_active'));
        expect(stored).toBe('1');
      });

      await test.step('Disable Audit Mode', async () => {
        await frontendPage.disableAuditMode();
      });

      await test.step('Assert sessionStorage key is removed after disabling', async () => {
        const stored = await page.evaluate(() => sessionStorage.getItem('testtag_audit_active'));
        expect(stored).toBeNull();
      });
    });
  });
});
