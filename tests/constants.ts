export const TEST_URLS = {
  LOGIN: '/wp-login.php',
  ADMIN_HOME: '/wp-admin/',
  PLUGINS: '/wp-admin/plugins.php',
  TESTTAG_SETTINGS: '/wp-admin/tools.php?page=testtag',
  LAYER_FIXTURE_PAGE: '/test-page/',
  PARITY_FIXTURE_PAGE: '/parity-test/',
  FRONTEND_HOME: '/',
} as const;

export const TEST_CONTENT = {
  LAYER_FIXTURE_PAGE_SLUG: 'test-page',
  LAYER_FIXTURE_PAGE_TITLE: 'Test Page',
  PARITY_FIXTURE_PAGE_SLUG: 'parity-test',
  PARITY_FIXTURE_PAGE_TITLE: 'Parity Test',
} as const;

export const TEST_USERS = {
  ADMIN: {
    username: 'admin',
    password: 'password',
    email: 'admin@example.local',
  },
  EDITOR: {
    username: 'testuser',
    password: 'testpass123',
    email: 'test@example.com',
  },
} as const;

export const TESTTAG_PLUGIN = {
  slug: 'testtag-for-wordpress/testtag-for-wordpress.php',
  rowSelector: 'tr[data-plugin="testtag-for-wordpress/testtag-for-wordpress.php"]',
} as const;
