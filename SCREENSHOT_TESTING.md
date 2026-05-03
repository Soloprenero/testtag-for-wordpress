# Test ID Auto Injector - Screenshot Testing Guide

This plugin includes automated screenshot testing using TypeScript with Playwright and CI/CD integration with GitHub Actions.

## 📸 Vision & Goals

The screenshot testing system captures visual documentation of the Test ID Auto Injector plugin's functionality:

- **Admin Interface**: Settings pages, configuration panels
- **Plugin Features**: CSS selector map, audit mode overlay, element tagging in real-time
- **Visual Regression Detection**: Catch unintended UI changes across releases
- **Documentation**: Auto-generated visual reference for users and contributors

## 🚀 Quick Start

### Local Testing with Docker Compose

The easiest way to test locally is using Docker Compose:

```bash
# Start WordPress with MySQL
docker-compose up -d

# Install npm dependencies (if not already installed)
npm ci

# Build the plugin assets
npm run build

# Install Playwright browsers
npx playwright install chromium

# Run screenshot tests in UI mode for interactive testing
npm run test:screenshots:ui

# Or run tests with browser visible
npm run test:screenshots:headed

# Or run tests headlessly (CI mode)
npm run test:screenshots
```

**WordPress Access:**
- URL: http://localhost:8080
- Admin URL: http://localhost:8080/wp-admin
- Default credentials: username: `admin`, password: `password`

**Stopping Services:**
```bash
docker-compose down

# Remove all data and start fresh
docker-compose down -v
```

### Manual WordPress Setup

If you prefer running WordPress locally without Docker:

1. **Set up WordPress locally** (using Local, Vagrant, or manual installation)
2. **Activate Test ID Auto Injector plugin** in WordPress admin
3. **Configure environment variable:**
   ```bash
   export TEST_URL=http://your-wordpress-url
   ```
4. **Run tests:**
   ```bash
   npm run test:screenshots
   ```

## 🏗️ Project Structure

```
tests/
├── e2e/
│   └── screenshots.spec.ts          # Main screenshot test suite (TypeScript)
├── helpers/
│   └── wordpress.ts                 # WordPress interaction utilities (TypeScript)
├── screenshots/                      # Generated screenshots (git ignored)
│   ├── 01-settings-page.png
│   ├── 02-attribute-configuration.png
│   └── ...
├── global-setup.ts                  # Test environment setup (TypeScript)
├── playwright.config.ts             # Playwright configuration (TypeScript)
└── tsconfig.json                    # TypeScript configuration
```

## 📋 Test Categories

### Admin Tests
- **Settings Page**: Complete plugin settings interface
- **Attribute Configuration**: Configurable attribute key selection
- **CSS Selector Map**: Manual selector overrides UI

### Frontend Tests
- **Element Tagging**: Verification of test attributes on elements
- **Audit Mode**: Visual overlay highlighting tagged elements
- **Legend**: Color-coded layer information display

Audit Mode layer order and colors:
- **Inline** (red)
- **Selector map** (blue)
- **Auto** (green)
- **Dynamic** (purple)

### Configuration Tests
- **Alternative Attributes**: Different `data-*` attribute types (data-cy, etc.)

## 🔄 CI/CD Integration

### GitHub Actions Workflow

The `.github/workflows/screenshots.yml` workflow:

1. ✅ Runs on every push to `main` and `develop` branches
2. ✅ Runs on all pull requests
3. ✅ Runs daily schedule (2 AM UTC) for regression detection
4. ✅ Spins up WordPress + MySQL in Docker
5. ✅ Installs and activates the Test ID Auto Injector plugin
6. ✅ Executes all Playwright screenshot tests
7. ✅ Uploads screenshots as artifacts
8. ✅ Uploads HTML report for detailed results
9. ✅ Comments on PRs with test results summary

**Artifacts Available:**
- `playwright-report/` - HTML test report with detailed results
- `screenshots/` - All captured PNG screenshots
- `test-results.json` - Machine-readable test results

## 🎯 Writing New Screenshot Tests

Add tests to `tests/e2e/screenshots.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as wpHelpers from '../helpers/wordpress';

test('My new feature screenshot', async ({ page }) => {
  // Log in
  await wpHelpers.loginToWordPress(page);
  
  // Navigate to specific page
  await wpHelpers.goToTestTagSettings(page);
  
  // Wait for content to load
  await page.waitForLoadState('networkidle');
  
  // Optional: interact with page
  await page.click('button:has-text("Save")');
  
  // Take screenshot
  await page.screenshot({ 
    path: `${screenshotDir}/12-my-feature.png`,
    fullPage: true  // or false for viewport only
  });
});
```

### Available Helper Functions

```javascript
// Authentication
await wpHelpers.loginToWordPress(page, username, password);

// Navigation
await wpHelpers.goToDashboard(page);
await wpHelpers.goToTestTagSettings(page);
await wpHelpers.goToBlockEditor(page, postId);
await wpHelpers.goToFrontendPage(page, pagePath);

// Interaction
await wpHelpers.waitForBlockEditor(page);
await wpHelpers.enableAuditMode(page);
await wpHelpers.disableAuditMode(page);
await wpHelpers.createTestPage(page, title);
await wpHelpers.addBlockEditorContent(page, content);
await wpHelpers.waitForTestAttribute(page, selector, attribute);
```

## 🖼️ Managing Screenshots

### Screenshot Baseline

Once tests pass, their screenshots become the baseline for regression detection:

1. Commit screenshots to repository
2. Future test runs compare against baseline
3. Visual differences fail the test
4. Review differences and update baseline when intentional

### Accepting Visual Changes

When UI intentionally changes:

```bash
# Update baseline screenshots
npm run test:screenshots -- --update-snapshots

# Or individually update specific tests
npm run test:screenshots -- tests/e2e/screenshots.spec.js -k "My Feature" --update
```

### Inspecting Screenshot Diffs

After test failure, check artifacts:
1. Download `screenshots/` artifact from GitHub Actions
2. Compare images visually
3. Review in HTML report for detailed test results

## 🔧 Configuration

### Environment Variables

```bash
# WordPress test URL
TEST_URL=http://localhost:8080

# Skip web server startup (useful with Docker)
SKIP_WEB_SERVER=true
USE_DOCKER=true

# WP-CLI path for setup
WP_CLI_PATH=wp

# Browser settings
HEADED=true              # Show browser window
HEADED_TIMEOUT=60000     # Timeout in ms
```

### Playwright Config Options

Modify `playwright.config.js` to:
- **Add browsers**: Firefox, Safari, Edge
- **Change timeouts**: Increase for slow environments
- **Modify retries**: Set `retries: 3` for flaky tests
- **Update reporters**: Add JSON, XML, custom reporters

```javascript
// Add Firefox and Safari
projects: [
  { name: 'chromium', ... },
  { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
  { name: 'webkit', use: { ...devices['Desktop Safari'] } },
]
```

## 🐛 Troubleshooting

### "WordPress is not ready"
- Check Docker containers are running: `docker ps`
- Verify MySQL is healthy: `docker logs <mysql-container>`
- Increase wait timeout in workflow

### "Plugin not activated"
- Check plugin files are in correct location
- Verify plugin activation in global setup
- Check WordPress debug.log for errors

### "Tests timeout"
- Increase `timeout` in test: `test('name', async ({ page }) => { page.setDefaultTimeout(15000); ... })`
- Increase `timeout` in playwright.config.js
- Check network connectivity

### "Screenshots not captured"
- Verify test didn't fail before screenshot step
- Check file permissions on `tests/screenshots/`
- Ensure `fullPage: true` includes all content

### Local Docker Issues

```bash
# Clean restart
docker-compose down -v
docker-compose up --build

# View logs
docker-compose logs -f wordpress
docker-compose logs -f mysql

# SSH into WordPress container
docker-compose exec wordpress bash
```

## 📊 Viewing Results

### Local Results

After running tests locally:
```bash
npm run test:screenshots
# Results in: playwright-report/index.html
# Open in browser to see detailed reports
```

### CI Results

After GitHub Actions run:
1. Go to workflow run: Actions tab → workflow name → specific run
2. **Download "playwright-report" artifact**
3. Open `index.html` in browser
4. View screenshots, test traces, error details

### HTML Report Includes
- ✅ Test status (passed/failed/skipped)
- 📸 Screenshots and video recordings
- ⏱️ Test duration and timing
- 🔍 Detailed trace information
- 📝 Test output logs

## 🚢 Release & Deployment

### Before Release

```bash
# Run full screenshot suite
npm run test:screenshots

# Update baseline if UI changes are intentional
npm run test:screenshots -- --update-snapshots

# Commit updated screenshots
git add tests/screenshots/
git commit -m "Update screenshots for version X.X.X"
```

### Continuous Monitoring

The daily scheduled workflow detects:
- Unintended visual regressions
- Browser rendering changes
- Platform-specific issues
- Dependency update impacts

## 📚 Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [WordPress Testing](https://developer.wordpress.org/plugins/plugin-basics/testing/)
- [Visual Regression Testing](https://playwright.dev/docs/test-snapshots)
- [GitHub Actions](https://docs.github.com/en/actions)

## 🤝 Contributing

Contributing screenshot tests:
1. Write tests following existing patterns
2. Run locally and verify screenshots
3. Commit `.spec.js` files (not screenshots)
4. GitHub Actions will generate baseline for PR
5. Reviewers verify screenshots look correct

## ❓ FAQ

**Q: Why screenshots instead of unit tests?**
A: Screenshots provide visual regression detection and generate user documentation simultaneously.

**Q: Can I run tests in parallel?**
A: Yes, modify `workers` in `playwright.config.js`. However, reduce to 1 worker for CI to avoid WordPress concurrency issues.

**Q: How do I compare screenshots?**
A: GitHub Actions artifacts show differences in the HTML report. Use external tools like Pixelmatch for automation.

**Q: Can tests run on production?**
A: Not recommended, but possible using `TEST_URL=https://production-site.com`. Use with caution to avoid side effects.

**Q: How often should I update baselines?**
A: Only when UI intentionally changes. Unexpected changes indicate bugs or regressions to fix.
