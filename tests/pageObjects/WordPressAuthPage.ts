/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { expect, type Page } from '@playwright/test';
import { TESTTAG_PLUGIN, TEST_URLS, TEST_USERS } from '@tests/constants';

/**
 * Handles WordPress installation wizard, authentication, and plugin activation.
 */
export class WordPressAuthPage {
  public readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  private async completeLanguageStepIfPresent(): Promise<void> {
    const continueButton = this.page.getByRole('button', { name: 'Continue' });
    const isVisible = await continueButton.isVisible({ timeout: 1000 }).catch(() => false);
    if (isVisible) {
      await continueButton.click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  private async completeInstallFormIfPresent(): Promise<void> {
    const title = this.page.locator('input#weblog_title');
    const hasInstallForm = await title.isVisible({ timeout: 1000 }).catch(() => false);
    if (!hasInstallForm) {
      return;
    }

    await title.fill('Test ID Auto Injector');
    await this.page.fill('input#user_login', TEST_USERS.ADMIN.username);

    // Directly set both the hidden submit field (#pass1) and the visible display
    // field (#pass1-text) via evaluate, then check the weak-password confirmation.
    // Using fill() on #pass1-text alone is unreliable because the JS event that
    // syncs its value back to #pass1 may not fire in time inside a container.
    await this.page.evaluate(() => {
      const pass1 = document.querySelector<HTMLInputElement>('#pass1');
      const pass1Text = document.querySelector<HTMLInputElement>('#pass1-text');
      const pwWeak = document.querySelector<HTMLInputElement>('#pw-weak');
      if (pass1Text) {
        pass1Text.value = 'password';
        pass1Text.dispatchEvent(new Event('input', { bubbles: true }));
        pass1Text.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (pass1) {
        pass1.value = 'password';
        pass1.dispatchEvent(new Event('input', { bubbles: true }));
      }
      if (pwWeak) {
        pwWeak.checked = true;
      }
    });
    await this.page.waitForFunction(() => {
      const pass1 = document.querySelector<HTMLInputElement>('#pass1');
      return pass1?.value === 'password';
    }, { timeout: 3000 });

    await this.page.fill('input#admin_email', TEST_USERS.ADMIN.email);

    const submit = this.page.locator('input#submit, button#submit').first();
    await submit.click();
    await this.page.waitForLoadState('domcontentloaded');

    const logInLink = this.page.getByRole('link', { name: /log in/i });
    if (await logInLink.isVisible({ timeout: 3000 }).catch(() => false)) {
      await logInLink.click();
      await this.page.waitForLoadState('domcontentloaded');
    }
  }

  async ensureInstalledAndLogin(
    username: string = TEST_USERS.ADMIN.username,
    password: string = TEST_USERS.ADMIN.password
  ): Promise<void> {
    await this.page.goto(TEST_URLS.LOGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });

    for (let i = 0; i < 4; i++) {
      const loginInput = this.page.locator('input[name="log"]');
      if (await loginInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        break;
      }

      await this.completeLanguageStepIfPresent();
      await this.completeInstallFormIfPresent();

      if (await loginInput.isVisible({ timeout: 1000 }).catch(() => false)) {
        break;
      }

      await this.page.goto(TEST_URLS.LOGIN, { waitUntil: 'domcontentloaded', timeout: 60000 });
    }

    await this.page.waitForSelector('input[name="log"]', { timeout: 30000 });
    await this.page.fill('input[name="log"]', username);
    await this.page.fill('input[name="pwd"]', password);
    await this.page.click('input[type="submit"]');

    await this.page.waitForURL(/\/wp-admin\//, { timeout: 30000 });
    await this.page.waitForLoadState('networkidle');

    const adminBar = this.page.locator('#wpadminbar');
    await expect(adminBar).toBeVisible();
  }

  async ensureTestTagPluginIsActive(): Promise<void> {
    await this.page.goto(TEST_URLS.PLUGINS, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForLoadState('networkidle');

    const activateLink = this.page
      .locator(`${TESTTAG_PLUGIN.rowSelector} a[href*="action=activate"]`)
      .first();

    if (await activateLink.isVisible({ timeout: 1000 }).catch(() => false)) {
      await activateLink.click();
      await this.page.waitForLoadState('networkidle');
    }
  }
}
