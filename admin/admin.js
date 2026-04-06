(function () {
    var table    = document.getElementById('testtag-map-table');
    var addBtn   = document.getElementById('testtag-add-row');
    var resetBtn = document.getElementById('testtag-reset-defaults');

    if (!table || typeof TESTTAG_ADMIN === 'undefined') return;

    var tbody    = table.querySelector('tbody');
    var rowCount = TESTTAG_ADMIN.rowCount;
    var defaults = TESTTAG_ADMIN.defaults;
    var presets  = TESTTAG_ADMIN.presets || {};

    function escAttr(str) {
        return (str || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;');
    }

    function buildRow(index, selector, testid) {
        var base = 'testtag_selector_map[' + index + ']';
        var tr   = document.createElement('tr');
        tr.className = 'testtag-row';
        tr.innerHTML =
            '<td><input type="text" name="' + base + '[selector]" value="' + escAttr(selector) + '" placeholder="nav a[href=\'#about\']" class="regular-text" /></td>' +
            '<td><input type="text" name="' + base + '[testid]"   value="' + escAttr(testid)   + '" placeholder="nav-about" class="regular-text" /></td>' +
            '<td><button type="button" class="button testtag-remove-row">Remove</button></td>';
        return tr;
    }

    function reindex() {
        tbody.querySelectorAll('tr.testtag-row').forEach(function (row, i) {
            row.querySelectorAll('input').forEach(function (input) {
                input.name = input.name.replace(/testtag_selector_map\[\d+\]/, 'testtag_selector_map[' + i + ']');
            });
        });
        rowCount = tbody.querySelectorAll('tr.testtag-row').length;
    }

    addBtn.addEventListener('click', function () {
        tbody.appendChild(buildRow(rowCount++, '', ''));
    });

    tbody.addEventListener('click', function (e) {
        if (e.target.classList.contains('testtag-remove-row')) {
            e.target.closest('tr').remove();
            reindex();
        }
    });

    resetBtn.addEventListener('click', function () {
        if (!confirm('Reset to defaults? Any unsaved changes will be lost.')) return;
        tbody.innerHTML = '';
        rowCount = 0;
        defaults.forEach(function (row) {
            tbody.appendChild(buildRow(rowCount++, row.selector, row.testid));
        });
    });

    // ── Export / Import ───────────────────────────────────────────
    var importFile = document.getElementById('testtag-import-file');
    var importBtn  = document.getElementById('testtag-import-btn');

    if (importFile && importBtn) {
        importFile.addEventListener('change', function () {
            importBtn.disabled = !importFile.files.length;
        });
    }

    // ── Preset apply buttons ──────────────────────────────────────
    // Collect existing selectors so we skip exact duplicates.
    function existingSelectors() {
        var seen = {};
        tbody.querySelectorAll('tr.testtag-row').forEach(function (row) {
            var sel = row.querySelector('input[name$="[selector]"]');
            if (sel && sel.value) seen[sel.value.trim()] = true;
        });
        return seen;
    }

    document.querySelectorAll('.testtag-apply-preset').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var key     = btn.dataset.preset;
            var preset  = presets[key];
            if (!preset || !preset.entries) return;

            var existing = existingSelectors();
            var added    = 0;

            preset.entries.forEach(function (row) {
                // Skip if an identical selector is already in the map.
                if (existing[row.selector]) return;
                tbody.appendChild(buildRow(rowCount++, row.selector, row.testid));
                existing[row.selector] = true;
                added++;
            });

            if (added === 0) {
                alert(preset.label + ' selectors are already in your map.');
            } else {
                btn.textContent = '✓ Applied (' + added + ' added)';
                btn.disabled = true;
                // Scroll to the table so the user can see the new rows.
                table.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        });
    });

    // ── Selector Validation ───────────────────────────────────────

    /**
     * Patterns the server-side CSS→XPath translator cannot handle.
     * Returns a message string if the selector uses an unsupported feature,
     * or null if the selector appears safe to use.
     */
    function detectUnsupportedPattern(selector) {
        if (!selector || !selector.trim()) return null;

        // :has() — not translatable to XPath 1.0
        if (/:has\s*\(/i.test(selector)) {
            return ':has() is not supported. Use a direct parent selector or a class on the parent element instead.';
        }
        // :is() / :where() — logical pseudo-classes
        if (/:is\s*\(|:where\s*\(/i.test(selector)) {
            return ':is() and :where() are not supported. Expand into comma-separated selectors instead.';
        }
        // :nth-child / :nth-of-type with expressions (e.g. :nth-child(2n+1))
        if (/:nth-(?:child|of-type|last-child|last-of-type)\s*\(\s*[^)]+\)/i.test(selector)) {
            return ':nth-child() and related pseudo-classes are not supported.';
        }
        // :not() with complex arguments (more than a simple tag/class/id)
        var notMatch = selector.match(/:not\s*\(([^)]*)\)/i);
        if (notMatch && /[>~+\s]/.test(notMatch[1])) {
            return ':not() only supports simple selectors (tag, .class, #id, [attr]).';
        }
        // Adjacent sibling (+) and general sibling (~) combinators
        if (/[+~]/.test(selector.replace(/:not\([^)]*\)/g, ''))) {
            return 'Sibling combinators (+ and ~) are not supported. Use descendant ( ) or child (>) combinators.';
        }
        // Pseudo-elements
        if (/::[\w-]+/.test(selector)) {
            return 'Pseudo-elements (::before, ::after, etc.) cannot be matched on real DOM elements.';
        }

        // Try the selector against a detached element to catch parse errors.
        try {
            document.createElement('div').querySelector(selector);
        } catch (e) {
            return 'Invalid CSS selector: ' + e.message;
        }

        return null;
    }

    function clearSelectorFeedback(input) {
        input.classList.remove('testtag-selector-error', 'testtag-selector-warning');
        var existing = input.parentNode.querySelector('.testtag-selector-msg');
        if (existing) existing.remove();
    }

    function showSelectorFeedback(input, message, level) {
        clearSelectorFeedback(input);
        input.classList.add(level === 'error' ? 'testtag-selector-error' : 'testtag-selector-warning');
        var msg = document.createElement('span');
        msg.className = 'testtag-selector-msg is-' + level;
        msg.textContent = message;
        input.parentNode.appendChild(msg);
    }

    function validateSelectorInput(input) {
        var val = input.value.trim();
        if (!val) {
            clearSelectorFeedback(input);
            return;
        }
        var unsupportedMsg = detectUnsupportedPattern(val);
        if (unsupportedMsg) {
            showSelectorFeedback(input, unsupportedMsg, 'error');
        } else {
            clearSelectorFeedback(input);
        }
    }

    // Validate on input (live) and on blur for all selector fields.
    function attachSelectorValidation(input) {
        input.addEventListener('input', function () { validateSelectorInput(input); });
        input.addEventListener('blur',  function () { validateSelectorInput(input); });
        // Run immediately in case the field already has a value (e.g. on page load).
        validateSelectorInput(input);
    }

    // Attach to all existing rows on page load.
    tbody.querySelectorAll('input[name$="[selector]"]').forEach(attachSelectorValidation);

    // Attach to rows added dynamically (add row / preset apply).
    var origAppendChild = tbody.appendChild.bind(tbody);
    tbody.appendChild = function (node) {
        var result = origAppendChild(node);
        var sel = node.querySelector && node.querySelector('input[name$="[selector]"]');
        if (sel) attachSelectorValidation(sel);
        return result;
    };
})();
