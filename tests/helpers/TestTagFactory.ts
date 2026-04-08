// eslint-disable-next-line @typescript-eslint/no-var-requires
const tagEngine = require('../../js/tag-engine.js') as {
  computeTag: (html: string, attrKey?: string) => string | null;
};

/**
 * TestTagFactory
 *
 * A pure Node.js test-data factory that computes expected test-tag values
 * by calling the same tag-generation logic used by the plugin's dynamic
 * injector (js/dynamic-injector.js via js/tag-engine.js).
 *
 * No browser, no Playwright page, no page.evaluate() required.  The
 * factory imports js/tag-engine.js directly through Node.js require(), so
 * any change to the plugin's tag-generation algorithm is automatically
 * reflected in the expected values produced by tests.
 *
 * Usage:
 *
 *   const factory = new TestTagFactory();
 *
 *   // Compute the expected tag for any HTML string:
 *   const tag = await factory.computeTag(
 *     '<button aria-label="Subscribe Newsletter" type="button">Subscribe</button>'
 *   );
 *   // → 'button-subscribe-newsletter'
 *
 *   // Or use the static helper:
 *   const tag = await TestTagFactory.computeTagFor(
 *     '<h2 id="features">Features</h2>'
 *   );
 *   // → 'heading-features'
 *
 * How it hooks into the plugin:
 *   js/tag-engine.js exports the same slug(), autoId(), and computeTag()
 *   functions that run in the browser via dynamic-injector.js.  The
 *   factory calls computeTag() directly, which uses parseHtml() to build
 *   a VirtualElement from the HTML string — no DOM needed.
 */
export class TestTagFactory {
  /**
   * Compute the auto-generated test tag for an HTML element string.
   *
   * @param html    Outer HTML of the element to evaluate.
   *   Examples:
   *     '<button aria-label="Sign Up">Sign Up</button>'
   *     '<a href="/docs/getting-started">Docs</a>'
   *     '<h2 id="hero-heading">Welcome</h2>'
   * @param attrKey Attribute key used by the plugin, defaults to 'data-testid'.
   * @returns The generated tag value, or null when the plugin would not tag
   *   the element.
   */
  computeTag(html: string, attrKey?: string): string | null {
    return tagEngine.computeTag(html, attrKey);
  }

  /**
   * Static convenience wrapper.
   *
   * @param html    Outer HTML of the element to evaluate.
   * @param attrKey Attribute key, defaults to 'data-testid'.
   */
  static computeTagFor(html: string, attrKey?: string): string | null {
    return new TestTagFactory().computeTag(html, attrKey);
  }

  /**
   * Backwards-compatible static helper — previously accepted a Playwright
   * Page as the first argument.  That argument is now ignored; the factory
   * is entirely browser-free.
   *
   * @deprecated Use computeTagFor() instead.
   */
  static computeTagOn(_page: unknown, html: string, attrKey?: string): string | null {
    return new TestTagFactory().computeTag(html, attrKey);
  }
}
