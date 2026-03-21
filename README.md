# TestTag for WordPress

Automatically tag any element on your WordPress site with test attributes for Playwright, Cypress, Selenium, or any automation framework that queries the DOM.

## Three injection layers (applied in priority order)

1. **Block editor sidebar** — manual `data-testid` per block, server-rendered (highest priority)
2. **CSS selector map** — explicit selector → tag mappings in Settings → TestTag
3. **Auto-generation** — inferred from element semantics (fills everything else)

An existing attribute is **never overwritten** — higher priority layers always win.

---

## Features

### Audit Mode (v1.1.0)

Visual overlay that highlights every tagged element on the page so you can verify coverage at a glance.

**Activate via:**
- Admin bar → **🔍 Audit Mode** button (front-end only, visible to logged-in admins)
- Keyboard shortcut **Alt+Shift+T** (works anywhere)

**What the overlay shows:**
- Coloured border + badge with the tag value on every tagged element
- Hover tooltip showing:
  - Tag value
  - Attribute key in use (`data-testid`, `data-cy`, etc.)
  - Which layer set the tag (block editor / selector map / auto-generated)
  - Element descriptor (`tag#id.class`)

**Layer colour legend:**

| Colour | Layer |
|--------|-------|
| 🟣 Purple | Block editor (server-rendered) |
| 🔵 Blue   | CSS selector map |
| 🟢 Green  | Auto-generated |

The legend appears in the bottom-right corner while Audit Mode is active. Audit Mode state persists across page navigations within the same browser session (via `sessionStorage`).

The overlay is built inside a **shadow DOM** so its styles are fully isolated — it never interferes with the page's own CSS.

---

## Settings

**Settings → TestTag** in wp-admin:

- **Attribute key** — the HTML attribute to inject (`data-testid`, `data-cy`, `data-test`, …)
- **Force Enable** — inject for all visitors on all environments (default: admins + dev/staging only)
- **CSS Selector Map** — add, edit, remove, or reset explicit selector → tag mappings

---

## Files

```
testtag-for-wordpress/
├── testtag-for-wordpress.php          Main plugin bootstrap
├── includes/
│   ├── class-testtag-settings.php    Admin settings page + options API
│   ├── class-testtag-injector.php    Enqueues frontend injector JS
│   ├── class-testtag-block-editor.php  Gutenberg sidebar field
│   └── class-testtag-audit.php       Audit Mode admin bar + overlay assets
├── js/
│   ├── injector.js                   2-layer client engine (selector map + auto-gen)
│   └── audit-overlay.js              Audit Mode overlay (shadow DOM)
├── block-editor/
│   ├── src/index.js
│   └── build/
│       ├── index.js
│       └── editor.css
└── admin/
    ├── admin.js
    └── admin.css
```


Automatically tag any element on your WordPress site with test attributes for **Playwright**, **Cypress**, **Selenium**, or any automation framework that queries the DOM.

Works on any WordPress site — Elementor, Gutenberg, or classic themes.

## Features

- 🏷️ **Configurable attribute key** — use `data-testid`, `data-cy`, `data-test`, or any custom `data-*` attribute
- 🤖 **Auto-generation** — infers meaningful IDs from element semantics (labels, placeholders, text, anchors)
- 🗺️ **CSS selector map** — explicit overrides for theme elements, nav, widgets, Elementor sections
- ✏️ **Block editor sidebar** — per-block manual override with auto-generated preview
- 🛡️ **Environment guard** — only injects for admins and non-production environments by default
- ⚡ **Elementor aware** — handles `data-element_type` and `data-widget_type` nesting
- 🔒 **Non-destructive** — never overwrites an existing attribute

## How it works

Three layers applied in priority order:

| Layer | What it covers | Priority |
|---|---|---|
| Block editor sidebar | Any Gutenberg block | Highest — server-rendered |
| CSS selector map | Nav, footer, widgets, Elementor sections | Applied first client-side |
| Auto-generation | Everything else | Fills in the rest |

## Auto-generated ID examples

| Element | Generated value |
|---|---|
| `<input placeholder="Email Address">` | `input-email-address` |
| `<input type="checkbox" name="agree">` | `checkbox-agree` |
| `<button>Send Message</button>` | `button-send-message` |
| `<a href="#about-me">` in nav | `nav-about-me` |
| `<a href="resume.pdf">Download CV</a>` | `download-download-cv` |
| `<section id="experience">` | `section-experience` |
| `<h2>Professional Experience</h2>` | `h2-professional-experience` |
| Elementor widget | `widget-heading` |
| `core/button` block ("Get In Touch") | `button-get-in-touch` |

## Installation

### From zip (recommended)
1. Download the latest release zip
2. WordPress admin → **Plugins → Add New → Upload Plugin**
3. Activate

### Manual
1. Copy `testtag-for-wordpress/` into `wp-content/plugins/`
2. Activate via **Plugins → Installed Plugins**

No build step required — `block-editor/build/index.js` ships pre-compiled.

## Configuration

Go to **Settings → TestTag**.

### Attribute key

Set the attribute name to match your framework:

| Framework | Attribute |
|---|---|
| Playwright | `data-testid` |
| Cypress | `data-cy` |
| Selenium / generic | `data-test` |

### Environment guard

By default injects only for logged-in admins and `local` / `development` / `staging` environments. Enable **Force Enable** to inject for all visitors — useful when running automation against a production or staging URL.

### CSS selector map

Explicit selector → tag value mappings for elements outside block content. PHP defaults live in `includes/class-testtag-settings.php`.

## Block editor

When editing any block, open the **Advanced** panel in the sidebar. You'll see a **🏷️ TestTag** field showing the auto-generated value as a placeholder. Type to override — manual values are rendered server-side and take priority.

## Development

```bash
npm install
npm run dev    # watch mode
npm run build  # production build
```

Requires Node.js 18+.

## Usage

```typescript
// Playwright
page.getByTestId('nav-about')
page.getByTestId('input-email-address')
page.getByTestId('button-send-message')

// Cypress (with data-cy attribute key set)
cy.get('[data-cy="nav-about"]')

// Selenium
driver.find_element(By.CSS_SELECTOR, '[data-test="nav-about"]')
```

## License

GPL-2.0-or-later — [Gary Young III](https://garyyoungiii.com)
