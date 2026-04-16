/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { request } from '@playwright/test';
import { execSync } from 'child_process';
import { TEST_CONTENT, TESTTAG_PLUGIN, TEST_URLS, TEST_USERS } from '@tests/constants';
import { WordPressRestClient } from '@helpers/wp-api';

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

const FIXTURE_PAGE_CONTENT = `<!-- wp:html -->
<section id="testtag-fixture-root" style="max-width:980px;margin:0 auto;padding:24px 16px;line-height:1.5;">
  <header id="fixture-site-header" style="border-bottom:1px solid #ddd;padding-bottom:12px;margin-bottom:20px;">
    <p style="margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#666;">TestTag Fixture</p>
    <h1 style="margin:0 0 8px;">Common Site Elements + Layer Samples</h1>
    <nav aria-label="Primary" id="fixture-primary-nav">
      <ul style="display:flex;flex-wrap:wrap;gap:12px;list-style:none;padding:0;margin:0;">
        <li><a href="#fixture-inline-sample">Inline sample</a></li>
        <li><a href="#fixture-selector-sample">Selector-map sample</a></li>
        <li><a href="#fixture-auto-sample">Auto sample</a></li>
        <li><a href="#fixture-dynamic-sample">Dynamic sample</a></li>
      </ul>
    </nav>
  </header>

  <section id="fixture-layer-legend" aria-label="Layer legend" style="border:2px solid #111;padding:12px 14px;margin-bottom:20px;background:#f7f7f7;">
    <h2 style="margin:0 0 10px;font-size:18px;">Fixture Legend (Always Visible)</h2>
    <ul style="margin:0;padding-left:18px;">
      <li><strong>Inline:</strong> Pre-authored data attributes in saved HTML.</li>
      <li><strong>Selector map:</strong> Matched from plugin selector map settings.</li>
      <li><strong>Auto:</strong> Common interactive/site elements tagged automatically.</li>
      <li><strong>Dynamic:</strong> Elements appended after page load.</li>
    </ul>
  </section>

  <main id="fixture-main" style="display:grid;grid-template-columns:2fr 1fr;gap:20px;">
    <article id="fixture-content" aria-label="Main content" style="min-width:0;">
      <section id="fixture-inline-sample" style="margin-bottom:22px;">
        <h2 data-testid="fixture-subtitle" data-cy="fixture-subtitle" data-test="fixture-subtitle" style="margin-bottom:6px;">Inline Layer Sample</h2>
        <p style="margin:0;">This heading carries authored attributes in page content and should appear as inline.</p>
      </section>

      <section id="fixture-selector-sample" style="margin-bottom:22px;">
        <h2 style="margin-bottom:6px;">Selector-map Layer Sample</h2>
        <form class="search-form" role="search" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <label for="fix-s">Search</label>
          <input id="fix-s" type="search" name="s" placeholder="Find docs" />
          <button type="submit">Search</button>
        </form>
      </section>

      <section id="fixture-auto-sample" style="margin-bottom:22px;">
        <h2 style="margin-bottom:6px;">Auto Layer Sample</h2>
        <p>These are common site controls/elements likely to be auto-tagged:</p>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px;">
          <a href="#">Primary link</a>
          <button type="button">Button action</button>
          <input type="email" placeholder="Email input" aria-label="Email input" />
          <select id="fixture-select" name="fixture-select" aria-label="Sample select">
            <option value="option-a">Option A</option>
            <option value="option-b">Option B</option>
          </select>
        </div>
        <textarea rows="3" cols="32" aria-label="Sample textarea">Sample textarea content</textarea>
      </section>

      <section id="fixture-dynamic-sample" style="margin-bottom:22px;">
        <h2 style="margin-bottom:6px;">Dynamic Layer Sample</h2>
        <p style="margin:0 0 8px;">A dynamic element is appended after page load in the container below.</p>
        <div id="fixture-dynamic-target" aria-live="polite" style="border:1px dashed #999;padding:10px;">Waiting for dynamic element...</div>
      </section>

      <section id="fixture-content-extras">
        <h2 style="margin-bottom:6px;">Additional Common Content</h2>
        <ul id="fixture-ul" style="padding-left:18px;">
          <li>Unordered list item</li>
          <li>Secondary list item</li>
        </ul>
        <ol id="fixture-ol" style="padding-left:18px;margin-top:8px;">
          <li>First ordered item</li>
          <li>Second ordered item</li>
        </ol>
        <table id="fixture-table" style="border-collapse:collapse;min-width:260px;margin-top:8px;">
          <caption style="text-align:left;padding-bottom:4px;">Sample metrics table</caption>
          <thead>
            <tr><th style="border:1px solid #ccc;padding:4px;">Metric</th><th style="border:1px solid #ccc;padding:4px;">Value</th></tr>
          </thead>
          <tbody>
            <tr><td style="border:1px solid #ccc;padding:4px;">Tagged elements</td><td style="border:1px solid #ccc;padding:4px;">Expected &gt; 0</td></tr>
          </tbody>
        </table>
        <fieldset id="fixture-fieldset" style="margin-top:12px;border:1px solid #ccc;padding:10px;">
          <legend>Shipping address</legend>
          <input type="text" placeholder="Street" aria-label="Street address" />
        </fieldset>
        <details id="fixture-details" style="margin-top:12px;">
          <summary>Toggle FAQ</summary>
          <p>This is the expanded content.</p>
        </details>
        <form id="fixture-form" aria-label="Contact form" style="margin-top:12px;padding:10px;border:1px solid #ccc;">
          <label>Name <input type="text" name="contact-name" placeholder="Your name" /></label>
          <button type="submit">Send</button>
        </form>
      </section>
    </article>

    <aside id="fixture-sidebar" aria-label="Sidebar" style="border-left:1px solid #ddd;padding-left:16px;">
      <h2 style="margin-top:0;">Sidebar Module</h2>
      <p>Typical secondary content area for themes with sidebars.</p>
      <figure style="margin:0;">
        <img alt="Placeholder graphic" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='120'%3E%3Crect width='220' height='120' fill='%23e9eef6'/%3E%3Ctext x='110' y='64' text-anchor='middle' fill='%23555' font-size='14' font-family='sans-serif'%3EFixture Image%3C/text%3E%3C/svg%3E" style="max-width:100%;height:auto;border:1px solid #ccc;" />
        <figcaption style="font-size:12px;color:#666;">Image and caption sample.</figcaption>
      </figure>
    </aside>
  </main>

  <footer id="fixture-footer" style="border-top:1px solid #ddd;margin-top:20px;padding-top:12px;">
    <small>Fixture footer: useful for validating theme footer tagging behavior.</small>
  </footer>
</section>

<script>
  (function () {
    function injectDynamicSample() {
      var host = document.getElementById('fixture-dynamic-target');
      if (!host || document.getElementById('fixture-dynamic-example')) {
        return;
      }
      host.textContent = '';

      // Delay creation so MutationObserver-based dynamic tagging can classify it.
      var el = document.createElement('button');
      el.id = 'fixture-dynamic-example';
      el.type = 'button';
      el.textContent = 'Dynamic element (appended post-load)';
      host.appendChild(el);
    }

    if (document.readyState === 'complete') {
      setTimeout(injectDynamicSample, 600);
    } else {
      window.addEventListener('load', function () {
        setTimeout(injectDynamicSample, 600);
      });
    }
  })();
</script>
<!-- /wp:html -->`;

/**
 * Parity fixture page — exercises stable-first tag generation scenarios shared
 * by both the PHP processor and the JS dynamic injector. Each element is chosen
 * to isolate one priority level in the stable-first stack:
 *
 *   aria-label  → button, heading, link
 *   id          → button, heading, link
 *   name        → button
 *   href path   → link (no stable attr)
 */
const PARITY_FIXTURE_PAGE_CONTENT =
  '<!-- wp:html -->' +
  '<div id="parity-fixtures">' +
    '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>' +
    '<button id="parity-checkout-btn" type="button">Pay Now</button>' +
    '<button name="parity-cta" type="button">Get Started</button>' +
    '<h2 aria-label="Parity Heading Label">Welcome</h2>' +
    '<h3 id="parity-features-heading">Our Features</h3>' +
    '<a href="/parity-target-page" aria-label="Parity Link Label">Click here</a>' +
    '<a href="/parity-docs">Documentation</a>' +
    // Naming-rules parity: prefix stripping — woocommerce- prefix should be removed from the ID
    '<button id="woocommerce-add-to-cart" type="button">Add to Cart</button>' +
    // Naming-rules parity: segment stripping — elementor segment in the middle should be removed
    '<h2 id="product-elementor-title">Product Details</h2>' +
  '</div>' +
  '<!-- /wp:html -->';

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
    
    // Configure TestTag settings — each test project's setup file applies
    // the appropriate settings profile for that project before tests run.
    console.log('TestTag settings will be applied per-profile by project setup files.');
    
    // Ensure test fixture page
    console.log('Ensuring test fixture page...');
    
    await api.ensurePage({
      slug: TEST_CONTENT.LAYER_FIXTURE_PAGE_SLUG,
      title: TEST_CONTENT.LAYER_FIXTURE_PAGE_TITLE,
      content: FIXTURE_PAGE_CONTENT,
      status: 'publish',
    });
    console.log('Test fixture page ensured.');

    await api.ensurePage({
      slug: TEST_CONTENT.PARITY_FIXTURE_PAGE_SLUG,
      title: TEST_CONTENT.PARITY_FIXTURE_PAGE_TITLE,
      content: PARITY_FIXTURE_PAGE_CONTENT,
      status: 'publish',
    });
    console.log('Parity fixture page ensured.');
    
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
