=== TestTag for WordPress ===
Contributors: garyyoungiii
Donate link: https://soloprenero.com/buy/testtag-for-wordpress/
Tags: testing, playwright, cypress, selenium, qa
Requires at least: 6.0
Tested up to: 6.9
Requires PHP: 8.0
Stable tag: 1.5.1-beta
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Automatically add stable test attributes like data-testid to WordPress pages for Playwright, Cypress, Selenium, and other UI automation tools.

== Description ==

TestTag for WordPress helps you create reliable selectors for automated UI testing by tagging elements with configurable data attributes.

It uses four injection layers in priority order:

1. Inline attributes already present in markup (server-rendered)
2. CSS selector map overrides
3. Auto-generated tags from element semantics
4. Dynamic injector for elements added after page load

An existing attribute is never overwritten.

= Key features =

* Configurable attribute key (data-testid, data-cy, data-test, or custom data-*)
* Auto-generation for links, controls, forms, headings, landmarks, and more
* CSS selector map for explicit overrides
* Block editor field for per-block manual tags
* Audit Mode overlay with tooltip, legend, and keyboard toggle (Alt+Shift+T)
* Dynamic injector for AJAX/infinite-scroll content via MutationObserver
* Export/import settings as JSON
* Presets for common plugins (WooCommerce, Contact Form 7, Gravity Forms)
* Pay-what-you-want support link in plugin Contribute tab

= Common use cases =

* Create stable selectors for end-to-end tests
* Reduce brittle text/css-path selectors in CI
* Validate tag coverage visually using Audit Mode
* Standardize test attributes across teams

== Installation ==

1. Upload the plugin folder to /wp-content/plugins/ or install via Plugins > Add New.
2. Activate TestTag for WordPress.
3. Go to Tools > TestTag.
4. Set your attribute key and selector map as needed.

== Frequently Asked Questions ==

= Does it work with Elementor and classic themes? =

Yes. It supports Gutenberg, Elementor, and classic themes.

= Will it overwrite existing test attributes? =

No. Existing attributes are preserved.

= Can I use data-cy instead of data-testid? =

Yes. Set the attribute key in Tools > TestTag.

= Is it safe for production sites? =

By default, injection is limited to admins and local/development/staging. You can enable Force Enable when needed for production testing.

== Screenshots ==

1. Settings screen with attribute key and selector map
2. Audit Mode tooltip and layer legend on front-end
3. Block editor sidebar field for manual per-block tags
4. Preset cards for supported plugins

== Changelog ==

= 1.5.1-beta =
* Security: replaced wp_redirect() with wp_safe_redirect() throughout settings handlers
* Security: added sanitization callbacks to register_setting() for force-enable and text-fallback options
* Security: validate tmp_name with is_uploaded_file() before reading in import handler
* Security: escape loop index with absint() in selector map HTML output

= 1.5.0-beta =
* Inline CSS selector validation in Selector Map: unsupported patterns (`:has()`, `:is()`, `:not()`, sibling combinators, etc.) are flagged with a red border and error message as you type
* Pre-save blocking: form save is prevented when any selector is invalid; a dismissible error banner is shown and auto-clears once all errors are resolved
* Collapsible guidance panel listing supported and unsupported selector patterns with inline code examples
* Selector map row alignment changed to top-align so CSS selector and tag value inputs always stay paired left-to-right when error messages expand the row
* Drag-and-drop Tag Format builder with per-gap separators and live HTML preview
* Extended element type coverage: ul, ol, li, table, tr, th, td, option, nav, fieldset, details, summary, figure in both PHP and JS injectors
* 8 format tokens: type, role, identifier, aria-label, aria-labelledby, placeholder, id, name
* Settings page About tab renamed to Contribute; About card renamed to Overview

= 1.4.1 =
* CI/release hardening only (no runtime plugin behavior changes)
* Updated GitHub Actions for Node 24 transition readiness
* Improved release packaging validation and required-file manifest checks
* Excluded non-runtime project files from release zip artifacts

= 1.4.1-beta =
* Improved card-style anchor and paragraph naming behavior
* Scoped dedup per parent container

= 1.4.0 =
* Added settings export/import
* Added dynamic injector for mutation-based DOM updates

== Upgrade Notice ==

= 1.4.1 =
Maintenance release focused on CI/release pipeline reliability.
