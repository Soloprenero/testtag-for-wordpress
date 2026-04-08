import type { Page } from '@playwright/test';

/**
 * Extends the global window type to include the TESTTAG plugin object and
 * the internal functions exposed for test tooling.
 */
declare global {
  interface Window {
    TESTTAG?: {
      attributeKey?: string;
      selectorMap?: Array<{ selector: string; testid: string }>;
      textFallback?: boolean;
      debug?: boolean;
      /** Exposed by dynamic-injector.js for TestTagFactory. */
      _autoId?: (el: HTMLElement) => string | null;
      /** Exposed by dynamic-injector.js for TestTagFactory. */
      _slug?: (str: string) => string;
    };
  }
}

/**
 * TestTagFactory
 *
 * A test-data factory that computes expected test-tag values by hooking
 * directly into the same autoId() function used by the plugin's JS dynamic
 * injector (js/dynamic-injector.js).
 *
 * The factory calls window.TESTTAG._autoId() — a reference to the real
 * runtime function — so any change to the plugin's tag-generation logic is
 * automatically reflected in the expected values produced by tests.
 *
 * Usage:
 *
 *   const factory = new TestTagFactory(page);
 *
 *   // Compute the expected tag for any HTML string:
 *   const tag = await factory.computeTag(
 *     '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>'
 *   );
 *   // → 'button-subscribe-newsletter'
 *
 *   // Or use the static helper when you already have a Page reference:
 *   const tag = await TestTagFactory.computeTagOn(page, '<h2 id="features">Features</h2>');
 *   // → 'heading-features'
 *
 * Requirements:
 *   - The TestTag plugin must be active on the page.
 *   - The page must have loaded dynamic-injector.js (any frontend or admin
 *     page served by WordPress with the plugin enabled).
 *
 * How it hooks into the plugin:
 *   dynamic-injector.js exposes `window.TESTTAG._autoId` and
 *   `window.TESTTAG._slug` at the end of its IIFE so this factory can call
 *   the exact same functions without duplicating the logic.
 */
export class TestTagFactory {
  private readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  /**
   * Compute the auto-generated test tag for an HTML element string.
   *
   * Calls the plugin's autoId() function in the browser context, so the
   * result is always consistent with what the dynamic injector would produce.
   *
   * @param html - Outer HTML of the element to evaluate.
   *   Examples:
   *     '<button aria-label="Sign Up">Sign Up</button>'
   *     '<a href="/docs/getting-started">Docs</a>'
   *     '<h2 id="hero-heading">Welcome</h2>'
   * @returns The generated tag value, or null when the plugin would not tag
   *   the element (e.g. a hidden input, a link with no stable attributes and
   *   text-fallback disabled).
   */
  async computeTag(html: string): Promise<string | null> {
    return this.page.evaluate((htmlStr: string) => {
      const autoId = window.TESTTAG?._autoId;
      if (typeof autoId !== 'function') {
        throw new Error(
          'TESTTAG._autoId is not available. ' +
          'Ensure the TestTag plugin is active and dynamic-injector.js is loaded on this page.'
        );
      }

      const wrapper = document.createElement('div');
      wrapper.innerHTML = htmlStr;
      const el = wrapper.firstElementChild as HTMLElement | null;
      return el ? autoId(el) : null;
    }, html);
  }

  /**
   * Static convenience wrapper — same as `new TestTagFactory(page).computeTag(html)`.
   *
   * @param page - A Playwright Page that has the TestTag plugin loaded.
   * @param html - Outer HTML of the element to evaluate.
   */
  static async computeTagOn(page: Page, html: string): Promise<string | null> {
    return new TestTagFactory(page).computeTag(html);
  }
}
