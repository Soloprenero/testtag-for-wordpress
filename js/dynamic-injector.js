/**
 * TestTag for WordPress — Dynamic Injector
 *
 * Watches for DOM mutations and applies the same two-layer tagging
 * logic (selector map → auto-generate) to dynamically inserted elements:
 * AJAX content, infinite scroll, modals, live search results, etc.
 *
 * Rules:
 *  - Never overwrites an existing attribute — server-side always wins.
 *  - Dedup is tracked independently from server-side tags. A dynamic
 *    element may share a value with a server-tagged element; scope your
 *    locator to resolve the collision.
 *  - All dynamically tagged elements receive data-testtag-layer="dynamic".
 */
(function () {
    'use strict';

    var config      = window.TESTTAG || {};
    var ATTR        = config.attributeKey || 'data-testid';
    var LAYER_ATTR  = 'data-testtag-layer';
    var selectorMap = config.selectorMap || [];

    // ── Dedup (dynamic elements only, scoped to parent) ──────────
    // Counters reset per parent element so sibling containers each get
    // clean values — e.g. every product card gets "post-title" rather
    // than "post-title-2", "post-title-3" across the whole page.
    var seenByParent = new WeakMap();

    function dedupValue(el, value) {
        var parent = el.parentElement || document.body;
        if (!seenByParent.has(parent)) {
            seenByParent.set(parent, Object.create(null));
        }
        var seen = seenByParent.get(parent);
        if (!seen[value]) {
            seen[value] = 1;
            return value;
        }
        seen[value]++;
        return value + '-' + seen[value];
    }

    // ── Tag a single element ──────────────────────────────────────
    function tag(el, value) {
        if (!value || el.hasAttribute(ATTR)) return;
        el.setAttribute(ATTR, dedupValue(el, value));
        el.setAttribute(LAYER_ATTR, 'dynamic');
    }

    // ── Helpers ───────────────────────────────────────────────────
    function slug(str) {
        return (str || '')
            .toLowerCase()
            .replace(/<[^>]+>/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);
    }

    function getLabelText(el) {
        var id = el.id;
        if (id) {
            var label = document.querySelector('label[for="' + CSS.escape(id) + '"]');
            if (label) return label.textContent.trim();
        }
        return el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    }

    function firstHeadingText(el) {
        var h = el.querySelector('h1,h2,h3,h4,h5,h6');
        return h ? h.textContent.trim() : '';
    }

    // ── Auto-generate a value for an element ─────────────────────
    function autoId(el) {
        var tagName = el.tagName.toLowerCase();

        // Form controls
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            var type  = (el.getAttribute('type') || tagName).toLowerCase();
            var hint  = getLabelText(el) || el.getAttribute('name') || el.getAttribute('placeholder') || '';
            if (type === 'hidden')                            return null;
            if (type === 'search')                            return 'input-search';
            if (type === 'submit' || type === 'button')       return 'button-' + slug(el.value || hint || 'submit');
            if (type === 'checkbox')                          return 'checkbox-' + slug(hint);
            if (type === 'radio')                             return 'radio-'    + slug(hint);
            if (tagName === 'select')                         return 'select-'   + slug(hint);
            if (tagName === 'textarea')                       return 'textarea-' + slug(hint);
            return 'input-' + slug(hint || type);
        }

        // Buttons
        if (tagName === 'button') {
            var text = el.textContent.trim() || el.getAttribute('aria-label') || el.value || '';
            return 'button-' + slug(text);
        }

        // Links
        if (tagName === 'a') {
            var href     = el.getAttribute('href') || '';
            var linkText = el.textContent.trim();
            if (el.closest('nav, header')) {
                if (href === '/')               return 'nav-home';
                if (href.startsWith('#'))       return 'nav-' + slug(href.slice(1));
                return 'nav-' + slug(linkText || href);
            }
            if (/\.(pdf|docx?|xlsx?|pptx?|zip)$/i.test(href)) {
                return 'download-' + slug(linkText || href.split('/').pop());
            }

            // Card-style anchor: wraps block-level content rather than acting as
            // a text link. Scope to nearest tagged ancestor, same as paragraphs.
            if (el.querySelector('div, p, h1, h2, h3, h4, h5, h6, img, figure, article, section, ul, ol')) {
                var ancestor = el.parentElement;
                while (ancestor) {
                    if (ancestor.hasAttribute(ATTR)) {
                        return ancestor.getAttribute(ATTR) + '-link';
                    }
                    ancestor = ancestor.parentElement;
                }
                return null;
            }

            if (linkText)               return 'link-' + slug(linkText);
            if (href.startsWith('#'))   return 'link-' + slug(href.slice(1));
            return null;
        }

        // Landmark elements
        if (['section', 'article', 'aside', 'main', 'header', 'footer'].indexOf(tagName) !== -1) {
            var id = el.id;
            if (id) {
                var clean = slug(id);
                if (clean && !/^\d+$/.test(clean) && clean.length > 1) return tagName + '-' + clean;
            }
            var h = firstHeadingText(el);
            if (h) return tagName + '-' + slug(h);
            var al = el.getAttribute('aria-label');
            if (al) return tagName + '-' + slug(al);
            return null;
        }

        // Headings
        if (/^h[1-6]$/.test(tagName)) {
            var text = el.textContent.trim();
            return text ? tagName + '-' + slug(text) : null;
        }

        // Paragraphs — prepend the nearest tagged ancestor's value, never embed prose
        if (tagName === 'p') {
            var ancestor = el.parentElement;
            while (ancestor) {
                if (ancestor.hasAttribute(ATTR)) {
                    return ancestor.getAttribute(ATTR) + '-text';
                }
                ancestor = ancestor.parentElement;
            }
            return null;
        }

        // Forms
        if (tagName === 'form') {
            var legend = el.querySelector('legend') || el.querySelector('h1,h2,h3,h4,h5,h6');
            if (legend) {
                var t = legend.textContent.trim();
                if (t) return 'form-' + slug(t);
            }
            var id = el.id;
            if (id) {
                var clean = slug(id);
                if (clean && !/^\d+$/.test(clean) && clean.length > 1) return 'form-' + clean;
            }
            return 'form';
        }

        // Images
        if (tagName === 'img') {
            var alt = el.getAttribute('alt');
            return alt ? 'img-' + slug(alt) : null;
        }

        // Custom select options (li inside a select-like list)
        if (tagName === 'li') {
            var optValue = el.getAttribute('rel') || el.textContent.trim();
            if (!optValue) return null;
            var optSlug = slug(optValue);
            if (!optSlug) return null;
            // Walk up to find a data-name wrapper or sibling <select>
            var selectName = null;
            var parent = el.parentElement;
            while (parent) {
                if (parent.hasAttribute('data-name')) {
                    selectName = parent.getAttribute('data-name');
                    break;
                }
                var sel = parent.querySelector(':scope > select[name]');
                if (sel) { selectName = sel.getAttribute('name'); break; }
                parent = parent.parentElement;
            }
            return selectName ? 'option-' + slug(selectName) + '-' + optSlug : 'option-' + optSlug;
        }

        // Divs / spans — Elementor, Gutenberg, id/role fallbacks
        if (tagName === 'div' || tagName === 'span') {
            // Prefix auto-generated values with role (if present) or HTML tag.
            var prefix = el.getAttribute('role') || tagName;

            var eType = el.getAttribute('data-element_type');
            if (eType === 'section' || eType === 'container') {
                var h = firstHeadingText(el);
                if (h) return 'section-' + slug(h);
                var al = el.getAttribute('aria-label');
                if (al) return 'section-' + slug(al);
                return null;
            }

            var eWidget = el.getAttribute('data-widget_type');
            if (eWidget) {
                var h = firstHeadingText(el);
                if (h) return prefix + '-' + slug(h);
                var al = el.getAttribute('aria-label');
                if (al) return prefix + '-' + slug(al);
                var wType = eWidget.replace(/\.default$/, '').replace(/^wp-widget-/, '');
                var cleaned = slug(wType);
                return cleaned ? prefix + '-' + cleaned : null;
            }

            // Gutenberg blocks
            var classes = el.className ? el.className.split(/\s+/) : [];
            for (var i = 0; i < classes.length; i++) {
                if (classes[i].indexOf('wp-block-') === 0) {
                    var h = firstHeadingText(el);
                    if (h) return prefix + '-' + slug(h);
                    var blockSlug = slug(classes[i].slice('wp-block-'.length));
                    return blockSlug ? prefix + '-' + blockSlug : null;
                }
            }

            var id = el.id;
            if (id) {
                var clean = slug(id);
                if (clean && !/^\d+$/.test(clean) && clean.length > 1) return 'container-' + clean;
            }

            var role = el.getAttribute('role');
            if (role) {
                var label = el.id || slug(el.textContent.trim().slice(0, 30));
                return role + '-' + slug(label);
            }
        }

        return null;
    }

    // ── Selector target list (mirrors PHP auto_generate targets) ──
    var AUTO_SELECTOR = [
        'a', 'button',
        'input', 'textarea', 'select', 'form',
        'section', 'article', 'aside', 'main', 'header', 'footer',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'p',
        'img',
        '[id]', '[role]',
        '[data-element_type]', '[data-widget_type]',
        '[class*="wp-block-"]',
        'ul[class*="select"] li', 'ul[class*="options"] li',
        'li[rel]',
    ].join(', ');

    // ── Process a newly added subtree ─────────────────────────────
    function processSubtree(root) {
        // Layer 1 — selector map
        selectorMap.forEach(function (entry) {
            if (!entry.selector || !entry.testid) return;
            try {
                if (root.matches && root.matches(entry.selector)) {
                    tag(root, entry.testid);
                }
                root.querySelectorAll(entry.selector).forEach(function (el) {
                    tag(el, entry.testid);
                });
            } catch (e) { /* invalid selector — skip */ }
        });

        // Layer 2 — auto-generate
        try {
            if (root.matches && root.matches(AUTO_SELECTOR)) {
                tag(root, autoId(root));
            }
            root.querySelectorAll(AUTO_SELECTOR).forEach(function (el) {
                tag(el, autoId(el));
            });
        } catch (e) { /* selector error — skip */ }
    }

    // ── MutationObserver ──────────────────────────────────────────
    var pending = [];
    var timer   = null;

    var observer = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            m.addedNodes.forEach(function (node) {
                if (node.nodeType === 1) pending.push(node);
            });
        });

        if (!pending.length || timer !== null) return;

        // Batch all pending nodes into a single animation frame.
        timer = requestAnimationFrame(function () {
            var batch = pending.splice(0);
            timer = null;
            batch.forEach(processSubtree);
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

})();
