/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import type { Locator, Page, Response } from '@playwright/test';

/**
 * Base page object for shared navigation and load behavior.
 */
export abstract class AppPage {
  public readonly page: Page;
  protected abstract pageUrl: string;

  constructor(page: Page) {
    this.page = page;
  }

  async navigateTo(): Promise<Response | null> {
    const response = await this.page.goto(this.pageUrl, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    return response;
  }

  async reload(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' });
  }

  /**
   * Unified test-id lookup across supported attributes.
   */
  protected byTestId(testId: string): Locator {
    const escaped = testId.replace(/"/g, '\\"');
    return this.page
      .locator(`[data-testid="${escaped}"], [data-cy="${escaped}"], [data-test="${escaped}"]`)
      .first();
  }
}
