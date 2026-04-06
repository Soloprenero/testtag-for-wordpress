#!/bin/bash
# Idempotently creates or updates the layer-fixture page used by Playwright
# screenshot tests. Each element in the content is chosen to exercise a
# specific TestTag layer when the page is rendered:
#
#   inline        — <h2 data-testid="..."> already present in saved HTML
#   selector-map  — <form class="search-form"> matches the default selector map
#   auto          — WordPress theme elements (nav, header) get auto-tagged
#   dynamic       — <button> injected client-side after page load
#
# This script is idempotent and runs safely on every test-suite invocation.

set -e

cd /var/www/html

# Use Gutenberg Custom HTML blocks so WordPress preserves data-* attributes
# without any sanitisation.
CONTENT=$(cat <<'HTML'
<!-- wp:html -->
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
          <select aria-label="Sample select">
            <option>Option A</option>
            <option>Option B</option>
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
        <ul>
          <li>Unordered list item</li>
          <li>Secondary list item</li>
        </ul>
        <table style="border-collapse:collapse;min-width:260px;">
          <caption style="text-align:left;padding-bottom:4px;">Sample metrics table</caption>
          <thead>
            <tr><th style="border:1px solid #ccc;padding:4px;">Metric</th><th style="border:1px solid #ccc;padding:4px;">Value</th></tr>
          </thead>
          <tbody>
            <tr><td style="border:1px solid #ccc;padding:4px;">Tagged elements</td><td style="border:1px solid #ccc;padding:4px;">Expected &gt; 0</td></tr>
          </tbody>
        </table>
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
<!-- /wp:html -->
HTML
)

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
