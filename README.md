# Test ID Auto Injector

**Stop manually tagging your blocks.**

I hate manually adding `data-testid` attributes to every button, input, and container across a dynamic WordPress site. It's a tiring, repetitive chore that slows down your development cycle, litters your markup, and is usually the first thing to break when a layout changes. 

**Test ID Auto Injector**  gets **99% of the job done for you** in a highly configurable way. It automatically tags any element on your WordPress site with test attributes for Playwright, Cypress, Selenium, or any automation framework that queries the DOM. 

Whether you are using Gutenberg, Elementor, classic themes, or writing your own HTML, Test ID Auto Injector intelligently handles the heavy lifting so you can focus on writing tests, not markup.

## Support the Project

Test ID Auto Injector is an open-source labor of love. If this plugin saves you hours of tedious manual tagging and makes your test suites more resilient, please consider giving back to ensure its ongoing development. 

You can help keep this project alive by:

1. **Donating:** [Support the plugin financially by donating (PWYW)](https://soloprenero.com/buy/testtag-for-wordpress/). Paid supporters are immortalized in our `Contributors.md` file!
2. **Starring the Repo:** A simple GitHub star helps other developers discover the tool.
3. **Contributing:** Code is only half the battle. You can contribute by submitting feature ideas, reporting bugs, or opening pull requests.
---

## How it Works: The Four-Layer System

Test ID Auto Injector applies tags through four layers. **Test ID Auto Injector is completely non-destructive: an existing attribute is never overwritten.** Each layer only applies to untagged elements.

| Layer | What it covers | When applied |
| :--- | :--- | :--- |
| **1. Inline** | Hardcoded attributes already present in markup (`data-testid`, `data-cy`, etc.). | Existing in initial HTML. |
| **2. Selector Map** | Explicit `selector -> value` mappings from settings. | Server-render + dynamic pass. |
| **3. Auto** | Generated values inferred from element semantics. | Server-render + dynamic pass fallback. |
| **4. Dynamic** | Elements inserted after initial render via JavaScript/AJAX. | MutationObserver after page load. |

---

## Core Features

* **Configurable Attribute Key:** Seamlessly match your framework. Choose from `data-testid`, `data-cy`, `data-test`, or define any custom `data-*` attribute.
* **Inline Attributes:** Keep direct, handwritten `data-*` values in your markup for exact control.
* **Selector Map:** Explicit `selector → tag` mappings for hard-to-target theme elements (nav, footers, widgets, Elementor sections). Unsupported selector patterns (`:has()`, `:is()`, sibling combinators, etc.) are flagged with inline errors as you type, and saving is blocked until all errors are resolved. A collapsible guidance panel lists supported and unsupported patterns with examples.
* **Auto Layer:** Fill in everything else with predictable semantic IDs.
* **Dynamic Layer:** Automatically tags elements added to the page via JavaScript after initial load.
* **Environment Guard:** Built for safety. By default, it only injects tags for logged-in admins and non-production environments (`local`, `development`, `staging`). 
* **Elementor Aware:** Smart enough to handle deep nesting by reading `data-element_type` and `data-widget_type` attributes.

---

## Audit Mode

Stop guessing if your elements are targetable. Audit Mode provides a visual overlay that highlights every tagged element on the page, allowing you to verify your test coverage at a glance.

**Activate via:**
* **Admin Bar:** Click the **Audit Mode** button on the front-end (visible to logged-in admins).
* **Keyboard Shortcut:** Press **Alt+Shift+T** (works anywhere).

**What the overlay reveals:**
Every tagged element receives a colored border and a badge displaying its tag value. Hovering over any element reveals a tooltip showing:
* The exact tag value.
* The attribute key in use (e.g., `data-testid`).
* Which layer applied the tag (Inline, Selector Map, Auto, or Dynamic).
* The raw element descriptor (`tag#id.class`).

**Layer Color Legend:**
The legend sits neatly in the bottom-right corner while Audit Mode is active, showing the order layers are applied:
* 🔴**Red:** Inline (hardcoded in HTML)
* 🔵**Blue:** Selector Map (CSS selector-based)
* 🟢**Green:** Auto (semantic fallback tagging)
* 🟣**Purple:** Dynamic (JavaScript-added elements)

*Note: Audit Mode state persists across page navigations within the same browser session via `sessionStorage`. The entire overlay is built inside a **shadow DOM**, ensuring its styles are fully isolated and never interfere with your page's actual CSS.*

---

## Settings & Configuration

Navigate to **Settings → Test ID Auto Injector** in your `wp-admin` dashboard to configure the plugin:

* **Attribute Key:** Set the target attribute (`data-testid` for Playwright, `data-cy` for Cypress, `data-test` for Selenium, etc.).
* **Force Enable:** Override the environment guard to inject tags for all visitors on all environments—perfect for running automation suites against a live staging or production URL.
* **CSS Selector Map:** Add, edit, remove, or reset your explicit `selector → tag` mappings. (PHP defaults live safely in `includes/class-testtag-settings.php`).

---

## Auto-Generated ID Examples

Test ID Auto Injector's auto-generation engine is designed to create human-readable, predictable identifiers:

| Element | Generated Value |
| :--- | :--- |
| `<input placeholder="Email Address">` | `input-email-address` |
| `<input type="checkbox" name="agree">` | `checkbox-agree` |
| `<button>Send Message</button>` | `button-send-message` |
| `<a href="#about-me">` (inside nav) | `nav-about-me` |
| `<a href="resume.pdf">Download CV</a>` | `download-download-cv` |
| `<section id="experience">` | `section-experience` |
| `<h2>Professional Experience</h2>` | `h2-professional-experience` |
| Elementor widget | `widget-heading` |
| `core/button` block ("Get In Touch") | `button-get-in-touch` |

---

## Usage in Testing Frameworks (Page Object Model)

Once Test ID Auto Injector is running, your automation scripts become incredibly clean and resilient. 

Because Test ID Auto Injector generates highly predictable and semantic IDs, it perfectly complements the **Page Object Model (POM)** design pattern. We highly recommend using POM to map out your tagged elements into reusable classes. This keeps your tests DRY, easy to read, and immune to UI layout changes.

### Playwright Example (Using POM)

```typescript
// 1. Map your page objects using Test ID Auto Injector's predictable IDs
class ContactPage {
  constructor(page) {
    this.page = page;
    this.navAbout = page.getByTestId('nav-about');
    this.emailInput = page.getByTestId('input-email-address');
    this.submitButton = page.getByTestId('button-send-message');
  }

  async navigateToAbout() {
    await this.navAbout.click();
  }

  async submitContactForm(email) {
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }
}

// 2. Write beautifully clean tests
test('user can submit contact form', async ({ page }) => {
  const contactPage = new ContactPage(page);
  await contactPage.submitContactForm('test@example.com');
});
```
### Direct Selectors (Cypress & Selenium)

If you aren't using POM yet, querying the DOM directly is still vastly improved:

```javascript
// Cypress (with data-cy attribute key set)
cy.get('[data-cy="button-send-message"]').click()
```
* Python

Selenium (Python)
```python
driver.find_element(By.CSS_SELECTOR, '[data-test="button-send-message"]').click()
```
## Installation
### From Zip (Recommended)

* Download the latest release .zip file.

1. In your WordPress admin, go to Plugins → Add New → Upload Plugin.
2. Upload the .zip and click Activate.

### Manual Installation

1. Copy the testtag-for-wp/ folder into your wp-content/plugins/ directory.

2. Activate it via Plugins → Installed Plugins.

## License

This plugin is licensed under the [GNU General Public License v2 or later](LICENSE) (GPL-2.0-or-later).
