# TestTag for WordPress

**Stop manually tagging your blocks.**

I hate manually adding `data-testid` attributes to every button, input, and container across a dynamic WordPress site. It's a tiring, repetitive chore that slows down your development cycle, litters your markup, and is usually the first thing to break when a layout changes. 

I built **TestTag** because I disliked that manual process. This plugin gets **99% of the job done for you** in a highly configurable way. It automatically tags any element on your WordPress site with test attributes for Playwright, Cypress, Selenium, or any automation framework that queries the DOM. 

Whether you are using Gutenberg, Elementor, classic themes, or writing your own HTML, TestTag intelligently handles the heavy lifting so you can focus on writing tests, not markup.

## Support the Project

TestTag is an open-source labor of love. If this plugin saves you hours of tedious manual tagging and makes your test suites more resilient, please consider giving back to ensure its ongoing development. 

You can help keep this project alive by:

1. **Donating:** [Support the plugin financially by donating (PWYW)](https://soloprenero.com/buy/testtag-for-wordpress/). Paid supporters are immortalized in our `Contributors.md` file!
2. **Starring the Repo:** A simple GitHub star helps other developers discover the tool.
3. **Contributing:** Code is only half the battle. You can contribute by submitting feature ideas, reporting bugs, or opening pull requests.
---

## How it Works: The Three-Layer System

TestTag ensures comprehensive coverage without breaking your existing setup. It uses three injection layers applied in a strict priority order. **TestTag is completely non-destructive: an existing attribute is never overwritten.** Higher priority layers always win.

| Layer | What it covers | Priority |
| :--- | :--- | :--- |
| **1. Block Editor Sidebar** | Any Gutenberg block (manual override). | **Highest** — Server-rendered. |
| **2. CSS Selector Map** | Nav, footers, widgets, Elementor sections. | Applied first client-side. |
| **3. Auto-Generation** | Everything else. | Fills in the remaining gaps. |

---

## Core Features

* **Configurable Attribute Key:** Seamlessly match your framework. Choose from `data-testid`, `data-cy`, `data-test`, or define any custom `data-*` attribute.
* **Intelligent Auto-Generation:** Infers highly meaningful IDs directly from element semantics (labels, placeholders, inner text, anchors).
* **CSS Selector Map:** Create explicit overrides for hard-to-target theme elements, navigation menus, widgets, or complex Elementor sections.
* **Block Editor Integration:** A dedicated Gutenberg sidebar panel allows for per-block manual overrides, complete with an auto-generated preview.
* **Environment Guard:** Built for safety. By default, it only injects tags for logged-in admins and non-production environments (`local`, `development`, `staging`). 
* **Elementor Aware:** Smart enough to handle deep nesting by reading `data-element_type` and `data-widget_type` attributes.

---

## Audit Mode (v1.1.0)

Stop guessing if your elements are targetable. Audit Mode provides a visual overlay that highlights every tagged element on the page, allowing you to verify your test coverage at a glance.

**Activate via:**
* **Admin Bar:** Click the **Audit Mode** button on the front-end (visible to logged-in admins).
* **Keyboard Shortcut:** Press **Alt+Shift+T** (works anywhere).

**What the overlay reveals:**
Every tagged element receives a colored border and a badge displaying its tag value. Hovering over any element reveals a tooltip showing:
* The exact tag value.
* The attribute key in use (e.g., `data-testid`).
* Which layer injected the tag (Block Editor, Selector Map, or Auto-generated).
* The raw element descriptor (`tag#id.class`).

**Layer Color Legend:**
The legend sits neatly in the bottom-right corner while Audit Mode is active.
* **Purple:** Block Editor (Server-rendered)
* **Blue:** CSS Selector Map
* **Green:** Auto-generated

*Note: Audit Mode state persists across page navigations within the same browser session via `sessionStorage`. The entire overlay is built inside a **shadow DOM**, ensuring its styles are fully isolated and never interfere with your page's actual CSS.*

---

## Settings & Configuration

Navigate to **Settings → TestTag** in your `wp-admin` dashboard to configure the plugin:

* **Attribute Key:** Set the target attribute (`data-testid` for Playwright, `data-cy` for Cypress, `data-test` for Selenium, etc.).
* **Force Enable:** Override the environment guard to inject tags for all visitors on all environments—perfect for running automation suites against a live staging or production URL.
* **CSS Selector Map:** Add, edit, remove, or reset your explicit `selector → tag` mappings. (PHP defaults live safely in `includes/class-testtag-settings.php`).

### Block Editor Manual Overrides
When editing any block in Gutenberg, open the **Advanced** panel in the sidebar. You'll find a **TestTag** field displaying the auto-generated value as a placeholder. Simply type to override it. Manual values are rendered server-side and take absolute priority.

---

## Auto-Generated ID Examples

TestTag's auto-generation engine is designed to create human-readable, predictable identifiers:

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

Once TestTag is running, your automation scripts become incredibly clean and resilient. 

Because TestTag generates highly predictable and semantic IDs, it perfectly complements the **Page Object Model (POM)** design pattern. We highly recommend using POM to map out your tagged elements into reusable classes. This keeps your tests DRY, easy to read, and immune to UI layout changes.

### Playwright Example (Using POM)

```typescript
// 1. Map your page objects using TestTag's predictable IDs
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

1. Copy the testtag-for-wordpress/ folder into your wp-content/plugins/ directory.

2. Activate it via Plugins → Installed Plugins.
