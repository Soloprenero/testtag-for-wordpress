# Docker WordPress Initialization

This directory contains the Docker initialization script and setup utilities for the TestTag screenshot testing environment.

## Files

- **wordpress-init.sh** - Automatic WordPress setup script that runs when Docker container starts
- **setup-local.bat** - Windows batch script for easy local setup
- **setup-local.sh** - Bash script for macOS/Linux setup
- **verify-setup.sh/.bat** - Verification scripts to check setup completeness
- **quick-test.bat** - Quick Docker reset and test runner for Windows

## Auto-Initialization

When using Docker Compose, the `wordpress-init.sh` script automatically:

1. ✅ Installs WordPress core if not already installed
2. ✅ Creates admin user (admin/password)
3. ✅ Creates test user (testuser/testpass123)
4. ✅ Configures WordPress site URLs
5. ✅ Activates TestTag plugin
6. ✅ Configures TestTag settings
7. ✅ Creates a test page for screenshots

This happens automatically on first start - no manual setup needed!

## Quick Start (Windows)

```bash
# Option 1: Full setup with verification
cd ci && setup-local.bat

# Option 2: Quick reset and test
quick-test.bat
```

## Credentials

After running setup, use these to access WordPress:

- **URL:** `TEST_URL` if set, otherwise `http://localhost:${WORDPRESS_PORT:-8080}`
- **Admin URL:** `TEST_URL/wp-admin`
- **Admin User:** admin
- **Admin Password:** password
- **Test User:** testuser / testpass123

## Environment Variables

- `USE_DOCKER=true` - Tells tests that Docker is being used (auto-set)
- `CI=true` - Sets CI mode for test configuration (auto-set)
- `WORDPRESS_PORT` - Override the published Docker host port (default: `8080`)
- `TEST_URL` - Override the public WordPress URL used by Playwright and setup scripts (default: `http://localhost:${WORDPRESS_PORT}`)

## Troubleshooting

**WordPress not initializing?**
- Check Docker logs: `docker compose logs wordpress`
- Ensure MySQL is healthy: `docker compose logs mysql`
- Reset everything: `docker compose down -v && docker compose up -d`

**Tests timing out?**
- Wait longer for WordPress to fully initialize (first start takes 1-2 minutes)
- Check if WordPress is responding: `curl $TEST_URL`
- Increase timeouts in playwright.config.ts if needed

**Port already in use?**
- Set `WORDPRESS_PORT` before running Docker Compose (example: `WORDPRESS_PORT=8081`)
- If you also need a custom public URL, set `TEST_URL` to match it

## Development

To modify the WordPress initialization:

1. Edit `wordpress-init.sh`
2. Run `docker compose up -d` to apply changes
3. Or reset and restart: `docker compose down -v && docker compose up -d`
