import { test, expect } from '@tests/fixtures';
import { TestPage } from '@pageObjects/TestPage';

/**
 * Element Type Tagging — Auto Layer Coverage
 *
 * Verifies that every HTML element type handled by the auto-generate layer
 * receives a tag on the fixture page.  Each test:
 *
 *   1. Locates the element via its expected tag value (page.getByTestId),
 *      which implicitly verifies the correct tag was generated.
 *   2. Asserts data-testtag-layer="auto" to confirm the auto layer tagged it.
 *
 * All locators live on TestPage so tag values are maintained in one place.
 */
test.describe('Element type tagging — auto layer coverage', () => {
  let testPage: TestPage;

  test.beforeEach(async ({ page }) => {
    testPage = new TestPage(page);
    await testPage.open();
  });

  // ── Links ────────────────────────────────────────────────────────────────────

  test('a: href="#" falls through to text fallback and is tagged', async () => {
    await expect(testPage.primaryLink()).toBeVisible();
    await expect(testPage.primaryLink()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('a: nav link is tagged with nav- prefix', async () => {
    await expect(testPage.firstNavLink()).toBeVisible();
    await expect(testPage.firstNavLink()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Buttons ──────────────────────────────────────────────────────────────────

  test('button: is tagged from text content', async () => {
    await expect(testPage.actionButton()).toBeVisible();
    await expect(testPage.actionButton()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Form controls ────────────────────────────────────────────────────────────

  test('input: is tagged from aria-label', async () => {
    await expect(testPage.emailInput()).toBeVisible();
    await expect(testPage.emailInput()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('textarea: is tagged from aria-label', async () => {
    await expect(testPage.sampleTextarea()).toBeVisible();
    await expect(testPage.sampleTextarea()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('select: is tagged from aria-label', async () => {
    await expect(testPage.sampleSelect()).toBeVisible();
    await expect(testPage.sampleSelect()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('form: is tagged from aria-label', async () => {
    await expect(testPage.contactForm()).toBeVisible();
    await expect(testPage.contactForm()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('option: is tagged from select name and value attribute', async () => {
    await expect(testPage.firstSelectOption()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('fieldset: is tagged from id', async () => {
    await expect(testPage.fieldset()).toBeVisible();
    await expect(testPage.fieldset()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Headings ─────────────────────────────────────────────────────────────────

  test('h1: is tagged from text content', async () => {
    await expect(testPage.siteH1()).toBeVisible();
    await expect(testPage.siteH1()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('h2: is tagged from text content', async () => {
    await expect(testPage.selectorMapH2()).toBeVisible();
    await expect(testPage.selectorMapH2()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Paragraphs ───────────────────────────────────────────────────────────────

  test('p: is tagged using nearest tagged ancestor as prefix', async () => {
    await expect(testPage.inlineParagraph()).toBeVisible();
    await expect(testPage.inlineParagraph()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Media ────────────────────────────────────────────────────────────────────

  test('img: is tagged from alt attribute', async () => {
    await expect(testPage.sidebarImage()).toBeVisible();
    await expect(testPage.sidebarImage()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Landmark elements ────────────────────────────────────────────────────────

  test('header: is tagged from id', async () => {
    await expect(testPage.siteHeader()).toBeVisible();
    await expect(testPage.siteHeader()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('nav: is tagged from aria-label', async () => {
    await expect(testPage.primaryNav()).toBeVisible();
    await expect(testPage.primaryNav()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('main: is tagged from id', async () => {
    await expect(testPage.mainContent()).toBeVisible();
    await expect(testPage.mainContent()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('section: is tagged from id', async () => {
    await expect(testPage.inlineSection()).toBeVisible();
    await expect(testPage.inlineSection()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('article: is tagged from aria-label', async () => {
    await expect(testPage.contentArticle()).toBeVisible();
    await expect(testPage.contentArticle()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('aside: is tagged from aria-label', async () => {
    await expect(testPage.sidebarAside()).toBeVisible();
    await expect(testPage.sidebarAside()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('footer: is tagged from id', async () => {
    await expect(testPage.siteFooter()).toBeVisible();
    await expect(testPage.siteFooter()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Lists ────────────────────────────────────────────────────────────────────

  test('ul: is tagged from id', async () => {
    await expect(testPage.unorderedList()).toBeVisible();
    await expect(testPage.unorderedList()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('ol: is tagged from id', async () => {
    await expect(testPage.orderedList()).toBeVisible();
    await expect(testPage.orderedList()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('li: standard list item is tagged from text content', async () => {
    await expect(testPage.firstListItem()).toBeVisible();
    await expect(testPage.firstListItem()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Tables ───────────────────────────────────────────────────────────────────

  test('table: is tagged from id', async () => {
    await expect(testPage.metricsTable()).toBeVisible();
    await expect(testPage.metricsTable()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('tr: is tagged from sibling position, scoped to parent table', async () => {
    await expect(testPage.tableHeaderRow()).toBeVisible();
    await expect(testPage.tableHeaderRow()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('th: is tagged from text content', async () => {
    await expect(testPage.firstTableHeaderCell()).toBeVisible();
    await expect(testPage.firstTableHeaderCell()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('td: is tagged from column position, scoped to parent table', async () => {
    await expect(testPage.firstTableDataCell()).toBeVisible();
    await expect(testPage.firstTableDataCell()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  // ── Details / Summary / Figure ───────────────────────────────────────────────

  test('details: is tagged from id', async () => {
    await expect(testPage.detailsDisclosure()).toBeVisible();
    await expect(testPage.detailsDisclosure()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('summary: is tagged from text content', async () => {
    await expect(testPage.detailsSummary()).toBeVisible();
    await expect(testPage.detailsSummary()).toHaveAttribute('data-testtag-layer', 'auto');
  });

  test('figure: is tagged from figcaption text', async () => {
    await expect(testPage.sidebarFigure()).toBeVisible();
    await expect(testPage.sidebarFigure()).toHaveAttribute('data-testtag-layer', 'auto');
  });
});
