/**
 * TestTag for WordPress — Tag Engine
 *
 * Single source of truth for the tag-generation logic shared between the
 * browser-side dynamic injector (js/dynamic-injector.js) and the Node.js
 * test-data factory (tests/helpers/TestTagFactory.ts).
 *
 * UMD wrapper:
 *   - Browser (script tag): sets window._TestTagEngine = { slug, autoId, ... }
 *   - Node.js (require):    module.exports = { slug, autoId, ... }
 *
 * The autoId() function accepts any object that satisfies the minimal element
 * interface used by autoId():
 *   { tagName, getAttribute, id, textContent, className, value,
 *     closest, querySelector, hasAttribute, parentElement }
 *
 * Real browser HTMLElement objects satisfy this interface directly.
 * Node.js callers can use parseHtml() to build a VirtualElement from an
 * HTML string, then pass it to autoId().
 */
(function (root, factory) {
    'use strict';
    if (typeof module === 'object' && typeof module.exports === 'object') {
        // CommonJS / Node.js
        module.exports = factory();
    } else {
        // Browser — expose as window._TestTagEngine so dynamic-injector.js
        // and any other script can consume the shared logic.
        root._TestTagEngine = factory();
    }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    // ── slug ──────────────────────────────────────────────────────

    /**
     * Convert an arbitrary string to a lowercase, alphanumeric-with-hyphens
     * slug capped at 50 characters.
     *
     * @param {string} str
     * @returns {string}
     */
    function slug(str) {
        return (str || '')
            .toLowerCase()
            .replace(/<[^>]*>?/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '')
            .slice(0, 50);
    }

    // ── hrefPathFragment ─────────────────────────────────────────

    /**
     * Extracts a stable slug from an href's last path segment.
     * Returns null for anchors, mailto, tel, and bare hosts.
     *
     * @param {string}  href
     * @param {string=} base  Base URL used to resolve relative paths
     *                        (defaults to 'http://localhost/').
     * @returns {string|null}
     */
    function hrefPathFragment(href, base) {
        if (!href || href === '/') return null;
        if (href.charAt(0) === '#') return null;
        if (href.indexOf('mailto:') === 0) return null;
        if (href.indexOf('tel:') === 0) return null;
        try {
            var resolvedBase = base || (
                typeof location !== 'undefined' ? location.href : 'http://localhost/'
            );
            var url = new URL(href, resolvedBase);
            var path = url.pathname.replace(/\/$/, '');
            if (!path || path === '/') return null;
            var parts = path.split('/');
            var segment = parts[parts.length - 1];
            segment = segment.replace(/\.[a-z0-9]+$/i, '');
            var clean = slug(segment);
            return (clean && clean.length > 1) ? clean : null;
        } catch (e) {
            return null;
        }
    }

    // ── autoId ───────────────────────────────────────────────────

    /**
     * Auto-generate a test-tag value for an element.
     *
     * Works on any object that exposes the minimal element interface:
     *   tagName, getAttribute, id, textContent, className, value,
     *   closest, querySelector, hasAttribute, parentElement
     *
     * Real browser HTMLElement objects satisfy this interface.
     * Use parseHtml() to create a compatible VirtualElement in Node.js.
     *
     * @param {object}  el           Element or VirtualElement.
     * @param {string}  ATTR         The test attribute key (e.g. 'data-testid').
     *                               Defaults to 'data-testid'.
     * @param {boolean} textFallback Whether to fall back to text content when
     *                               no stable attribute is found. Mirrors the
     *                               plugin's 'Text fallback' setting.
     *                               Defaults to true.
     * @returns {string|null}
     */
    function autoId(el, ATTR, textFallback) {
        if (!ATTR) ATTR = 'data-testid';
        if (textFallback === undefined) textFallback = true;
        var tagName = el.tagName.toLowerCase();

        // Form controls
        if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
            var type  = (el.getAttribute('type') || tagName).toLowerCase();
            var hint  = _getLabelText(el) || el.getAttribute('name') || el.getAttribute('placeholder') || '';
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
                var text = (el.textContent || '').trim();
                if (text) return 'button-' + slug(text);
            }
            return null;
        }

        // Links — stable-first
        if (tagName === 'a') {
            var href     = el.getAttribute('href') || '';
            var linkText = (el.textContent || '').trim();

            if (el.closest && el.closest('nav, header')) {
                var al = el.getAttribute('aria-label');
                if (al) return 'nav-' + slug(al);
                if (href === '/')               return 'nav-home';
                if (href.charAt(0) === '#')     return 'nav-' + slug(href.slice(1));
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

            // Card-style anchor
            if (el.querySelector && el.querySelector('div, p, h1, h2, h3, h4, h5, h6, img, figure, article, section, ul, ol')) {
                var ancestor = el.parentElement;
                while (ancestor) {
                    if (ancestor.hasAttribute && ancestor.hasAttribute(ATTR)) {
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
            if (href.charAt(0) === '#')   return 'link-' + slug(href.slice(1));
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
                var h = _firstHeadingText(el);
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
                var text = (el.textContent || '').trim();
                if (text) return 'heading-' + slug(text);
            }
            return null;
        }

        // Paragraphs
        if (tagName === 'p') {
            var ancestor = el.parentElement;
            while (ancestor) {
                if (ancestor.hasAttribute && ancestor.hasAttribute(ATTR)) {
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
            var legend = el.querySelector && textFallback && (
                el.querySelector('legend') || el.querySelector('h1,h2,h3,h4,h5,h6')
            );
            if (legend) {
                var t = (legend.textContent || '').trim();
                if (t) return 'form-' + slug(t);
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
            var optValue = relVal || (textFallback ? (el.textContent || '').trim() : '');
            if (!optValue) return null;
            var optSlug = slug(optValue);
            if (!optSlug) return null;
            var selectName = null;
            var parent = el.parentElement;
            while (parent) {
                if (parent.hasAttribute && parent.hasAttribute('data-name')) {
                    selectName = parent.getAttribute('data-name');
                    break;
                }
                var sel = parent.querySelector && parent.querySelector(':scope > select[name]');
                if (sel) { selectName = sel.getAttribute('name'); break; }
                parent = parent.parentElement;
            }
            return selectName ? 'option-' + slug(selectName) + '-' + optSlug : 'option-' + optSlug;
        }

        // Divs / spans
        if (tagName === 'div' || tagName === 'span') {
            var prefix = el.getAttribute('role') || tagName;

            var al = el.getAttribute('aria-label');
            if (al) return prefix + '-' + slug(al);

            if (el.id) {
                var clean = slug(el.id);
                if (clean && !/^\d+$/.test(clean) && clean.length > 1) return prefix + '-' + clean;
            }

            var eType = el.getAttribute('data-element_type');
            if (eType === 'section' || eType === 'container') {
                if (textFallback) {
                    var h = _firstHeadingText(el);
                    if (h) return 'section-' + slug(h);
                }
                return null;
            }

            var eWidget = el.getAttribute('data-widget_type');
            if (eWidget) {
                var wType = eWidget.replace(/\.default$/, '').replace(/^wp-widget-/, '');
                var cleaned = slug(wType);
                if (cleaned) return prefix + '-' + cleaned;
                if (textFallback) {
                    var h = _firstHeadingText(el);
                    if (h) return prefix + '-' + slug(h);
                }
                return null;
            }

            var classes = el.className ? el.className.split(/\s+/) : [];
            for (var i = 0; i < classes.length; i++) {
                if (classes[i].indexOf('wp-block-') === 0) {
                    var blockSlug = slug(classes[i].slice('wp-block-'.length));
                    if (blockSlug) return prefix + '-' + blockSlug;
                    if (textFallback) {
                        var h = _firstHeadingText(el);
                        if (h) return prefix + '-' + slug(h);
                    }
                    return null;
                }
            }

            var role = el.getAttribute('role');
            if (role && textFallback) {
                var label = slug((el.textContent || '').trim().slice(0, 30));
                if (label) return role + '-' + label;
            }
        }

        return null;
    }

    // ── Private helpers ───────────────────────────────────────────

    function _getLabelText(el) {
        var id = el.id;
        if (id && typeof document !== 'undefined') {
            var label = document.querySelector('label[for="' + id + '"]');
            if (label) return (label.textContent || '').trim();
        }
        return el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    }

    function _firstHeadingText(el) {
        var h = el.querySelector && el.querySelector('h1,h2,h3,h4,h5,h6');
        return h ? (h.textContent || '').trim() : '';
    }

    // ── VirtualElement / Node.js HTML parser ─────────────────────

    /**
     * Build a minimal VirtualElement from an HTML string.
     *
     * Parses the outer HTML of a single element using a lightweight
     * regex-based approach — no external dependencies, no DOM required.
     * The resulting object satisfies the minimal interface expected by autoId().
     *
     * Limitations (by design — sufficient for parity test cases):
     *   - querySelector / closest return null (no tree context).
     *   - parentElement is null (standalone element, no parent).
     *   - value is '' (form element values are not present in HTML strings).
     *   - Label lookups via <label for="…"> are skipped (no document).
     *
     * @param {string} htmlStr  Outer HTML of a single element.
     * @returns {object}  VirtualElement
     */
    function parseHtml(htmlStr) {
        var trimmed = (htmlStr || '').trim();

        // Extract tag name
        var tagMatch = trimmed.match(/^<([a-zA-Z][a-zA-Z0-9-]*)/);
        var tagName  = tagMatch ? tagMatch[1].toUpperCase() : 'DIV';

        // Extract all attributes from the opening tag
        var openTagMatch = trimmed.match(/^<[a-zA-Z][a-zA-Z0-9-]*([^>]*?)(?:\/?>|>)/);
        var attrString   = openTagMatch ? openTagMatch[1] : '';
        var attrs        = _parseAttributes(attrString);

        // Extract text content (strip tags)
        var textContent = trimmed
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        return {
            tagName      : tagName,
            id           : attrs['id'] || '',
            className    : attrs['class'] || '',
            value        : '',
            textContent  : textContent,
            getAttribute : function (name) {
                return Object.prototype.hasOwnProperty.call(attrs, name) ? attrs[name] : null;
            },
            hasAttribute : function (name) {
                return Object.prototype.hasOwnProperty.call(attrs, name);
            },
            closest      : function () { return null; },
            querySelector: function () { return null; },
            parentElement: null,
        };
    }

    /**
     * Parse an attribute string into a plain object map.
     * Handles: attr="val", attr='val', attr=val, and boolean attrs.
     *
     * @param {string} str
     * @returns {Object.<string, string>}
     */
    function _parseAttributes(str) {
        var result = Object.create(null);
        var re = /([a-zA-Z_:][a-zA-Z0-9_.:-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'`=<>/]*)))?/g;
        var m;
        while ((m = re.exec(str)) !== null) {
            var key = m[1].toLowerCase();
            // m[2] = double-quoted, m[3] = single-quoted, m[4] = unquoted, undefined = boolean
            var val = m[2] !== undefined ? m[2]
                    : m[3] !== undefined ? m[3]
                    : m[4] !== undefined ? m[4]
                    : '';
            result[key] = val;
        }
        return result;
    }

    /**
     * Compute the auto-generated test-tag for an HTML element string.
     *
     * This is the main entry point for the Node.js test-data factory.
     * No browser, no DOM, no page.evaluate() required.
     *
     * @param {string}  htmlStr      Outer HTML of the element.
     * @param {string=} attrKey      Attribute key, defaults to 'data-testid'.
     * @param {boolean=} textFallback Whether to fall back to text content.
     *                               Defaults to true.
     * @returns {string|null}
     */
    function computeTag(htmlStr, attrKey, textFallback) {
        var el = parseHtml(htmlStr);
        return autoId(el, attrKey || 'data-testid', textFallback !== undefined ? textFallback : true);
    }

    // ── Public API ────────────────────────────────────────────────

    return {
        slug             : slug,
        hrefPathFragment : hrefPathFragment,
        autoId           : autoId,
        parseHtml        : parseHtml,
        computeTag       : computeTag,
    };
}));
