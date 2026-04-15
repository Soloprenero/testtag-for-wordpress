import { test, expect } from '@tests/fixtures';
import { FrontendPage } from '@pageObjects/FrontendPage';
import { TEST_URLS } from '@tests/constants';

/**
 * Element Type Tagging — Auto Layer Coverage
 *
 * Verifies that every HTML element type handled by the auto-generate layer
 * receives a tag on the fixture page.  Tests are organised by element
 * category.  For each element we assert:
 *
 *   1. data-testtag-layer="auto" is present (the plugin tagged it)
 *   2. The configured test attribute carries the expected value
 *
 * Stable identifiers (aria-label / id / position-based) use exact-value
 * assertions.  Text-fallback elements use a /^{type}-/ prefix match so
 * minor wording changes do not break the suite.
 *
 * Tag derivation reference (default separator "-"):
 *   get_label_text:  label[for] → aria-label → aria-labelledby
 *   form controls:   label text → name → placeholder
 *   headings:        aria-label → id → text content (fallback)
 *   landmarks:       aria-label → id → first heading (fallback)
 *   lists/tables:    aria-label → id → caption/heading (fallback) / position
 */
test.describe('Element type tagging — auto layer coverage', () => {
  test.beforeEach(async ({ page }) => {
    const frontendPage = new FrontendPage(page);
    await frontendPage.open(TEST_URLS.LAYER_FIXTURE_PAGE);
  });

  // ── Links ────────────────────────────────────────────────────────────────────

  test('a: regular link is tagged link-{aria-label}', async ({ page, testTagSettings }) => {
    // <a href="/contact" aria-label="Contact us"> in #fixture-auto-sample
    const link = page.locator('#fixture-auto-sample a[aria-label="Contact us"]');

    await test.step('link has data-testtag-layer="auto"', async () => {
      await expect(link).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('link tag is link-contact-us (from aria-label)', async () => {
      await expect(link).toHaveAttribute(testTagSettings.attributeKey, 'link-contact-us');
    });
  });

  test('a: nav link is tagged nav-{fragment}', async ({ page, testTagSettings }) => {
    // <a href="#fixture-inline-sample"> inside <nav aria-label="Primary">
    const navLink = page.locator('#fixture-primary-nav a').first();

    await test.step('nav link has data-testtag-layer="auto"', async () => {
      await expect(navLink).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('nav link tag starts with nav-', async () => {
      const tag = await navLink.getAttribute(testTagSettings.attributeKey);
      expect(tag).toMatch(/^nav-/);
    });
  });

  // ── Buttons ──────────────────────────────────────────────────────────────────

  test('button: is tagged button-{text}', async ({ page, testTagSettings }) => {
    // <button type="button">Button action</button> in #fixture-auto-sample
    const btn = page.locator('#fixture-auto-sample button[type="button"]');

    await test.step('button has data-testtag-layer="auto"', async () => {
      await expect(btn).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('button tag is button-button-action (from text content)', async () => {
      await expect(btn).toHaveAttribute(testTagSettings.attributeKey, 'button-button-action');
    });
  });

  // ── Form controls ────────────────────────────────────────────────────────────

  test('input: email input is tagged input-{aria-label}', async ({ page, testTagSettings }) => {
    // <input type="email" aria-label="Email input"> in #fixture-auto-sample
    const input = page.locator('#fixture-auto-sample input[type="email"]');

    await test.step('input has data-testtag-layer="auto"', async () => {
      await expect(input).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('input tag is input-email-input (from aria-label via get_label_text)', async () => {
      await expect(input).toHaveAttribute(testTagSettings.attributeKey, 'input-email-input');
    });
  });

  test('textarea: is tagged textarea-{aria-label}', async ({ page, testTagSettings }) => {
    // <textarea aria-label="Sample textarea"> in #fixture-auto-sample
    const textarea = page.locator('#fixture-auto-sample textarea');

    await test.step('textarea has data-testtag-layer="auto"', async () => {
      await expect(textarea).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('textarea tag is textarea-sample-textarea (from aria-label)', async () => {
      await expect(textarea).toHaveAttribute(testTagSettings.attributeKey, 'textarea-sample-textarea');
    });
  });

  test('select: is tagged select-{aria-label}', async ({ page, testTagSettings }) => {
    // <select id="fixture-select" aria-label="Sample select"> in #fixture-auto-sample
    const select = page.locator('#fixture-select');

    await test.step('select has data-testtag-layer="auto"', async () => {
      await expect(select).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('select tag is select-sample-select (from aria-label)', async () => {
      await expect(select).toHaveAttribute(testTagSettings.attributeKey, 'select-sample-select');
    });
  });

  test('form: is tagged form-{aria-label}', async ({ page, testTagSettings }) => {
    // <form id="fixture-form" aria-label="Contact form"> in #fixture-content-extras
    const form = page.locator('#fixture-form');

    await test.step('form has data-testtag-layer="auto"', async () => {
      await expect(form).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('form tag is form-contact-form (from aria-label)', async () => {
      await expect(form).toHaveAttribute(testTagSettings.attributeKey, 'form-contact-form');
    });
  });

  // ── Headings ─────────────────────────────────────────────────────────────────

  test('h1: is tagged heading-{text}', async ({ page, testTagSettings }) => {
    // <h1>Common Site Elements + Layer Samples</h1> in #fixture-site-header
    const h1 = page.locator('#fixture-site-header h1');

    await test.step('h1 has data-testtag-layer="auto"', async () => {
      await expect(h1).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('h1 tag is heading-common-site-elements-layer-samples', async () => {
      await expect(h1).toHaveAttribute(
        testTagSettings.attributeKey,
        'heading-common-site-elements-layer-samples',
      );
    });
  });

  test('h2: is tagged heading-{text}', async ({ page, testTagSettings }) => {
    // <h2>Selector-map Layer Sample</h2> in #fixture-selector-sample (no pre-authored attrs)
    const h2 = page.locator('#fixture-selector-sample h2');

    await test.step('h2 has data-testtag-layer="auto"', async () => {
      await expect(h2).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('h2 tag is heading-selector-map-layer-sample (from text)', async () => {
      await expect(h2).toHaveAttribute(
        testTagSettings.attributeKey,
        'heading-selector-map-layer-sample',
      );
    });
  });

  // ── Paragraphs ───────────────────────────────────────────────────────────────

  test('p: is tagged text-{nearest-tagged-ancestor}', async ({ page, testTagSettings }) => {
    // <p> in #fixture-inline-sample; nearest tagged ancestor is #fixture-inline-sample
    // which gets section-fixture-inline-sample, so p gets text-section-fixture-inline-sample
    const p = page.locator('#fixture-inline-sample p');

    await test.step('p has data-testtag-layer="auto"', async () => {
      await expect(p).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('p tag starts with text-', async () => {
      const tag = await p.getAttribute(testTagSettings.attributeKey);
      expect(tag).toMatch(/^text-/);
    });
  });

  // ── Media ────────────────────────────────────────────────────────────────────

  test('img: is tagged img-{alt}', async ({ page, testTagSettings }) => {
    // <img alt="Placeholder graphic"> in #fixture-sidebar figure
    const img = page.locator('#fixture-sidebar img');

    await test.step('img has data-testtag-layer="auto"', async () => {
      await expect(img).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('img tag is img-placeholder-graphic (from alt attribute)', async () => {
      await expect(img).toHaveAttribute(testTagSettings.attributeKey, 'img-placeholder-graphic');
    });
  });

  // ── Landmark elements ────────────────────────────────────────────────────────

  test('header: is tagged header-{id}', async ({ page, testTagSettings }) => {
    const header = page.locator('#fixture-site-header');

    await test.step('header has data-testtag-layer="auto"', async () => {
      await expect(header).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('header tag is header-fixture-site-header (from id)', async () => {
      await expect(header).toHaveAttribute(testTagSettings.attributeKey, 'header-fixture-site-header');
    });
  });

  test('nav: is tagged nav-{aria-label}', async ({ page, testTagSettings }) => {
    const nav = page.locator('#fixture-primary-nav');

    await test.step('nav has data-testtag-layer="auto"', async () => {
      await expect(nav).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('nav tag is nav-primary (from aria-label="Primary")', async () => {
      await expect(nav).toHaveAttribute(testTagSettings.attributeKey, 'nav-primary');
    });
  });

  test('main: is tagged main-{id}', async ({ page, testTagSettings }) => {
    const main = page.locator('#fixture-main');

    await test.step('main has data-testtag-layer="auto"', async () => {
      await expect(main).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('main tag is main-fixture-main (from id)', async () => {
      await expect(main).toHaveAttribute(testTagSettings.attributeKey, 'main-fixture-main');
    });
  });

  test('section: is tagged section-{id}', async ({ page, testTagSettings }) => {
    const section = page.locator('#fixture-inline-sample');

    await test.step('section has data-testtag-layer="auto"', async () => {
      await expect(section).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('section tag is section-fixture-inline-sample (from id)', async () => {
      await expect(section).toHaveAttribute(
        testTagSettings.attributeKey,
        'section-fixture-inline-sample',
      );
    });
  });

  test('article: is tagged article-{aria-label}', async ({ page, testTagSettings }) => {
    // <article id="fixture-content" aria-label="Main content">
    const article = page.locator('#fixture-content');

    await test.step('article has data-testtag-layer="auto"', async () => {
      await expect(article).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('article tag is article-main-content (from aria-label)', async () => {
      await expect(article).toHaveAttribute(testTagSettings.attributeKey, 'article-main-content');
    });
  });

  test('aside: is tagged aside-{aria-label}', async ({ page, testTagSettings }) => {
    // <aside id="fixture-sidebar" aria-label="Sidebar">
    const aside = page.locator('#fixture-sidebar');

    await test.step('aside has data-testtag-layer="auto"', async () => {
      await expect(aside).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('aside tag is aside-sidebar (from aria-label)', async () => {
      await expect(aside).toHaveAttribute(testTagSettings.attributeKey, 'aside-sidebar');
    });
  });

  test('footer: is tagged footer-{id}', async ({ page, testTagSettings }) => {
    const footer = page.locator('#fixture-footer');

    await test.step('footer has data-testtag-layer="auto"', async () => {
      await expect(footer).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('footer tag is footer-fixture-footer (from id)', async () => {
      await expect(footer).toHaveAttribute(testTagSettings.attributeKey, 'footer-fixture-footer');
    });
  });

  // ── Lists ────────────────────────────────────────────────────────────────────

  test('ul: is tagged list-{id}', async ({ page, testTagSettings }) => {
    const ul = page.locator('#fixture-ul');

    await test.step('ul has data-testtag-layer="auto"', async () => {
      await expect(ul).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('ul tag is list-fixture-ul (from id)', async () => {
      await expect(ul).toHaveAttribute(testTagSettings.attributeKey, 'list-fixture-ul');
    });
  });

  test('ol: is tagged list-{id}', async ({ page, testTagSettings }) => {
    const ol = page.locator('#fixture-ol');

    await test.step('ol has data-testtag-layer="auto"', async () => {
      await expect(ol).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('ol tag is list-fixture-ol (from id)', async () => {
      await expect(ol).toHaveAttribute(testTagSettings.attributeKey, 'list-fixture-ol');
    });
  });

  test('li: standard list item is tagged item-{text}', async ({ page, testTagSettings }) => {
    const li = page.locator('#fixture-ul li').first();

    await test.step('li has data-testtag-layer="auto"', async () => {
      await expect(li).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('li tag starts with item-', async () => {
      const tag = await li.getAttribute(testTagSettings.attributeKey);
      expect(tag).toMatch(/^item-/);
    });
  });

  // ── Tables ───────────────────────────────────────────────────────────────────

  test('table: is tagged table-{id}', async ({ page, testTagSettings }) => {
    const table = page.locator('#fixture-table');

    await test.step('table has data-testtag-layer="auto"', async () => {
      await expect(table).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('table tag is table-fixture-table (from id)', async () => {
      await expect(table).toHaveAttribute(testTagSettings.attributeKey, 'table-fixture-table');
    });
  });

  test('tr: is tagged row-{position}', async ({ page, testTagSettings }) => {
    const tr = page.locator('#fixture-table thead tr').first();

    await test.step('tr has data-testtag-layer="auto"', async () => {
      await expect(tr).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('tr tag is row-1 (first sibling position)', async () => {
      await expect(tr).toHaveAttribute(testTagSettings.attributeKey, 'row-1');
    });
  });

  test('th: is tagged col-{text}', async ({ page, testTagSettings }) => {
    const th = page.locator('#fixture-table th').first();

    await test.step('th has data-testtag-layer="auto"', async () => {
      await expect(th).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('th tag starts with col-', async () => {
      const tag = await th.getAttribute(testTagSettings.attributeKey);
      expect(tag).toMatch(/^col-/);
    });
  });

  test('td: is tagged cell-{column-position}', async ({ page, testTagSettings }) => {
    const td = page.locator('#fixture-table tbody td').first();

    await test.step('td has data-testtag-layer="auto"', async () => {
      await expect(td).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('td tag is cell-1 (first column)', async () => {
      await expect(td).toHaveAttribute(testTagSettings.attributeKey, 'cell-1');
    });
  });

  // ── Select options ───────────────────────────────────────────────────────────

  test('option: is tagged option-{select-name}-{value}', async ({ page, testTagSettings }) => {
    // <option value="option-a"> inside <select name="fixture-select">
    const option = page.locator('#fixture-select option').first();

    await test.step('option has data-testtag-layer="auto"', async () => {
      await expect(option).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('option tag is option-fixture-select-option-a (select name + value)', async () => {
      await expect(option).toHaveAttribute(
        testTagSettings.attributeKey,
        'option-fixture-select-option-a',
      );
    });
  });

  // ── Fieldset / Details / Figure ──────────────────────────────────────────────

  test('fieldset: is tagged fieldset-{id}', async ({ page, testTagSettings }) => {
    const fieldset = page.locator('#fixture-fieldset');

    await test.step('fieldset has data-testtag-layer="auto"', async () => {
      await expect(fieldset).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('fieldset tag is fieldset-fixture-fieldset (from id)', async () => {
      await expect(fieldset).toHaveAttribute(testTagSettings.attributeKey, 'fieldset-fixture-fieldset');
    });
  });

  test('details: is tagged details-{id}', async ({ page, testTagSettings }) => {
    const details = page.locator('#fixture-details');

    await test.step('details has data-testtag-layer="auto"', async () => {
      await expect(details).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('details tag is details-fixture-details (from id)', async () => {
      await expect(details).toHaveAttribute(testTagSettings.attributeKey, 'details-fixture-details');
    });
  });

  test('summary: is tagged summary-{text}', async ({ page, testTagSettings }) => {
    const summary = page.locator('#fixture-details summary');

    await test.step('summary has data-testtag-layer="auto"', async () => {
      await expect(summary).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('summary tag starts with summary-', async () => {
      const tag = await summary.getAttribute(testTagSettings.attributeKey);
      expect(tag).toMatch(/^summary-/);
    });
  });

  test('figure: is tagged figure-{figcaption}', async ({ page, testTagSettings }) => {
    const figure = page.locator('#fixture-sidebar figure');

    await test.step('figure has data-testtag-layer="auto"', async () => {
      await expect(figure).toHaveAttribute('data-testtag-layer', 'auto');
    });

    await test.step('figure tag starts with figure-', async () => {
      const tag = await figure.getAttribute(testTagSettings.attributeKey);
      expect(tag).toMatch(/^figure-/);
    });
  });
});
