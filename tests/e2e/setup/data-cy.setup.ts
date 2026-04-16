/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { test as setup } from '@playwright/test';
import { WordPressRestClient } from '@helpers/wp-api';
import { TEST_USERS } from '@tests/constants';

/**
 * Settings profile: data-cy
 *
 * Attribute key : data-cy
 * Separator     : - (hyphen)
 * Token order   : type,identifier (WordPress default)
 *
 * Run this project before any test project that uses the data-cy profile:
 *   npx playwright test --project=data-cy
 */

const dockerPort = (process.env.WORDPRESS_PORT || '8080').trim();
const baseURL = (process.env.TEST_URL || `http://localhost:${dockerPort}`).trim();

setup('apply data-cy settings profile', async () => {
  const api = new WordPressRestClient(baseURL);
  await api.init(TEST_USERS.ADMIN.username, TEST_USERS.ADMIN.password);
  try {
    await api.updateOption('testtag_attribute_key', 'data-cy');
    await api.resetTestTagFormatSettings();
  } finally {
    await api.dispose();
  }
});
