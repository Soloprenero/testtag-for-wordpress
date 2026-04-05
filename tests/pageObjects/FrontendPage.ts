import type { Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { AppPage } from './AppPage';
import { TEST_URLS } from '../constants';

export class FrontendPage extends AppPage {
  protected pageUrl = TEST_URLS.FRONTEND_HOME;

  readonly body: Locator;

  constructor(page: Page) {
    super(page);
    this.body = page.locator('body');
  }

  async open(path: string = TEST_URLS.FRONTEND_HOME): Promise<void> {
    await this.page.goto(path, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForLoadState('networkidle');
  }

  async enableAuditMode(): Promise<void> {
    await this.page.keyboard.press('Alt+Shift+T');
    await this.page.locator('#testtag-audit-legend').waitFor({ state: 'visible', timeout: 5000 });
  }

  async disableAuditMode(): Promise<void> {
    await this.page.keyboard.press('Alt+Shift+T');
    await this.page.locator('#testtag-audit-legend').waitFor({ state: 'hidden', timeout: 5000 });
  }

  async scrollToBottom(): Promise<void> {
    await this.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await this.page.waitForFunction(
      () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 2,
      { timeout: 3000 }
    );
  }

  async countTaggedElements(tag: string): Promise<number> {
    const selector = `${tag}[data-testid], ${tag}[data-cy], ${tag}[data-test]`;
    return this.page.locator(selector).count();
  }

  async injectDynamicFixtureElement(): Promise<void> {
    await this.page.evaluate(() => {
      if (document.getElementById('testtag-dynamic-fixture')) {
        return;
      }
      // Must be a button/link/input so the dynamic-injector MutationObserver tags it.
      const btn = document.createElement('button');
      btn.id = 'testtag-dynamic-fixture';
      btn.type = 'button';
      btn.textContent = 'Dynamic fixture element';
      document.body.appendChild(btn);
    });
    // Wait for the dynamic-injector to apply data-testtag-layer="dynamic"
    await this.page
      .locator('#testtag-dynamic-fixture[data-testtag-layer="dynamic"]')
      .waitFor({ state: 'attached', timeout: 10000 });
  }

  async expectFixturePermalinkResolved(): Promise<void> {
    await expect(this.page.locator('h1').filter({ hasText: /^Not Found$/i })).toHaveCount(0);
    await expect(this.page).toHaveURL(/\/test-page\/?$/);
  }

  async expectFixtureTaggedElementsPresent(): Promise<void> {
    const selectorMapFixture = this.page.locator('form.search-form').first();
    await expect(selectorMapFixture).toBeVisible();
    await expect(selectorMapFixture).toHaveAttribute('data-testtag-layer', 'selector-map');

    const hasAnyTestAttr = await selectorMapFixture.evaluate(el =>
      ['data-testid', 'data-cy', 'data-test'].some(attr => el.hasAttribute(attr))
    );
    expect(hasAnyTestAttr).toBe(true);

    await expect(this.page.locator('[data-testid="fixture-subtitle"]').first()).toBeVisible();
  }

  async expectAllCoreLayersPresent(): Promise<void> {
    await expect(this.page.locator('[data-testtag-layer="selector-map"]').first()).toBeVisible();
    await expect(this.page.locator('[data-testtag-layer="auto"]').first()).toBeVisible();
    await expect(this.page.locator('[data-testtag-layer="dynamic"]').first()).toBeVisible();
  }
}
