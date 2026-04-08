/**
 * TestTag for WordPress — Dynamic Injector
 *
 * Watches for DOM mutations and applies the same two-layer tagging
 * logic (selector map → auto-generate) to dynamically inserted elements:
 * AJAX content, infinite scroll, modals, live search results, etc.
 *
 * The core tag-generation logic (slug, autoId) lives in tag-engine.js,
 * which is enqueued first and sets window._TestTagEngine.  This file is
 * the browser-side bootstrap only: MutationObserver wiring, dedup, and
 * the test-tooling hook.
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

    var engine       = window._TestTagEngine || {};
    var autoId       = engine.autoId       || function () { return null; };
    var slug         = engine.slug         || function (s) { return s; };  // eslint-disable-line no-unused-vars

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
                tag(root, autoId(root, ATTR, textFallback));
            }
            root.querySelectorAll(AUTO_SELECTOR).forEach(function (el) {
                tag(el, autoId(el, ATTR, textFallback));
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
    // any browser-side consumer can call the exact same autoId() logic.
    if (window.TESTTAG) {
        window.TESTTAG._autoId = autoId;
        window.TESTTAG._slug   = slug;
    }

})();
