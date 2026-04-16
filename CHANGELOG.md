# Changelog

All notable changes to TestTag for WordPress are documented in this file.

## [1.5.0-beta] - 2026-04-16

### Added

- **Copyright notices** — Added copyright headers to all PHP, JS, TypeScript, and CSS source files. Copyright belongs to Gary Young III (https://garyyoungiii.com) / Soloprenero (https://soloprenero.com).
- **CSS Selector Validation** — Inline validation as the user types in the Selector Map. Unsupported patterns (`:has()`, `:is()`, `:where()`, `:nth-child()` and relatives, `:not()`, sibling combinators `+`/`~`, and pseudo-elements `::before`/`::after`) are highlighted with a red border and an inline error message.
- **Pre-save blocking**: The save is blocked if any selector input is invalid, with a dismissible error banner and auto-scroll to the first offending field.
- **Guidance panel**: A collapsible "Supported & unsupported selector patterns" panel above the selector table.
- **E2E tests** for selector validation (`tests/e2e/configuration/selector-validation.spec.ts`).
- **Extended element type tagging**: Auto-tagging now covers `<ul>`/`<ol>`, `<li>`, `<table>`, `<tr>`, `<th>`, `<td>`, `<option>`, `<nav>`, `<fieldset>`, `<details>`, `<summary>`, `<figure>` in both PHP and JS injectors.
- **Drag-and-drop Tag Format builder**: Replaced checkbox/radio controls with a visual token builder. Tokens are dragged from the Palette into the Active zone.
- **Per-gap separators**: Each gap between active tokens shows a clickable `-`/`_` toggle.
- **8 format tokens**: `type`, `role`, `identifier`, `aria-label`, `aria-labelledby`, `placeholder`, `id`, `name`.
- **Custom literal text chips**: Verbatim string constants in the active zone.
- **↺ Reset button**: Restores default `type,identifier` with `-` separator.
- **Live HTML preview**: Pre-populated textarea; tag value updates in real time as tokens/separators change.
- **`element_token_values()` / `elementDetails()`**: New PHP/JS helpers for per-token attribute extraction including implicit ARIA role inference.
- **Playwright e2e tests** for string format configuration in `tests/e2e/configuration/string-format.spec.ts`.

### Changed

- `format_id()` (PHP) and `formatId()` (JS) accept per-token values and custom literal tokens (`lit:text`).
- Default separator field renamed from "Slug separator" to "Default separator".
- Card heading renamed from "Attribute Key" to "Test Tag Format".
- Row alignment in selector map table changed to `vertical-align: top`.
- Semantic color labels (`.testtag-supported-label` / `.testtag-unsupported-label`) replace emoji in guidance panel.
- Settings page: "About" card heading renamed to "Overview" (plugin summary); "About" tab renamed to "Contribute" (author info, license, changelog).

### Fixed

- **`clean()`**: Guard against an empty `$strip_segments` list (missing or empty `naming-rules.json` would produce a malformed regex that incorrectly matched empty strings between separators).
- **`element_token_values()`**: `aria-labelledby` XPath lookup now uses `xpath_quote()` instead of a manual `str_replace` that did not handle single-quote characters in element IDs.
- **`auto_id()`**: Deferred `element_token_values()` (which runs XPath queries) until after the `type=hidden` early-return so hidden inputs never incur that overhead.
- **Readability**: Moved orphaned `element_token_values()` docblock to sit directly above the function (was misplaced before `inferred_aria_role()`).
- **Readability**: Split inline `$ti = PHP_INT_MAX; $ii = PHP_INT_MAX;` onto separate lines in `get_type_position()`.
- **Best practice**: All `echo self::OPTION_*` constant names used as HTML `name=` attribute values now go through `esc_attr()`.

---

## [1.4.1] - 2026-04-04

### Changed
- CI/release hardening only (no runtime plugin behavior changes).
- Updated GitHub Actions versions and Node 24 transition handling.
- Added strict release zip validation using required-file manifest checks.
- Excluded non-runtime project files from release zip artifacts.

## [1.4.1-beta] - 2026-04-04

### Added
- Buy / Donate support link in the plugin Contribute tab.
- Pay-what-you-want explanation in the Contribute tab.
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
