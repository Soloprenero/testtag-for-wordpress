# Changelog

All notable changes to TestTag for WordPress are documented in this file.

## [Unreleased] — CSS Selector Validation in Settings UI

### Added / Changed

- **Inline validation** (`admin/admin.js`): Each CSS selector input in the Selector Map is validated as the user types. Unsupported patterns (`:has()`, `:is()`, `:where()`, `:nth-child()` and relatives, `:not()`, sibling combinators `+`/`~`, and pseudo-elements `::before`/`::after`) are highlighted with a red border and an inline error message describing the issue and suggesting an alternative.
- **Pre-save blocking** (`admin/admin.js`): The form `submit` handler re-validates all selector inputs before saving. If any input is invalid, the save is blocked (`e.preventDefault()`), the page scrolls to the first offending field, and a dismissible `notice-error` banner is inserted above the form. The banner includes a `.notice-dismiss` button that removes it on click and also auto-clears when all inline errors are resolved — no second save attempt needed.
- **Guidance panel** (`includes/class-testtag-settings.php`): A collapsible `<details>` element ("Supported & unsupported selector patterns") is displayed above the selector table. It lists supported patterns (type selectors, class, ID, attribute selectors, descendant, child) and unsupported ones with inline code examples, helping users author compatible selectors upfront.
- **Row alignment** (`admin/admin.css`): Selector map table cells changed from `vertical-align: middle` to `vertical-align: top` so the CSS selector and tag value inputs stay top-anchored when an error message expands the row height, keeping the left-to-right pairing visually unambiguous.
- **Semantic color labels** (`admin/admin.css`): New `.testtag-supported-label` (green) and `.testtag-unsupported-label` (red) styles replace emoji in the guidance panel, improving accessibility.
- **E2E tests** (`tests/e2e/configuration/selector-validation.spec.ts`): Six Playwright tests covering: guidance panel visibility, inline error for `:has()`, inline error for sibling combinator, save-blocked banner appearance and manual dismiss, and clean pass for valid selectors.

---

## [Unreleased] — Extended Element Type Tagging Coverage

### Fixed / Added

- **Expanded auto-tagging to cover all common HTML elements** in both the PHP processor and JS dynamic injector. Previously untagged elements and their generated tag formats:
  - `<ul>` / `<ol>` → `list-{aria-label|id|heading}`; `<li>` → `item-{aria-label|id|text}` (previously only tagged inside custom select lists)
  - `<table>` → `table-{aria-label|id|caption}`; `<tr>` → `row-{position}`; `<th>` → `col-{text}`; `<td>` → `cell-{column}`
  - `<option>` → `option-{select-name}-{value}` (native select options were not tagged at all)
  - `<nav>` → `nav-{aria-label|id|heading}` (was missing from targets entirely)
  - `<fieldset>` → `fieldset-{aria-label|id|legend}`; `<details>` → `details-{aria-label|id|summary}`; `<summary>` → `summary-{aria-label|id|text}`; `<figure>` → `figure-{aria-label|id|figcaption}`

---

## [Unreleased] — Configurable Test Tag String Format

### Settings UI — Tag Format Builder

- **Drag-and-drop token builder**: replaced the previous checkbox/radio separator/type-prefix controls with a visual drag-and-drop builder. Tokens are dragged from the Palette into the Active zone to compose the tag value formula.
- **Per-gap separators**: each gap between active tokens shows a clickable `-`/`_` toggle, letting users set a different separator between every pair of tokens independently.
- **Flat token palette**: all 8 format tokens are displayed together in a single bucket (no TYPE/IDENTIFIER category dividers):
  - `type` — auto-detected element type (e.g. `button`, `heading`, `input`)
  - `role` — explicit `[role]` attribute, or implicit ARIA role inferred from element tag
  - `identifier` — smart best-of fallback: aria-label → id → text content
  - `aria-label` — raw `[aria-label]` attribute value
  - `aria-labelledby` — resolved text of referenced element(s)
  - `placeholder` — `[placeholder]` attribute value
  - `id` — `[id]` attribute value
  - `name` — `[name]` attribute value
- **Custom literal text chips**: users can type any alphanumeric text (a–z, A–Z, 0–9) directly into the active zone to add a verbatim string constant (shown as amber chips) alongside attribute tokens.
- **↺ Reset button**: restores token order to `type,identifier` and separator to `-` in one click, without a page reload.
- **Formula-bar layout**: the attribute name input is inline with the active zone in a single compact row, eliminating stacked field blocks.
- **Default separator field**: renamed from "Slug separator" to "Default separator" with a clarified description: _replaces spaces in auto-generated attribute values (e.g. "Search Field" → `search-field`)_.
- **Two-column card layout**: left column (wide) holds the attribute name, separator dropdown, active zone, and HTML preview; right column holds the token palette. Stacks vertically on narrow screens.
- **Card heading** renamed from "Attribute Key" to "Test Tag Format".
- **Active zone horizontal scroll**: `overflow-x: auto` prevents the active zone from overflowing when many tokens are added.

### Live HTML Preview

- **HTML textarea**: pre-populated with a representative `<input>` element covering all 8 token types with unique attribute values; users can paste any element HTML and see the generated tag value update in real time.
- **Live update**: changing tokens, per-gap separators, or the global separator re-evaluates the preview instantly.

### PHP Injector (`class-testtag-html-processor.php`)

- **`element_token_values()`**: new helper extracts and slugifies all relevant attribute values (`role`, `aria-label`, resolved `aria-labelledby`, `placeholder`, `id`, `name`) from each element, including implicit ARIA role inference.
- **`format_id()` updated**: accepts an optional `$token_values` array of per-token values; custom literal tokens (`lit:text`) are included verbatim. Backward-compatible fallback to `$identifier` for tokens without an explicit value.
- **`role` implicit ARIA inference**: `<button>` → `button`, `<nav>` → `navigation`, `<input type="checkbox">` → `checkbox`, `<select>` → `combobox`, `<h1>`–`<h6>` → `heading`, etc.

### JS Runtime Injector (`js/dynamic-injector.js`)

- **`elementDetails()`**: new helper mirrors `element_token_values()` for live DOM elements, resolving `aria-labelledby` via `document.getElementById()` and inferring implicit ARIA role.
- **`formatId()` updated**: accepts a `details` object of per-token values; custom literal tokens (`lit:text`) are included verbatim.

### Admin Preview (`admin/admin.js`)

- **`valuesFromEl()`**: extracts per-token attribute values from parsed preview HTML, including implicit ARIA role inference.
- **`detectType()`**: fixed to return `'img'` for `<img>` elements (matches PHP/JS injector output).
- **`detectIdentifier()`**: fallback order aligned with PHP auto-id logic: label[for] → aria-label → resolved aria-labelledby → placeholder → name → id → text content.
- **Attribute name field**: restricted to web-safe characters (a-z, 0-9, hyphens) with live validation feedback.

### Tests

- **13 new Playwright e2e tests** in `tests/e2e/configuration/string-format.spec.ts` covering: separator variants, PHP↔JS parity, token order, per-gap separators, and live HTML preview behaviour.
- **`TestTagSettingsPage` helpers**: `setStringFormat({ separator, tokenOrder, formatSeps })` and `restoreDefaultStringFormat()` added to the page object.

---

## [1.4.1] - 2026-04-04

### Changed
- CI/release hardening only (no runtime plugin behavior changes).
- Updated GitHub Actions versions and Node 24 transition handling.
- Added strict release zip validation using required-file manifest checks.
- Excluded non-runtime project files from release zip artifacts.

## [1.4.1-beta] - 2026-04-04

### Added
- Buy / Donate support link in the plugin About tab.
- Pay-what-you-want explanation in the About tab.
- Support section in README with a pay-what-you-want link.
- New project-level CHANGELOG.md and CONTRIBUTORS.md files.

### Changed
- Version metadata updated to 1.4.1-beta in plugin and package manifests.
- Dynamic injector naming now matches server-side HTML processor naming for consistency:
  - Card-style wrapped links use link-{ancestor}
  - Headings use heading-{slug}
  - Paragraphs use text-{ancestor}
  - div/span ID fallback uses role-or-tag prefix
- README file map updated to reflect current includes/ and js/ structure.
- .history/ ignored in git to keep release packages clean.

## [1.4.0] - 2026-03-21

### Added
- Export / Import Settings JSON flow.
- Dynamic injector for mutation-driven DOM updates.

### Changed
- Dynamic injection keeps server-side precedence and avoids overwriting existing test attributes.
