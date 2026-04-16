/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import { test as base } from '@playwright/test';

/**
 * The settings profile active for a given test project.
 *
 * Each project in playwright.config.ts supplies its own profile via
 * `use: { testTagSettings: { ... } }`.  Tests use the fixture to derive
 * selectors and assertions dynamically, keeping themselves settings-agnostic.
 */
export type TestTagSettings = {
  /** The WordPress option `testtag_attribute_key` — matches the project's `testIdAttribute`. */
  attributeKey: string;
  /** The WordPress option `testtag_separator` used when generating tag tokens. */
  separator: string;
  /** The WordPress option `testtag_token_order` ('' = default order type,identifier). */
  tokenOrder: string;
};

/**
 * Worker-scoped option fixture.  Declared with `{ scope: 'worker', option: true }`
 * so the value can be supplied once per project in playwright.config.ts and shared
 * across all tests in that worker without repetition.
 */
export const test = base.extend<object, { testTagSettings: TestTagSettings }>({
  testTagSettings: [
    { attributeKey: 'data-testid', separator: '-', tokenOrder: '' },
    { scope: 'worker', option: true },
  ],
});

export { expect } from '@playwright/test';
