#!/bin/bash
# WordPress initialization script
# Runs automatically when WordPress container starts

set -e

WORDPRESS_PORT="${WORDPRESS_PORT:-8080}"
TEST_URL="${TEST_URL:-http://localhost:${WORDPRESS_PORT}}"

echo "🔧 Initializing WordPress for Screenshot Testing..."

# Wait for WordPress files to be set up
sleep 30

cd /var/www/html

# Check if WordPress is already installed
if wp core is-installed --allow-root 2>/dev/null; then
  echo "✓ WordPress already installed"
else
  echo "📦 Installing WordPress core..."
  wp core install \
    --url="${TEST_URL}" \
    --title="TestTag For WordPress" \
    --admin_user=admin \
    --admin_password=password \
    --admin_email=admin@example.local \
    --allow-root || true
fi

# Check if test user exists
if wp user get testuser --allow-root 2>/dev/null; then
  echo "✓ Test user already exists"
else
  echo "👤 Creating test user..."
  wp user create \
    testuser \
    test@example.local \
    --user_pass=testpass123 \
    --role=editor \
    --allow-root || true
fi

# Update site options
echo "⚙️  Configuring WordPress..."
wp option update home "${TEST_URL}" --allow-root
wp option update siteurl "${TEST_URL}" --allow-root

# Check if TestTag plugin is active
if wp plugin is-active testtag-for-wordpress --allow-root 2>/dev/null; then
  echo "✓ TestTag plugin already active"
else
  echo "🔌 Activating TestTag plugin..."
  wp plugin activate testtag-for-wordpress --allow-root || true
fi

# Configure TestTag plugin
echo "📝 Configuring TestTag plugin..."
wp option update testtag_attribute_key data-testid --allow-root
wp option update testtag_environment_guard 0 --allow-root
wp option update testtag_force_enable 1 --allow-root

# Create / update the layer-fixture page with proper Gutenberg block content
echo "📄 Ensuring layer fixture page..."
bash /var/www/html/wp-content/plugins/testtag-for-wordpress/ci/ensure-fixture-page.sh

echo "✅ WordPress initialization complete!"
echo ""
echo "📋 WordPress Details:"
echo "  URL: ${TEST_URL}"
echo "  Admin URL: ${TEST_URL}/wp-admin"
echo "  Admin User: admin"
echo "  Admin Password: password"
echo ""
