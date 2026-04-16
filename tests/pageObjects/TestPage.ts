/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
import type { Locator, Page } from '@playwright/test';
import { FrontendPage } from '@pageObjects/FrontendPage';
import { TEST_URLS } from '@tests/constants';

/**
 * Page object for the seeded layer-fixture page (/test-page/).
 *
 * Every locator uses page.getByTestId() with the expected auto-generated tag
 * value, so the correct test attribute is always used for the active settings
 * profile (data-testid, data-cy, etc.).
 *
 * Where multiple elements share the same generated tag (e.g. row-1, cell-1),
 * the locator is scoped to its parent element to avoid ambiguity.
 *
 * Tag derivation at a glance (default separator "-"):
 *   aria-label / get_label_text  →  slug              (highest priority)
 *   id                           →  clean(slug)
 *   caption / legend / figcaption / summary  →  slug  (text fallback)
 *   sibling position             →  "1", "2", …       (tr / td)
 */
export class TestPage extends FrontendPage {
  protected pageUrl = TEST_URLS.LAYER_FIXTURE_PAGE;

  constructor(page: Page) {
    super(page);
  }

  override async open(): Promise<void> {
    await super.open(TEST_URLS.LAYER_FIXTURE_PAGE);
  }

  // ── Links ──────────────────────────────────────────────────────────────────

  /** <a href="#">Primary link</a> → link-primary-link (empty fragment falls through to text) */
  primaryLink(): Locator { return this.page.getByTestId('link-primary-link'); }

  /** First <a> inside <nav aria-label="Primary"> → nav-fixture-inline-sample */
  firstNavLink(): Locator { return this.page.getByTestId('nav-fixture-inline-sample'); }

  // ── Buttons ────────────────────────────────────────────────────────────────

  /** <button type="button">Button action</button> → button-button-action */
  actionButton(): Locator { return this.page.getByTestId('button-button-action'); }

  // ── Form controls ──────────────────────────────────────────────────────────

  /** <input type="email" aria-label="Email input"> → input-email-input */
  emailInput(): Locator { return this.page.getByTestId('input-email-input'); }

  /** <textarea aria-label="Sample textarea"> → textarea-sample-textarea */
  sampleTextarea(): Locator { return this.page.getByTestId('textarea-sample-textarea'); }

  /** <select aria-label="Sample select"> → select-sample-select */
  sampleSelect(): Locator { return this.page.getByTestId('select-sample-select'); }

  /** <form aria-label="Contact form"> → form-contact-form */
  contactForm(): Locator { return this.page.getByTestId('form-contact-form'); }

  /** <option value="option-a"> inside #fixture-select → option-fixture-select-option-a */
  firstSelectOption(): Locator { return this.page.getByTestId('option-fixture-select-option-a'); }

  /** <fieldset id="fixture-fieldset"> → fieldset-fixture-fieldset */
  fieldset(): Locator { return this.page.getByTestId('fieldset-fixture-fieldset'); }

  // ── Headings ───────────────────────────────────────────────────────────────

  /** <h1>Common Site Elements + Layer Samples</h1> → heading-common-site-elements-layer-samples */
  siteH1(): Locator { return this.page.getByTestId('heading-common-site-elements-layer-samples'); }

  /** <h2>Selector-map Layer Sample</h2> (no pre-authored attrs) → heading-selector-map-layer-sample */
  selectorMapH2(): Locator { return this.page.getByTestId('heading-selector-map-layer-sample'); }

  // ── Paragraphs ─────────────────────────────────────────────────────────────

  /** <p> inside #fixture-inline-sample; nearest tagged ancestor → section-fixture-inline-sample */
  inlineParagraph(): Locator { return this.page.getByTestId('text-section-fixture-inline-sample'); }

  // ── Media ──────────────────────────────────────────────────────────────────

  /** <img alt="Placeholder graphic"> → img-placeholder-graphic */
  sidebarImage(): Locator { return this.page.getByTestId('img-placeholder-graphic'); }

  /** <figure> in #fixture-sidebar; figcaption "Image and caption sample." → figure-image-and-caption-sample */
  sidebarFigure(): Locator { return this.page.getByTestId('figure-image-and-caption-sample'); }

  // ── Landmarks ─────────────────────────────────────────────────────────────

  /** <header id="fixture-site-header"> → header-fixture-site-header */
  siteHeader(): Locator { return this.page.getByTestId('header-fixture-site-header'); }

  /** <nav aria-label="Primary"> → nav-primary */
  primaryNav(): Locator { return this.page.getByTestId('nav-primary'); }

  /** <main id="fixture-main"> → main-fixture-main */
  mainContent(): Locator { return this.page.getByTestId('main-fixture-main'); }

  /** <section id="fixture-inline-sample"> → section-fixture-inline-sample */
  inlineSection(): Locator { return this.page.getByTestId('section-fixture-inline-sample'); }

  /** <article id="fixture-content" aria-label="Main content"> → article-main-content */
  contentArticle(): Locator { return this.page.getByTestId('article-main-content'); }

  /** <aside id="fixture-sidebar" aria-label="Sidebar"> → aside-sidebar */
  sidebarAside(): Locator { return this.page.getByTestId('aside-sidebar'); }

  /** <footer id="fixture-footer"> → footer-fixture-footer */
  siteFooter(): Locator { return this.page.getByTestId('footer-fixture-footer'); }

  // ── Lists ──────────────────────────────────────────────────────────────────

  /** <ul id="fixture-ul"> → list-fixture-ul */
  unorderedList(): Locator { return this.page.getByTestId('list-fixture-ul'); }

  /** <ol id="fixture-ol"> → list-fixture-ol */
  orderedList(): Locator { return this.page.getByTestId('list-fixture-ol'); }

  /** First <li> in #fixture-ul; text "Unordered list item" → item-unordered-list-item */
  firstListItem(): Locator { return this.page.getByTestId('item-unordered-list-item'); }

  // ── Tables ─────────────────────────────────────────────────────────────────

  /** <table id="fixture-table"> → table-fixture-table */
  metricsTable(): Locator { return this.page.getByTestId('table-fixture-table'); }

  /**
   * First <tr> in #fixture-table (thead row); sibling position 1 → row-1.
   * Scoped to the table because multiple tables on a page each produce their
   * own row-1.
   */
  tableHeaderRow(): Locator { return this.metricsTable().getByTestId('row-1').first(); }

  /** First <th>; text "Metric" → col-metric */
  firstTableHeaderCell(): Locator { return this.page.getByTestId('col-metric'); }

  /**
   * First <td> in #fixture-table; column position 1 → cell-1.
   * Scoped to the table because every table row produces its own cell-1.
   */
  firstTableDataCell(): Locator { return this.metricsTable().getByTestId('cell-1').first(); }

  // ── Details / Summary ──────────────────────────────────────────────────────

  /** <details id="fixture-details"> → details-fixture-details */
  detailsDisclosure(): Locator { return this.page.getByTestId('details-fixture-details'); }

  /** <summary>Toggle FAQ</summary> inside #fixture-details → summary-toggle-faq */
  detailsSummary(): Locator { return this.page.getByTestId('summary-toggle-faq'); }
}
