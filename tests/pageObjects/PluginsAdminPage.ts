import { expect, type Locator, type Page } from '@playwright/test';
import { AppPage } from '@pageObjects/AppPage';
import { TEST_URLS } from '@tests/constants';

export class PluginsAdminPage extends AppPage {
  protected pageUrl = TEST_URLS.PLUGINS;

  readonly pluginsTable: Locator;
  readonly taggedElements: Locator;

  constructor(page: Page) {
    super(page);
    this.pluginsTable = page.locator('#the-list, .wp-list-table.plugins').first();
    this.taggedElements = page.locator('[data-testid], [data-cy], [data-test]');
  }

  async open(): Promise<void> {
    await this.navigateTo();
    await expect(this.pluginsTable).toBeVisible();
  }

  async expectTaggingToBeActive(): Promise<void> {
    await expect(this.taggedElements.first()).toBeVisible({ timeout: 10000 });
  }

  async getTaggedElementCount(): Promise<number> {
    return this.taggedElements.count();
  }
}