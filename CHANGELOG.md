# Changelog

All notable changes to TestTag for WordPress are documented in this file.

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
