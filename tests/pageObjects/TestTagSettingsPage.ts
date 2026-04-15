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

  static readonly SELECTOR_PREVIEW_RESULTS_ID = 'testtag-selector-preview-results';

  readonly heading: Locator;
  readonly attributeKeyField: Locator;
  readonly cssSelectorMapHeading: Locator;
  readonly saveButton: Locator;
  readonly selectorPreviewHtml: Locator;
  readonly selectorPreviewResults: Locator;
  /** All CSS selector inputs in the selector-map table, by test ID. */
  readonly selectorMapSelectorInputs: Locator;

  constructor(page: Page) {
    super(page);
    this.heading = page.locator('h1, h2').filter({ hasText: /testtag|test tag/i }).first();
    this.attributeKeyField = page.locator('select[name*="attribute_key"], input[name*="attribute_key"]').first();
    this.cssSelectorMapHeading = page.locator('text=CSS Selector Map').first();
    this.saveButton = page.locator('button[type="submit"], input[type="submit"]').first();
    this.selectorPreviewHtml = page.locator('#testtag-selector-preview-html');
    this.selectorPreviewResults = page.locator(`#${TestTagSettingsPage.SELECTOR_PREVIEW_RESULTS_ID}`);
    this.selectorMapSelectorInputs = page.locator('[data-testid="testtag-map-selector-input"]');
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

  async scrollToSelectorPreview(): Promise<void> {
    await this.selectorPreviewHtml.scrollIntoViewIfNeeded();
    await this.selectorPreviewHtml.waitFor({ state: 'visible', timeout: 3000 });
  }

  /**
   * Paste HTML into the selector preview textarea and wait for results to update.
   */
  async setSelectorPreviewHtml(html: string): Promise<void> {
    const previousText = (await this.selectorPreviewResults.textContent())?.trim() ?? '';
    const previousChildCount = await this.selectorPreviewResults.evaluate(
      (el) => el.childElementCount,
    ).catch(() => 0);

    await this.selectorPreviewHtml.fill(html);
    await this.selectorPreviewHtml.dispatchEvent('input');

    await this.page.waitForFunction(
      ({ selector, prevText, prevCount }: { selector: string; prevText: string; prevCount: number }) => {
        const results = document.querySelector(selector);
        if (!results) return false;
        const text = results.textContent?.trim() ?? '';
        const childCount = results.childElementCount;
        return (
          text !== prevText ||
          childCount !== prevCount ||
          text.length > 0 ||
          childCount > 0
        );
      },
      { selector: `#${TestTagSettingsPage.SELECTOR_PREVIEW_RESULTS_ID}`, prevText: previousText, prevCount: previousChildCount },
      { timeout: 3000 },
    );
  }

  /**
   * Overwrite the CSS selector value in a selector-map row and trigger a preview refresh.
   * The preview updates after the 300ms debounce; wait for expected results before asserting.
   * @param selector CSS selector string to enter.
   * @param rowIndex Zero-based index of the row to update (default: 0).
   */
  async setSelectorRowSelector(selector: string, rowIndex = 0): Promise<void> {
    const input = this.selectorMapSelectorInputs.nth(rowIndex);
    await input.fill(selector);
    await input.dispatchEvent('input');
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
