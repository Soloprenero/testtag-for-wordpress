import type { Locator, Page } from '@playwright/test';
import { AppPage } from '@pageObjects/AppPage';
import { TEST_URLS } from '@tests/constants';

export interface StringFormatOptions {
  /** Slug-word-boundary separator: '-' (default) or '_' */
  separator?: '-' | '_';
  /** Comma-separated active token names, e.g. 'type,identifier' */
  tokenOrder?: string;
  /** Comma-separated per-gap separators, e.g. '-' or '_' */
  formatSeps?: string;
}

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
    const attributeKeyLabel = this.page.locator('text=Test Tag Format').first();
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

  /**
   * Add a new row to the CSS Selector Map table.
   * Clicks "Add Row", fills the selector and tag-value inputs in the new row.
   */
  async addSelectorMapRow(selector: string, tagValue: string): Promise<void> {
    const addRowBtn = this.page.locator('#testtag-add-row');
    await addRowBtn.click();
    const rows = this.page.locator('tr.testtag-row');
    const lastRow = rows.last();
    await lastRow.locator('input[name$="[selector]"]').fill(selector);
    await lastRow.locator('input[name$="[testid]"]').fill(tagValue);
    // Trigger blur so validation fires.
    await lastRow.locator('input[name$="[selector]"]').blur();
  }

  /**
   * Get the validation error/warning message for the last selector-map row.
   */
  async getLastRowSelectorMessage(): Promise<string | null> {
    const rows = this.page.locator('tr.testtag-row');
    const lastRow = rows.last();
    const msg = lastRow.locator('.testtag-selector-msg');
    if (await msg.isVisible({ timeout: 1000 }).catch(() => false)) {
      return msg.textContent();
    }
    return null;
  }

  /**
   * Set string-format options on the settings page.
   * Must be called while the settings page is open; call saveSettings() afterwards.
   */
  async setStringFormat(options: StringFormatOptions): Promise<void> {
    if (options.separator !== undefined) {
      const separatorSelect = this.page.locator('#testtag-separator');
      if (await separatorSelect.isVisible({ timeout: 2000 }).catch(() => false)) {
        await separatorSelect.selectOption(options.separator);
      }
    }
    if (options.tokenOrder !== undefined) {
      await this.page.evaluate((value: string) => {
        const el = document.getElementById('testtag-token-order-val') as HTMLInputElement | null;
        if (el) el.value = value;
      }, options.tokenOrder);
    }
    if (options.formatSeps !== undefined) {
      await this.page.evaluate((value: string) => {
        const el = document.getElementById('testtag-format-seps-val') as HTMLInputElement | null;
        if (el) el.value = value;
      }, options.formatSeps);
    }
  }

  /** Restore default string-format settings and save. */
  async restoreDefaultStringFormat(): Promise<void> {
    await this.open();
    // Empty tokenOrder and formatSeps signals PHP to restore "default mode" where
    // the global separator governs all token gaps (not an explicit custom format).
    await this.setStringFormat({ separator: '-', tokenOrder: '', formatSeps: '' });
    await this.saveSettings();
  }
}
