# 📸 TestTag for WordPress - CI/CD Screenshot Testing

## ✅ Setup Summary

I've set up a complete automated screenshot testing system for your TestTag WordPress plugin. This captures visual documentation of your plugin's functionality in CI/CD using TypeScript with Playwright, with visual regression detection.

## 📦 What's Been Created

### Core Files

| File | Purpose |
|------|---------|
| `playwright.config.ts` | Playwright configuration for screenshot tests (TypeScript) |
| `docker-compose.yml` | Docker setup with WordPress + MySQL for local testing |
| `.github/workflows/screenshots.yml` | GitHub Actions CI/CD workflow |
| `package.json` | Updated with Playwright, TypeScript, and test scripts |
| `tsconfig.json` | TypeScript configuration for test files |

### Test Files

| File | Purpose |
|------|---------|
| `tests/e2e/screenshots.spec.ts` | All screenshot test cases (11+ tests) in TypeScript |
| `tests/helpers/wordpress.ts` | Reusable WordPress helper functions with full typing |
| `tests/global-setup.ts` | One-time environment setup before tests in TypeScript |
| `tests/README.md` | Quick reference for testing |

### Setup & Documentation

| File | Purpose |
|------|---------|
| `SCREENSHOT_TESTING.md` | Complete comprehensive guide |
| `ci/setup-local.sh` | Automated setup script for macOS/Linux |
| `ci/setup-local.bat` | Automated setup script for Windows |
| `ci/quick-test.bat` | One-button test runner for Windows |
| `ci/wordpress-init.sh` | Automatic WordPress initialization (runs in Docker) |
| `.gitignore` | Updated to exclude test artifacts |

## 🚀 Quick Start

### Windows - Easiest (2 steps)
```bash
# Step 1: Initial setup
cd ci && setup-local.bat

# Step 2: Run tests (subsequent times)
npm run quick:test
```

### macOS/Linux
```bash
bash ci/setup-local.sh
npm run test:screenshots
```

### One-Click Test (Windows)
```bash
ci\quick-test.bat
```

## 📋 Available npm Scripts

```bash
# Quick test run (best for local testing)
npm run quick:test

# Standard screenshot tests
npm run test:screenshots

# Run with interactive UI
npm run test:screenshots:ui

# Run with visible browser window
npm run test:screenshots:headed

# Update baseline screenshots after intentional UI changes
npm run test:screenshots:update

# Docker commands
npm run wp:docker:up      # Start containers
npm run wp:docker:down    # Stop containers
npm run wp:docker:reset   # Reset with fresh data
```

## 🎯 What Tests Capture

### Admin Interface
- ✅ Settings page layout
- ✅ Attribute configuration options
- ✅ CSS Selector Map UI
- ✅ Alternative attribute types (data-cy, data-test, etc.)

### Frontend Features
- ✅ Test attributes applied to elements
- ✅ Audit Mode visual overlay
- ✅ Color-coded layer legend
- ✅ Element coverage verification

## 📊 CI/CD Workflow (GitHub Actions)

The `.github/workflows/screenshots.yml` workflow:

1. **Runs On:**
   - Every push to `main` and `develop` branches
   - All pull requests
   - Daily schedule (2 AM UTC) for regression detection

2. **Does:**
   - Spins up WordPress + MySQL in Docker
   - Installs and activates TestTag plugin
   - Runs all Playwright screenshot tests
   - Generates HTML report with test details
   - Uploads artifacts (screenshots, reports)
   - Comments on PRs with summary

3. **Artifacts Generated:**
   - `playwright-report/` - Detailed HTML test report
   - `screenshots/` - All captured PNG files
   - `test-results.json` - Machine-readable results

## 🔍 Viewing Results

### Local Results
```bash
# After running tests, open the report:
# Windows:
start playwright-report\index.html

# macOS:
open playwright-report/index.html

# Linux:
xdg-open playwright-report/index.html
```

### CI Results (GitHub Actions)
1. Go to **Actions** tab in your repository
2. Click the workflow run you want to review
3. Scroll down to **Artifacts** section
4. Download `playwright-report` or `screenshots`
5. Open `index.html` in browser

## 📝 Adding New Tests

Add to `tests/e2e/screenshots.spec.ts`:

```typescript
import { test } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as wpHelpers from '../helpers/wordpress';

test('My new feature', async ({ page }) => {
  // Login
  await wpHelpers.loginToWordPress(page);
  
  // Navigate
  await wpHelpers.goToTestTagSettings(page);
  
  // Wait for content
  await page.waitForLoadState('networkidle');
  
  // Take screenshot
  await page.screenshot({ 
    path: './tests/screenshots/12-feature-name.png',
    fullPage: true
  });
});
```

Available helpers in `tests/helpers/wordpress.ts`:
- `loginToWordPress()` - Authenticate
- `goToDashboard()`, `goToTestTagSettings()`, `goToBlockEditor()` - Navigate
- `enableAuditMode()`, `disableAuditMode()` - Audit Mode control
- `createTestPage()`, `addBlockEditorContent()` - Create content
- `waitForTestAttribute()` - Verify element tagging

## 🔄 Updating Baselines

When UI intentionally changes:

```bash
# Update all baseline screenshots
npm run test:screenshots:update

# Then commit the changes
git add tests/screenshots/
git commit -m "Update screenshots for UI changes in X.X.X"
```

## 🐳 Docker Commands

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs -f wordpress    # WordPress logs
docker-compose logs -f mysql        # MySQL logs

# Access WordPress container shell
docker-compose exec wordpress bash

# Stop and remove all containers and volumes
docker-compose down -v
```

## ⚙️ Configuration

### Environment Variables
```bash
TEST_URL=http://localhost:8080      # WordPress test URL
SKIP_WEB_SERVER=true                # Skip local web server startup
USE_DOCKER=true                     # Using Docker setup
```

### Modify Playwright Config
Edit `playwright.config.js` to:
- Add more browsers (Firefox, Safari, Edge)
- Change timeouts
- Adjust retry settings
- Add more reporters

## 📚 Full Documentation

See **[SCREENSHOT_TESTING.md](SCREENSHOT_TESTING.md)** for:
- Detailed setup instructions
- Troubleshooting guide
- Best practices
- Advanced configuration
- FAQ

## 🎬 Current Test Coverage

11+ screenshot tests covering:
- Admin settings pages
- Attribute configuration
- Block editor integration  
- Frontend element tagging
- Audit Mode overlays
- Configuration variations
- Element coverage verification

## 🔧 Troubleshooting

### WordPress won't start
```bash
docker-compose logs wordpress
# Check if containers crashed or need more time
```

### Tests timeout
- Increase `timeout` in `playwright.config.js`
- Check network connectivity
- Verify Docker resources allocated

### Screenshots not captured
- Check file permissions: `chmod 755 tests/screenshots`
- Verify test didn't fail before screenshot line
- Review test output for errors

### Plugin not activated
- Manually check WordPress admin → Plugins
- Verify plugin files are readable
- Check setup logs in output

## 📌 Next Steps

1. **Run setup:** `cd ci && setup-local.bat` (Windows) or `bash ci/setup-local.sh` (Unix)
2. **Build plugin:** `npm run build`
3. **Run tests:** `npm run test:screenshots`
4. **Review results:** Open `playwright-report/index.html`
5. **Commit:** Add tests and push to trigger CI/CD workflow

## ✨ Benefits

- 🎯 **Visual Regression Detection** - Catch unintended UI changes automatically
- 📸 **Documentation** - Screenshots serve as visual documentation for users
- 🔄 **CI/CD Integration** - Automated testing on every push and PR
- ⏰ **Time Saver** - Auto-generated visual tests vs manual testing
- 🐛 **Bug Prevention** - Catch issues before release
- 📊 **Historical Record** - Track UI evolution across releases

## 🤝 Support

If you encounter issues:
1. Check [SCREENSHOT_TESTING.md](SCREENSHOT_TESTING.md) troubleshooting section
2. Review GitHub Actions workflow logs
3. Check Docker logs: `docker-compose logs`
4. Verify WordPress admin access: http://localhost:8080/wp-admin

---

**Happy testing! 🚀**
