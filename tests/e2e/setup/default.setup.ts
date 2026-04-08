import { test as setup } from '@playwright/test';
import { WordPressRestClient } from '../../helpers/wp-api';
import { TEST_USERS } from '../../constants';

/**
 * Settings profile: default
 *
 * Attribute key : data-testid
 * Separator     : - (hyphen)
 * Token order   : type,identifier (WordPress default)
 *
 * Run this project before any test project that uses the default profile:
 *   npx playwright test --project=default
 */

const dockerPort = (process.env.WORDPRESS_PORT || '8080').trim();
const baseURL = (process.env.TEST_URL || `http://localhost:${dockerPort}`).trim();

setup('apply default settings profile', async () => {
  const api = new WordPressRestClient(baseURL);
  await api.init(TEST_USERS.ADMIN.username, TEST_USERS.ADMIN.password);
  try {
    await api.updateOption('testtag_attribute_key', 'data-testid');
    await api.resetTestTagFormatSettings();
  } finally {
    await api.dispose();
  }
});
