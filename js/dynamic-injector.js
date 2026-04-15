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
    var separator    = (config.separator === '_') ? '_' : '-';
    var tokenOrder = (config.tokenOrder || 'type,identifier').split(',').filter(Boolean);
    var formatSeps = (config.formatSeps || separator).split(',');
    var namingRules  = config.namingRules || { stripPrefixes: [], stripSegments: [] };

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
        return value + separator + seen[value];
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
            .replace(/[^a-z0-9]+/g, separator)
            .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '')
            .slice(0, 50);
    }

    /**
     * Strips common framework prefixes and generic structural segments from a
     * slugified string. Mirrors PHP clean() in class-testtag-html-processor.php,
     * consuming the same rules from window.TESTTAG.namingRules (naming-rules.json).
     */
    function clean(s) {
        if (!s) return s;
        var prefixes = namingRules.stripPrefixes || [];
        var segments = namingRules.stripSegments || [];
        var sepEsc   = separator.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
        // Strip leading framework prefix (first match only).
        // Prefixes in the JSON are defined with hyphens; translate to the current separator.
        for (var pi = 0; pi < prefixes.length; pi++) {
            var pfx = prefixes[pi].replace(/-/g, separator);
            if (s.indexOf(pfx) === 0) {
                s = s.slice(pfx.length);
                break;
            }
        }
        // Strip standalone segment tokens separated by the current separator.
        if (segments.length) {
            var segRe = new RegExp('(?:^|' + sepEsc + ')(' + segments.join('|') + ')(?=' + sepEsc + '|$)', 'g');
            s = s.replace(segRe, '');
        }
        // Collapse repeated separators and trim.
        s = s.replace(new RegExp(sepEsc + '{2,}', 'g'), separator);
        // Trim leading/trailing separator.
        return s.replace(new RegExp('^' + sepEsc + '+|' + sepEsc + '+$', 'g'), '');
    }

    /** Slugifies an id attribute value then strips framework noise via clean(). */
    function cleanId(id) {
        return clean(slug(id));
    }

    /**
     * Builds a formatted tag value from a semantic type and an identifier,
     * applying the configured separator and type position.
     *
     * `details` is optional and may provide explicit values for supported
     * format tokens, e.g. { role, 'aria-label', 'aria-labelledby', placeholder, id, name }.
     */
    function formatId(type, identifier, details) {
        var TYPE_TOKENS = ['type', 'role'];
        var IDENT_TOKENS = ['identifier', 'aria-label', 'aria-labelledby', 'placeholder', 'id', 'name'];
        var meta = details || {};

        var values = {
            'type': '',
            'role': meta.role || '',
            'identifier': '',
            'aria-label': meta['aria-label'] || '',
            'aria-labelledby': meta['aria-labelledby'] || '',
            'placeholder': meta.placeholder || '',
            'id': meta.id || '',
            'name': meta.name || ''
        };

        // Assign the passed type to the first active type-class token
        // unless that token already has an explicit value from `details`.
        for (var ti = 0; ti < tokenOrder.length; ti++) {
            if (TYPE_TOKENS.indexOf(tokenOrder[ti]) !== -1) {
                if (!values[tokenOrder[ti]]) {
                    values[tokenOrder[ti]] = type;
                }
                break;
            }
        }

        // Assign the fallback identifier to the first identifier-class token
        // unless that token already has an explicit value from `details`.
        for (var fi = 0; fi < tokenOrder.length; fi++) {
            if (IDENT_TOKENS.indexOf(tokenOrder[fi]) !== -1) {
                if (!values[tokenOrder[fi]]) {
                    values[tokenOrder[fi]] = identifier;
                }
                break;
            }
        }

        // Preserve legacy behavior when no type-class token is active.
        if (!values.type && !values.role && type) {
            values.type = type;
        }

        // Preserve legacy behavior when no identifier-class token is active.
        if (
            !values.identifier &&
            !values['aria-label'] &&
            !values['aria-labelledby'] &&
            !values.placeholder &&
            !values.id &&
            !values.name &&
            identifier
        ) {
            values.identifier = identifier;
        }
        // Build output; track original token indices for per-gap separators.
        var parts = [], partIndices = [];
        for (var i = 0; i < tokenOrder.length; i++) {
            var val;
            if (/^lit:[a-zA-Z0-9]+$/.test(tokenOrder[i])) {
                val = tokenOrder[i].slice(4);
            } else {
                val = values[tokenOrder[i]] || '';
            }
            if (val) {
                parts.push(val);
                partIndices.push(i);
            }
        }

        if (!parts.length) return type;

        var result = parts[0];
        for (var k = 1; k < parts.length; k++) {
            var gapSep = formatSeps[partIndices[k] - 1] || separator;
            result += gapSep + parts[k];
        }
        return result;
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

    /**
     * Extracts slugified per-token attribute values from a live DOM element.
     * Provides explicit values for concrete format tokens so formatId() can
     * use the right attribute when the user has configured a specific token.
     *
     * For aria-labelledby, referenced element texts are resolved via getElementById.
     */
    function inferredAriaRole(el) {
        var tag  = el.tagName ? el.tagName.toLowerCase() : '';
        var type = (el.getAttribute && el.getAttribute('type') || '').toLowerCase();
        var map  = {
            'button': 'button', 'a': 'link', 'nav': 'navigation', 'main': 'main',
            'header': 'banner', 'footer': 'contentinfo', 'aside': 'complementary',
            'article': 'article', 'section': 'region', 'form': 'form',
            'dialog': 'dialog', 'table': 'table', 'textarea': 'textbox',
            'ul': 'list', 'ol': 'list', 'li': 'listitem', 'img': 'img',
            'figure': 'figure', 'details': 'group', 'summary': 'button',
            'fieldset': 'group', 'meter': 'meter', 'progress': 'progressbar',
            'output': 'status', 'hr': 'separator',
            'h1': 'heading', 'h2': 'heading', 'h3': 'heading',
            'h4': 'heading', 'h5': 'heading', 'h6': 'heading'
        };
        if (tag === 'input') {
            var inputMap = {
                'button': 'button', 'submit': 'button', 'reset': 'button', 'image': 'button',
                'checkbox': 'checkbox', 'radio': 'radio', 'range': 'slider',
                'number': 'spinbutton', 'search': 'searchbox',
                'email': 'textbox', 'tel': 'textbox', 'text': 'textbox',
                'url': 'textbox', 'password': 'textbox', '': 'textbox'
            };
            return inputMap[type] !== undefined ? inputMap[type] : 'textbox';
        }
        if (tag === 'select') {
            return (el.multiple || parseInt(el.getAttribute('size') || '0', 10) > 1) ? 'listbox' : 'combobox';
        }
        return map[tag] || '';
    }

    function elementDetails(el) {
        var d = {};

        var role = (el.getAttribute && el.getAttribute('role')) || inferredAriaRole(el);
        if (role) d.role = slug(role);

        var al = el.getAttribute && el.getAttribute('aria-label');
        if (al) d['aria-label'] = slug(al);

        var albIds = (el.getAttribute && el.getAttribute('aria-labelledby') || '').trim();
        if (albIds) {
            var parts = [];
            albIds.split(/\s+/).forEach(function(id) {
                var ref = document.getElementById(id);
                if (ref) {
                    var t = (ref.textContent || '').trim();
                    if (t) parts.push(t);
                }
            });
            var albVal = parts.length ? slug(parts.join(' ')) : slug(albIds);
            if (albVal) d['aria-labelledby'] = albVal;
        }

        var ph = el.getAttribute && el.getAttribute('placeholder');
        if (ph) d.placeholder = slug(ph);

        if (el.id) d.id = slug(el.id);

        var name = el.getAttribute && el.getAttribute('name');
        if (name) d.name = slug(name);

        return d;
    }

    // ── Auto-generate a value for an element ─────────────────────
    function autoId(el) {
        var tagName = el.tagName.toLowerCase();
        var details = elementDetails(el);

        // Form controls
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            var type  = (el.getAttribute('type') || tagName).toLowerCase();
            var hint  = getLabelText(el) || el.getAttribute('name') || el.getAttribute('placeholder') || '';
            if (type === 'hidden')                            return null;
            if (type === 'search')                            return formatId('input', 'search', details);
            if (type === 'submit' || type === 'button')       return formatId('button', slug(el.value || hint || 'submit'), details);
            if (type === 'checkbox')                          return formatId('checkbox', slug(hint), details);
            if (type === 'radio')                             return formatId('radio',    slug(hint), details);
            if (tagName === 'select')                         return formatId('select',   slug(hint), details);
            if (tagName === 'textarea')                       return formatId('textarea', slug(hint), details);
            return formatId('input', slug(hint || type), details);
        }

        // Buttons — stable-first: aria-label → id → name → value → text (fallback)
        if (tagName === 'button') {
            var al = el.getAttribute('aria-label');
            if (al) return formatId('button', slug(al), details);
            if (el.id) {
                var idSlug = cleanId(el.id);
                if (idSlug && !/^\d+$/.test(idSlug) && idSlug.length > 1) return formatId('button', idSlug, details);
            }
            var name = el.getAttribute('name');
            if (name) return formatId('button', slug(name), details);
            var value = el.value;
            if (value) return formatId('button', slug(value), details);
            if (textFallback) {
                var text = el.textContent.trim();
                if (text) return formatId('button', slug(text), details);
            }
            return null;
        }

        // Links — stable-first
        if (tagName === 'a') {
            var href     = el.getAttribute('href') || '';
            var linkText = el.textContent.trim();

            if (el.closest('nav, header')) {
                var al = el.getAttribute('aria-label');
                if (al) return formatId('nav', slug(al), details);
                if (href === '/')               return formatId('nav', 'home', details);
                if (href.startsWith('#'))       return formatId('nav', slug(href.slice(1)), details);
                var frag = hrefPathFragment(href);
                if (frag) return formatId('nav', frag, details);
                if (textFallback) return formatId('nav', slug(linkText || href), details);
                return null;
            }
            if (/\.(pdf|docx?|xlsx?|pptx?|zip)$/i.test(href)) {
                var al = el.getAttribute('aria-label');
                if (al) return formatId('download', slug(al), details);
                if (textFallback && linkText) return formatId('download', slug(linkText), details);
                return formatId('download', slug(href.split('/').pop()), details);
            }

            // Card-style anchor: wraps block-level content rather than acting as
            // a text link. Scope to nearest tagged ancestor, same as paragraphs.
            if (el.querySelector('div, p, h1, h2, h3, h4, h5, h6, img, figure, article, section, ul, ol')) {
                var ancestor = el.parentElement;
                while (ancestor) {
                    if (ancestor.hasAttribute(ATTR)) {
                        return formatId('link', ancestor.getAttribute(ATTR), details);
                    }
                    ancestor = ancestor.parentElement;
                }
                return null;
            }

            // Regular link — stable-first
            var al = el.getAttribute('aria-label');
            if (al) return formatId('link', slug(al), details);
            if (el.id) {
                var idSlug = cleanId(el.id);
                if (idSlug && !/^\d+$/.test(idSlug) && idSlug.length > 1) return formatId('link', idSlug, details);
            }
            var frag = hrefPathFragment(href);
            if (frag) return formatId('link', frag, details);
            if (href.startsWith('#'))   return formatId('link', slug(href.slice(1)), details);
            if (textFallback && linkText) return formatId('link', slug(linkText), details);
            return null;
        }

        // Landmark elements
        if (['section', 'article', 'aside', 'main', 'header', 'footer'].indexOf(tagName) !== -1) {
            var al = el.getAttribute('aria-label');
            if (al) return formatId(tagName, slug(al), details);
            if (el.id) {
                var idClean = cleanId(el.id);
                if (idClean && !/^\d+$/.test(idClean) && idClean.length > 1) return formatId(tagName, idClean, details);
            }
            if (textFallback) {
                var h = firstHeadingText(el);
                if (h) return formatId(tagName, slug(h), details);
            }
            return null;
        }

        // Headings — stable-first: aria-label → id → text (fallback)
        if (/^h[1-6]$/.test(tagName)) {
            var al = el.getAttribute('aria-label');
            if (al) return formatId('heading', slug(al), details);
            if (el.id) {
                var idClean = cleanId(el.id);
                if (idClean && !/^\d+$/.test(idClean) && idClean.length > 1) return formatId('heading', idClean, details);
            }
            if (textFallback) {
                var text = el.textContent.trim();
                if (text) return formatId('heading', slug(text), details);
            }
            return null;
        }

        // Paragraphs — prepend the nearest tagged ancestor's value, never embed prose
        if (tagName === 'p') {
            var ancestor = el.parentElement;
            while (ancestor) {
                if (ancestor.hasAttribute(ATTR)) {
                    return formatId('text', ancestor.getAttribute(ATTR), details);
                }
                ancestor = ancestor.parentElement;
            }
            return null;
        }

        // Forms — stable-first: aria-label → id → legend/heading (fallback)
        if (tagName === 'form') {
            var al = el.getAttribute('aria-label');
            if (al) return formatId('form', slug(al), details);
            if (el.id) {
                var idClean = cleanId(el.id);
                if (idClean && !/^\d+$/.test(idClean) && idClean.length > 1) return formatId('form', idClean, details);
            }
            if (textFallback) {
                var legend = el.querySelector('legend') || el.querySelector('h1,h2,h3,h4,h5,h6');
                if (legend) {
                    var t = legend.textContent.trim();
                    if (t) return formatId('form', slug(t), details);
                }
            }
            return 'form';
        }

        // Images
        if (tagName === 'img') {
            var alt = el.getAttribute('alt');
            return alt ? formatId('img', slug(alt), details) : null;
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
            return selectName
                ? formatId('option', slug(selectName) + separator + optSlug, details)
                : formatId('option', optSlug, details);
        }

        // Divs / spans — stable-first: aria-label → id → Elementor/Gutenberg attrs → role
        if (tagName === 'div' || tagName === 'span') {
            // Prefix auto-generated values with role (if present) or HTML tag.
            var prefix = el.getAttribute('role') || tagName;

            // 1. aria-label (most reliable stable source)
            var al = el.getAttribute('aria-label');
            if (al) return formatId(prefix, slug(al), details);

            // 2. Stable id (non-numeric)
            if (el.id) {
                var idClean = cleanId(el.id);
                if (idClean && !/^\d+$/.test(idClean) && idClean.length > 1) return formatId(prefix, idClean, details);
            }

            // 3. Elementor section/container
            var eType = el.getAttribute('data-element_type');
            if (eType === 'section' || eType === 'container') {
                if (textFallback) {
                    var h = firstHeadingText(el);
                    if (h) return formatId('section', slug(h), details);
                }
                return null;
            }

            // 4. Elementor widget
            var eWidget = el.getAttribute('data-widget_type');
            if (eWidget) {
                var wType = eWidget.replace(/\.default$/, '').replace(/^wp-widget-/, '');
                var cleaned = clean(slug(wType));
                if (cleaned) return formatId(prefix, cleaned, details);
                if (textFallback) {
                    var h = firstHeadingText(el);
                    if (h) return formatId(prefix, slug(h), details);
                }
                return null;
            }

            // 5. Gutenberg blocks — wp-block-* class slug
            var classes = el.className ? el.className.split(/\s+/) : [];
            for (var i = 0; i < classes.length; i++) {
                if (classes[i].indexOf('wp-block-') === 0) {
                    var blockSlug = clean(slug(classes[i].slice('wp-block-'.length)));
                    if (blockSlug) return formatId(prefix, blockSlug, details);
                    if (textFallback) {
                        var h = firstHeadingText(el);
                        if (h) return formatId(prefix, slug(h), details);
                    }
                    return null;
                }
            }

            // 6. role with text fallback label
            var role = el.getAttribute('role');
            if (role && textFallback) {
                var label = slug(el.textContent.trim().slice(0, 30));
                if (label) return formatId(role, label, details);
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
