import type { Locator, Page } from '@playwright/test';
import { AppPage } from '@pageObjects/AppPage';
import { TEST_URLS } from '@tests/constants';

export class TestTagSettingsPage extends AppPage {
  protected pageUrl = TEST_URLS.TESTTAG_SETTINGS;

  readonly heading: Locator;
  readonly attributeKeyField: Locator;
  readonly cssSelectorMapHeading: Locator;
  readonly saveButton: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1, h2').filter({ hasText: /testtag|test tag/i }).first();
    this.attributeKeyField = page.locator('select[name*="attribute_key"], input[name*="attribute_key"]').first();
    this.cssSelectorMapHeading = page.locator('text=CSS Selector Map').first();
    this.saveButton = page.locator('button[type="submit"], input[type="submit"]').first();
  }

  async open(): Promise<void> {
    await this.navigateTo();
  }

  async scrollToAttributeConfiguration(): Promise<void> {
    const attributeKeyLabel = this.page.locator('text=Attribute Key').first();
    await attributeKeyLabel.scrollIntoViewIfNeeded();
    await attributeKeyLabel.waitFor({ state: 'visible', timeout: 3000 });
  }

  async scrollToCssSelectorMap(): Promise<void> {
    await this.cssSelectorMapHeading.scrollIntoViewIfNeeded();
    await this.cssSelectorMapHeading.waitFor({ state: 'visible', timeout: 3000 });
  }

  async setAttributeKey(value: 'data-testid' | 'data-cy' | 'data-test'): Promise<void> {
    if (await this.attributeKeyField.isVisible({ timeout: 3000 }).catch(() => false)) {
      const tagName = await this.attributeKeyField.evaluate(el => el.tagName.toLowerCase());
      if (tagName === 'select') {
        await this.attributeKeyField.selectOption(value);
      } else {
        await this.attributeKeyField.fill(value);
      }
    }
  }

  async saveSettings(): Promise<void> {
    if (await this.saveButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await this.saveButton.click();
      await this.page.waitForLoadState('networkidle');
    }
  }
}
