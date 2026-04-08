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

    var config       = window.TESTTAG || {};
    var ATTR         = config.attributeKey || 'data-testid';
    var LAYER_ATTR   = 'data-testtag-layer';
    var selectorMap  = config.selectorMap || [];
    var textFallback = config.textFallback !== false; // true unless explicitly set to false

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

    /**
     * Extracts a stable slug from an href's last path segment.
     * Returns null for anchors, mailto, tel, and bare hosts.
     */
    function hrefPathFragment(href) {
        if (!href || href === '/') return null;
        if (href.charAt(0) === '#') return null;
        if (href.indexOf('mailto:') === 0) return null;
        if (href.indexOf('tel:') === 0) return null;
        try {
            var url = new URL(href, location.href);
            var path = url.pathname.replace(/\/$/, '');
            if (!path || path === '/') return null;
            var parts = path.split('/');
            var segment = parts[parts.length - 1];
            segment = segment.replace(/\.[a-z0-9]+$/i, ''); // strip extension
            var clean = slug(segment);
            return (clean && clean.length > 1) ? clean : null;
        } catch (e) {
            return null;
        }
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

        // Buttons — stable-first: aria-label → id → name → value → text (fallback)
        if (tagName === 'button') {
            var al = el.getAttribute('aria-label');
            if (al) return 'button-' + slug(al);
            if (el.id) {
                var idSlug = slug(el.id);
                if (idSlug && !/^\d+$/.test(idSlug) && idSlug.length > 1) return 'button-' + idSlug;
            }
            var name = el.getAttribute('name');
            if (name) return 'button-' + slug(name);
            var value = el.value;
            if (value) return 'button-' + slug(value);
            if (textFallback) {
                var text = el.textContent.trim();
                if (text) return 'button-' + slug(text);
            }
            return null;
        }

        // Links — stable-first
        if (tagName === 'a') {
            var href     = el.getAttribute('href') || '';
            var linkText = el.textContent.trim();

            if (el.closest('nav, header')) {
                var al = el.getAttribute('aria-label');
                if (al) return 'nav-' + slug(al);
                if (href === '/')               return 'nav-home';
                if (href.startsWith('#'))       return 'nav-' + slug(href.slice(1));
                var frag = hrefPathFragment(href);
                if (frag) return 'nav-' + frag;
                if (textFallback) return 'nav-' + slug(linkText || href);
                return null;
            }
            if (/\.(pdf|docx?|xlsx?|pptx?|zip)$/i.test(href)) {
                var al = el.getAttribute('aria-label');
                if (al) return 'download-' + slug(al);
                if (textFallback && linkText) return 'download-' + slug(linkText);
                return 'download-' + slug(href.split('/').pop());
            }

            // Card-style anchor: wraps block-level content rather than acting as
            // a text link. Scope to nearest tagged ancestor, same as paragraphs.
            if (el.querySelector('div, p, h1, h2, h3, h4, h5, h6, img, figure, article, section, ul, ol')) {
                var ancestor = el.parentElement;
                while (ancestor) {
                    if (ancestor.hasAttribute(ATTR)) {
                        return 'link-' + ancestor.getAttribute(ATTR);
                    }
                    ancestor = ancestor.parentElement;
                }
                return null;
            }

            // Regular link — stable-first
            var al = el.getAttribute('aria-label');
            if (al) return 'link-' + slug(al);
            if (el.id) {
                var idSlug = slug(el.id);
                if (idSlug && !/^\d+$/.test(idSlug) && idSlug.length > 1) return 'link-' + idSlug;
            }
            var frag = hrefPathFragment(href);
            if (frag) return 'link-' + frag;
            if (href.startsWith('#'))   return 'link-' + slug(href.slice(1));
            if (textFallback && linkText) return 'link-' + slug(linkText);
            return null;
        }

        // Landmark elements
        if (['section', 'article', 'aside', 'main', 'header', 'footer'].indexOf(tagName) !== -1) {
            var al = el.getAttribute('aria-label');
            if (al) return tagName + '-' + slug(al);
            if (el.id) {
                var clean = slug(el.id);
                if (clean && !/^\d+$/.test(clean) && clean.length > 1) return tagName + '-' + clean;
            }
            if (textFallback) {
                var h = firstHeadingText(el);
                if (h) return tagName + '-' + slug(h);
            }
            return null;
        }

        // Headings — stable-first: aria-label → id → text (fallback)
        if (/^h[1-6]$/.test(tagName)) {
            var al = el.getAttribute('aria-label');
            if (al) return 'heading-' + slug(al);
            if (el.id) {
                var clean = slug(el.id);
                if (clean && !/^\d+$/.test(clean) && clean.length > 1) return 'heading-' + clean;
            }
            if (textFallback) {
                var text = el.textContent.trim();
                if (text) return 'heading-' + slug(text);
            }
            return null;
        }

        // Paragraphs — prepend the nearest tagged ancestor's value, never embed prose
        if (tagName === 'p') {
            var ancestor = el.parentElement;
            while (ancestor) {
                if (ancestor.hasAttribute(ATTR)) {
                    return 'text-' + ancestor.getAttribute(ATTR);
                }
                ancestor = ancestor.parentElement;
            }
            return null;
        }

        // Forms — stable-first: aria-label → id → legend/heading (fallback)
        if (tagName === 'form') {
            var al = el.getAttribute('aria-label');
            if (al) return 'form-' + slug(al);
            if (el.id) {
                var clean = slug(el.id);
                if (clean && !/^\d+$/.test(clean) && clean.length > 1) return 'form-' + clean;
            }
            if (textFallback) {
                var legend = el.querySelector('legend') || el.querySelector('h1,h2,h3,h4,h5,h6');
                if (legend) {
                    var t = legend.textContent.trim();
                    if (t) return 'form-' + slug(t);
                }
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
            var relVal = el.getAttribute('rel');
            var optValue = relVal || (textFallback ? el.textContent.trim() : '');
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

        // Divs / spans — stable-first: aria-label → id → Elementor/Gutenberg attrs → role
        if (tagName === 'div' || tagName === 'span') {
            // Prefix auto-generated values with role (if present) or HTML tag.
            var prefix = el.getAttribute('role') || tagName;

            // 1. aria-label (most reliable stable source)
            var al = el.getAttribute('aria-label');
            if (al) return prefix + '-' + slug(al);

            // 2. Stable id (non-numeric)
            if (el.id) {
                var clean = slug(el.id);
                if (clean && !/^\d+$/.test(clean) && clean.length > 1) return prefix + '-' + clean;
            }

            // 3. Elementor section/container
            var eType = el.getAttribute('data-element_type');
            if (eType === 'section' || eType === 'container') {
                if (textFallback) {
                    var h = firstHeadingText(el);
                    if (h) return 'section-' + slug(h);
                }
                return null;
            }

            // 4. Elementor widget
            var eWidget = el.getAttribute('data-widget_type');
            if (eWidget) {
                var wType = eWidget.replace(/\.default$/, '').replace(/^wp-widget-/, '');
                var cleaned = slug(wType);
                if (cleaned) return prefix + '-' + cleaned;
                if (textFallback) {
                    var h = firstHeadingText(el);
                    if (h) return prefix + '-' + slug(h);
                }
                return null;
            }

            // 5. Gutenberg blocks — wp-block-* class slug
            var classes = el.className ? el.className.split(/\s+/) : [];
            for (var i = 0; i < classes.length; i++) {
                if (classes[i].indexOf('wp-block-') === 0) {
                    var blockSlug = slug(classes[i].slice('wp-block-'.length));
                    if (blockSlug) return prefix + '-' + blockSlug;
                    if (textFallback) {
                        var h = firstHeadingText(el);
                        if (h) return prefix + '-' + slug(h);
                    }
                    return null;
                }
            }

            // 6. role with text fallback label
            var role = el.getAttribute('role');
            if (role && textFallback) {
                var label = slug(el.textContent.trim().slice(0, 30));
                if (label) return role + '-' + label;
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

    // ── Test-tooling hook ─────────────────────────────────────────
    // Expose the core tag-generation functions via window.TESTTAG so that
    // TestTagFactory (tests/helpers/TestTagFactory.ts) can call the exact
    // same autoId() logic used at runtime rather than re-implementing it.
    if (window.TESTTAG) {
        window.TESTTAG._autoId = autoId;
        window.TESTTAG._slug   = slug;
    }

})();
