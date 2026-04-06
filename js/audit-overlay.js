/**
 * TestTag for WordPress — Audit Mode
 *
 * When active, hovering any tagged element shows a fixed tooltip with:
 *   - Tag value
 *   - Attribute key
 *   - Which layer applied it (custom / selector-map / dynamic)
 *   - Element descriptor
 *
 * No overlay boxes are drawn — avoids all scroll/positioning complexity.
 * Toggle via admin-bar button or Alt+Shift+T.
 */
(function () {
    'use strict';

    var ATTR        = (window.TESTTAG && window.TESTTAG.attributeKey) || 'data-testid';
    var STORAGE_KEY = 'testtag_audit_active';

    var active  = false;
    var tip     = null;   // the tooltip DOM element

    // ── Layer colours ─────────────────────────────────────────────
    var LAYER_META = {
        'custom':       { label: '🔴 Custom attributes', color: '#e74c3c' },
        'selector-map': { label: '🔵 Selector map',     color: '#2980b9' },
        'dynamic':      { label: '🟠 Dynamic',          color: '#e67e22' },
        'auto':         { label: '🟠 Dynamic',          color: '#e67e22' },
    };

    // ── Tooltip ───────────────────────────────────────────────────
    function ensureTip() {
        if (tip) return;
        tip = document.createElement('div');
        tip.id = 'testtag-audit-tip';
        tip.style.cssText = [
            'position:fixed',
            'z-index:2147483647',
            'background:#1e1e2e',
            'color:#cdd6f4',
            'border-radius:6px',
            'padding:10px 14px',
            'font:13px/1.5 ui-sans-serif,system-ui,sans-serif',
            'min-width:220px',
            'max-width:340px',
            'box-shadow:0 4px 24px rgba(0,0,0,0.4)',
            'pointer-events:none',
            'display:none',
            'top:0',
            'left:0',
        ].join(';');
        document.body.appendChild(tip);
    }

    function showTip(el, x, y) {
        var value = el.getAttribute(ATTR);
        var layer = el.getAttribute('data-testtag-layer') || 'auto';
        var meta  = LAYER_META[layer] || { label: layer, color: '#e67e22' };

        tip.innerHTML = [
            row('Tag', '<code style="font:bold 13px/1 ui-monospace,monospace;color:#cba6f7">' + esc(value) + '</code>'),
            row('Attr', '<code style="font:12px/1 ui-monospace,monospace;color:#89dceb">' + esc(ATTR) + '</code>'),
            row('Layer', '<span style="color:' + esc(meta.color) + '">' + esc(meta.label) + '</span>'),
            row('El', '<code style="font:11px/1 ui-monospace,monospace;color:#89dceb">' + esc(elDesc(el)) + '</code>'),
        ].join('');

        tip.style.display = 'block';
        placeTip(x, y);
    }

    function placeTip(x, y) {
        var tw = tip.offsetWidth  || 260;
        var th = tip.offsetHeight || 110;
        var left = x + 14;
        var top  = y + 14;
        if (left + tw > window.innerWidth  - 8) left = x - tw - 8;
        if (top  + th > window.innerHeight - 8) top  = y - th - 8;
        tip.style.left = Math.max(8, left) + 'px';
        tip.style.top  = Math.max(8, top)  + 'px';
    }

    function hideTip() {
        if (tip) tip.style.display = 'none';
    }

    function row(label, value) {
        return '<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px">' +
            '<span style="flex-shrink:0;width:46px;font-size:11px;color:#6c7086;text-transform:uppercase;letter-spacing:.04em">' + label + '</span>' +
            value +
            '</div>';
    }

    function esc(s) {
        return (s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    function elDesc(el) {
        var d = el.tagName.toLowerCase();
        if (el.id) d += '#' + el.id;
        else if (el.className && typeof el.className === 'string') {
            var c = el.className.trim().split(/\s+/).slice(0,2).join('.');
            if (c) d += '.' + c;
        }
        return d;
    }

    // ── Event handlers ────────────────────────────────────────────
    // Walk up from the hovered target to find a tagged ancestor.
    function taggedAncestor(el) {
        while (el && el !== document.body) {
            if (el.hasAttribute && el.hasAttribute(ATTR)) return el;
            el = el.parentElement;
        }
        return null;
    }

    var lastTarget = null;

    function onMouseMove(e) {
        var tagged = taggedAncestor(e.target);
        if (tagged) {
            if (tagged !== lastTarget) {
                lastTarget = tagged;
                showTip(tagged, e.clientX, e.clientY);
            } else {
                placeTip(e.clientX, e.clientY);
            }
        } else {
            lastTarget = null;
            hideTip();
        }
    }

    function onMouseLeave() {
        lastTarget = null;
        hideTip();
    }

    // ── Legend ────────────────────────────────────────────────────
    var legendEl = null;

    function showLegend() {
        if (legendEl) return;
        legendEl = document.createElement('div');
        legendEl.id = 'testtag-audit-legend';
        legendEl.style.cssText = [
            'position:fixed',
            'bottom:24px',
            'right:24px',
            'background:#1e1e2e',
            'color:#cdd6f4',
            'border-radius:8px',
            'padding:12px 16px',
            'font:13px/1.6 ui-sans-serif,system-ui,sans-serif',
            'box-shadow:0 4px 24px rgba(0,0,0,0.4)',
            'pointer-events:none',
            'z-index:2147483646',
        ].join(';');
        legendEl.innerHTML = [
            '<div style="font:700 11px/1 ui-sans-serif,sans-serif;letter-spacing:.05em;text-transform:uppercase;color:#6c7086;margin-bottom:8px">TestTag Audit Mode</div>',
            swatch('#e74c3c', 'Custom attributes'),
            swatch('#2980b9', 'Selector map'),
            swatch('#e67e22', 'Dynamic layer'),
            '<div style="margin-top:8px;font-size:11px;color:#6c7086">Hover elements · Alt+Shift+T to toggle</div>',
        ].join('');
        document.body.appendChild(legendEl);
    }

    function swatch(color, label) {
        return '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">' +
            '<span style="display:inline-block;width:12px;height:12px;border-radius:2px;background:' + color + ';flex-shrink:0"></span>' +
            label + '</div>';
    }

    function hideLegend() {
        if (legendEl && legendEl.parentNode) legendEl.parentNode.removeChild(legendEl);
        legendEl = null;
    }

    // ── Highlight outline on hovered tagged element ───────────────
    var highlightStyle = null;

    function injectHighlightStyle() {
        if (highlightStyle) return;
        highlightStyle = document.createElement('style');
        highlightStyle.id = 'testtag-audit-style';
        highlightStyle.textContent = [
            '[data-testtag-layer]:hover{outline:2px solid #f39c12!important;outline-offset:2px!important;}',
            '[data-testtag-layer="custom"]:hover{outline-color:#e74c3c!important;}',
            '[data-testtag-layer="selector-map"]:hover{outline-color:#2980b9!important;}',
            '[data-testtag-layer="dynamic"]:hover,[data-testtag-layer="auto"]:hover{outline-color:#e67e22!important;}',
        ].join('');
        document.head.appendChild(highlightStyle);
    }

    function removeHighlightStyle() {
        if (highlightStyle && highlightStyle.parentNode) highlightStyle.parentNode.removeChild(highlightStyle);
        highlightStyle = null;
    }

    // ── Admin bar sync ────────────────────────────────────────────
    function syncAdminBar() {
        var btn = document.getElementById('wp-admin-bar-testtag-audit');
        if (!btn) return;
        var link = btn.querySelector('a');
        if (!link) return;
        link.textContent = active ? '🔍 Audit: ON' : '🔍 Audit Mode';
        link.style.color = active ? '#27ae60' : '';
    }

    // ── Activate / deactivate ─────────────────────────────────────
    function activate() {
        active = true;
        ensureTip();
        injectHighlightStyle();
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseleave', onMouseLeave);
        showLegend();
        syncAdminBar();
        try { sessionStorage.setItem(STORAGE_KEY, '1'); } catch(e) {}
    }

    function deactivate() {
        active = false;
        hideTip();
        removeHighlightStyle();
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseleave', onMouseLeave);
        hideLegend();
        syncAdminBar();
        try { sessionStorage.removeItem(STORAGE_KEY); } catch(e) {}
    }

    function toggle() { active ? deactivate() : activate(); }

    // ── Admin bar button ──────────────────────────────────────────
    function bindAdminBar() {
        var btn = document.getElementById('wp-admin-bar-testtag-audit');
        if (!btn) return;
        btn.querySelector('a').addEventListener('click', function (e) {
            e.preventDefault();
            toggle();
        });
    }

    // ── Keyboard shortcut: Alt+Shift+T ────────────────────────────
    document.addEventListener('keydown', function (e) {
        if (e.altKey && e.shiftKey && (e.key === 'T' || e.key === 't')) toggle();
    });

    // ── Init ──────────────────────────────────────────────────────
    function init() {
        bindAdminBar();
        try { if (sessionStorage.getItem(STORAGE_KEY) === '1') activate(); } catch(e) {}
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
