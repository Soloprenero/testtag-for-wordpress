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
})();
