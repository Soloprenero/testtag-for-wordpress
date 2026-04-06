import { request } from '@playwright/test';
import { execSync } from 'child_process';
import { TEST_CONTENT, TESTTAG_PLUGIN, TEST_URLS, TEST_USERS } from './constants';
import { WordPressRestClient } from './helpers/wp-api';

/**
 * Global setup for Playwright tests
 * 
 * This runs once before all tests and:
 * - Ensures the plugin is active
 * - Creates a test user
 * - Configures plugin settings
 */

const isTrue = (value: string | undefined): boolean => {
  const normalized = value?.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
};
const dockerPort = (process.env.WORDPRESS_PORT || '8080').trim() || '8080';
const baseURL = (process.env.TEST_URL || `http://localhost:${dockerPort}`).trim();
const isDockerMode = isTrue(process.env.USE_DOCKER);
const PRETTY_PERMALINK_STRUCTURE = '/%postname%/';

const FIXTURE_PAGE_CONTENT =
  '<!-- wp:html --><h2 data-testid="fixture-subtitle" data-cy="fixture-subtitle" data-test="fixture-subtitle">TestTag Layer Fixture</h2><!-- /wp:html -->' +
  '<!-- wp:html --><form class="search-form" role="search"><label for="fix-s">Search</label><input id="fix-s" type="search" name="s" /></form><!-- /wp:html -->' +
  '<!-- wp:paragraph --><p>This page contains representative elements for each TestTag layer.</p><!-- /wp:paragraph -->';

async function waitForWordPressReady(timeoutMs: number = 120000): Promise<void> {
  console.log('Waiting for WordPress to become ready...');
  const deadline = Date.now() + timeoutMs;
  const api = await request.newContext({ baseURL: baseURL, ignoreHTTPSErrors: true });

  try {
    while (Date.now() < deadline) {
      try {
        const response = await api.get(TEST_URLS.LOGIN, { failOnStatusCode: false });
        if (response.status() >= 200 && response.status() < 500) {
          console.log(`WordPress is ready (status: ${response.status()}).`);
          return;
        }
      } catch {
        // Keep polling until timeout while container networking settles.
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  } finally {
    await api.dispose();
  }

  throw new Error(`WordPress did not become ready within ${timeoutMs}ms.`);
}

async function isWordPressReachable(): Promise<boolean> {
  const api = await request.newContext({ baseURL, ignoreHTTPSErrors: true });

  try {
    const response = await api.get(TEST_URLS.LOGIN, { failOnStatusCode: false, timeout: 5000 });
    return response.status() >= 200 && response.status() < 500;
  } catch {
    return false;
  } finally {
    await api.dispose();
  }
}

async function assertFixturePermalinkExists(): Promise<void> {
  const api = await request.newContext({ baseURL: baseURL, ignoreHTTPSErrors: true });

  try {
    const response = await api.get(TEST_URLS.LAYER_FIXTURE_PAGE, { failOnStatusCode: false });
    if (response.status() === 404) {
      throw new Error(
        `Fixture page ${TEST_URLS.LAYER_FIXTURE_PAGE} returned 404 after setup. Setup may have failed.`
      );
    }
    console.log('Fixture page is accessible.');
  } finally {
    await api.dispose();
  }
}

async function assertFixturePermalinkExistsWithRetry(client: WordPressRestClient): Promise<void> {
  try {
    await assertFixturePermalinkExists();
    return;
  } catch {
    console.log('Fixture permalink missing on first check. Reapplying permalink settings...');
    await client.ensurePrettyPermalinks(PRETTY_PERMALINK_STRUCTURE);
    await assertFixturePermalinkExists();
  }
}

/**
 * API-based setup - No browser needed
 */
async function setupViaApi(): Promise<void> {
  console.log('Setting up WordPress via REST API...');
  
  const api = new WordPressRestClient(baseURL);
  
  try {
    console.log('Ensuring WordPress is installed...');
    await api.init(TEST_USERS.ADMIN.username, TEST_USERS.ADMIN.password);
    await api.ensureInstalled({
      siteTitle: 'TestTag Screenshot Tests',
      username: TEST_USERS.ADMIN.username,
      password: TEST_USERS.ADMIN.password,
      email: TEST_USERS.ADMIN.email,
    });
    await api.dispose();

    // Initialize API with admin credentials and establish authenticated session
    console.log('Authenticating via API...');
    await api.init(TEST_USERS.ADMIN.username, TEST_USERS.ADMIN.password);
    const authPath = await api.saveAuthStorage();
    console.log(`Saved auth storage for ${TEST_USERS.ADMIN.username} at ${authPath}`);
    
    // Activate TestTag plugin
    console.log(`Activating ${TESTTAG_PLUGIN.slug} plugin...`);
    try {
      await api.activatePlugin(TESTTAG_PLUGIN.slug);
      console.log('TestTag plugin activated.');
    } catch (error) {
      // Some local stacks do not expose the plugins REST endpoint.
      console.log('Plugin activation endpoint unavailable in this environment; continuing with existing plugin state.');
      console.log(`Activation detail: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Set pretty permalinks to /%postname%/ and flush rewrite rules.
    console.log('Normalizing site URL settings...');
    try {
      await api.updateOption('home', baseURL);
      await api.updateOption('siteurl', baseURL);
      console.log(`WordPress home/siteurl set to ${baseURL}`);
    } catch (error) {
      console.log(`Note: unable to update home/siteurl via REST API (${error instanceof Error ? error.message : String(error)})`);
    }

    console.log('Configuring permalink structure...');
    await api.ensurePrettyPermalinks(PRETTY_PERMALINK_STRUCTURE);
    console.log(`Permalink structure set to ${PRETTY_PERMALINK_STRUCTURE}`);
    
    // Update TestTag attribute key to data-testid for consistent fixture expectations
    console.log('Configuring TestTag settings...');
    try {
      await api.updateOption('testtag_attribute_key', 'data-testid');
      console.log('TestTag attribute key set to data-testid');
    } catch (error) {
      // Settings validation might fail if plugin structure is different, log but continue
      console.log(`Note: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // Ensure test fixture page
    console.log('Ensuring test fixture page...');
    
    await api.ensurePage({
      slug: TEST_CONTENT.LAYER_FIXTURE_PAGE_SLUG,
      title: TEST_CONTENT.LAYER_FIXTURE_PAGE_TITLE,
      content: FIXTURE_PAGE_CONTENT,
      status: 'publish',
    });
    console.log('Test fixture page ensured.');
    
    await assertFixturePermalinkExistsWithRetry(api);

    console.log('WordPress API setup complete!');
  } finally {
    await api.dispose();
  }
}

/**
 * Global setup function
 */
async function globalSetup(): Promise<void> {
  // Skip setup in non-Docker CI environments.
  if (process.env.CI && !isDockerMode) {
    console.log('Skipping setup in CI mode');
    return;
  }

  // Build plugin assets before deployment
  console.log('Building plugin assets...');
  try {
    execSync('npm run build', { stdio: 'inherit' });
    console.log('Plugin assets built successfully!');
  } catch (error) {
    console.error('Build failed:', error instanceof Error ? error.message : String(error));
    throw error;
  }

  if (isDockerMode) {
    const reachableSite = await isWordPressReachable();

    // Check if both required services are already running.
    let servicesRunning = false;
    try {
      const psOutput = execSync('docker compose ps --services --filter status=running', {
        encoding: 'utf8',
      });
      const runningServices = psOutput
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(Boolean);
      servicesRunning = runningServices.includes('wordpress') && runningServices.includes('mysql');
    } catch {
      servicesRunning = false;
    }

    if (servicesRunning) {
      // If services are already running, restart WordPress to pick up fresh plugin builds.
      console.log('Docker services already running. Restarting WordPress to load updated plugin...');
      execSync('docker compose restart wordpress', { stdio: 'inherit' });
    } else if (reachableSite) {
      console.log(`Reusing existing WordPress instance at ${baseURL}.`);
    } else {
      // Start containers when any required service is missing.
      console.log('Starting Docker services...');
      execSync('docker compose up -d', { stdio: 'inherit' });
    }

    await waitForWordPressReady();
  }

  await setupViaApi();

  console.log('Global setup completed successfully!');
}

export default globalSetup;
