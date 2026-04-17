/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { request } from '@playwright/test';
import { WordPressRestClient } from '@helpers/wp-api';
import { TEST_USERS } from '@tests/constants';

const baseURL = (process.env.TEST_URL || 'http://localhost:8081').trim();

async function waitForWordPressReady(timeoutMs: number = 120000): Promise<void> {
  console.log('Waiting for WordPress to become ready...');
  const deadline = Date.now() + timeoutMs;
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });

  try {
    while (Date.now() < deadline) {
      try {
        const response = await api.get('/wp-login.php', { failOnStatusCode: false });
        if (response.status() >= 200 && response.status() < 500) {
          console.log(`WordPress is ready (status: ${response.status()}).`);
          return;
        }
      } catch {
        // Keep polling until the container networking settles.
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } finally {
    await api.dispose();
  }

  throw new Error(`WordPress did not become ready within ${timeoutMs}ms.`);
}

/**
 * Minimal global setup for the plugin installation test.
 *
 * This setup intentionally does NOT activate or mount the TestTag plugin so
 * that the test can exercise the full zip-upload installation flow on a blank
 * WordPress site.
 */
async function globalSetup(): Promise<void> {
  await waitForWordPressReady();

  console.log('Ensuring WordPress is installed (no plugin activation)...');
  const api = new WordPressRestClient(baseURL);
  await api.init(TEST_USERS.ADMIN.username, TEST_USERS.ADMIN.password);

  try {
    await api.ensureInstalled({
      siteTitle: 'Plugin Installation Test',
      username: TEST_USERS.ADMIN.username,
      password: TEST_USERS.ADMIN.password,
      email: TEST_USERS.ADMIN.email,
    });
    console.log('WordPress installation confirmed.');
  } finally {
    await api.dispose();
  }

  console.log('Installation test global setup complete.');
}

export default globalSetup;
