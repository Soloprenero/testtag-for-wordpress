/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import type { Page } from '@playwright/test';
import { WordPressAuthApiHelper } from '@helpers/wp-api';

/**
 * Authenticates as WordPress admin user and verifies admin session.
 */
export async function loginAsAdmin(
  page: Page,
  baseUrl: string,
  username: string,
  password: string
): Promise<void> {
  const authApi = new WordPressAuthApiHelper(baseUrl);
  await authApi.loginAsAdmin(page, username, password);
}
