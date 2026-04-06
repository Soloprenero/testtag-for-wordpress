#!/bin/bash
# Idempotently creates or updates the layer-fixture page used by Playwright
# screenshot tests. Each element in the content is chosen to exercise a
# specific TestTag layer when the page is rendered:
#
#   inline        — <h2 data-testid="..."> already present in saved HTML
#   selector-map  — <form class="search-form"> matches the default selector map
#   auto          — WordPress theme elements (nav, header) get auto-tagged
#   dynamic       — <button> injected client-side by the test itself
#
# This script is idempotent and runs safely on every test-suite invocation.

set -e

cd /var/www/html

# Use Gutenberg Custom HTML blocks so WordPress preserves data-* attributes
# without any sanitisation.
CONTENT='<!-- wp:html --><h2 data-testid="fixture-subtitle" data-cy="fixture-subtitle" data-test="fixture-subtitle">TestTag Layer Fixture</h2><!-- /wp:html --><!-- wp:html --><form class="search-form" role="search"><label for="fix-s">Search</label><input id="fix-s" type="search" name="s" /></form><!-- /wp:html --><!-- wp:paragraph --><p>This page contains representative elements for each TestTag layer.</p><!-- /wp:paragraph -->'

PAGE_ID=$(wp post list \
  --post_type=page \
  --name=test-page \
  --field=ID \
  --allow-root \
  2>/dev/null || echo "")

if [ -z "$PAGE_ID" ]; then
  echo "📄 Creating layer fixture page..."
  wp post create \
    --post_type=page \
    --post_status=publish \
    --post_title='Test Page' \
    --post_name='test-page' \
    --post_content="$CONTENT" \
    --allow-root
  echo "✅ Layer fixture page created"
else
  echo "📄 Updating layer fixture page (ID: ${PAGE_ID})..."
  wp post update "$PAGE_ID" \
    --post_content="$CONTENT" \
    --allow-root
  echo "✅ Layer fixture page updated (ID: ${PAGE_ID})"
fi
