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

    // ── Tag Format Drag-and-Drop Builder ──────────────────────────
    var builder        = document.getElementById('testtag-format-builder');
    var activeZone     = document.getElementById('testtag-format-active');
    var paletteZone    = document.getElementById('testtag-format-palette');
    var paletteAll     = document.getElementById('testtag-palette-all');
    var previewValueEl = document.getElementById('testtag-format-preview-value');
    var previewAttrEl  = document.getElementById('testtag-format-preview-attr');
    var tokenOrderVal  = document.getElementById('testtag-token-order-val');
    var formatSepsVal  = document.getElementById('testtag-format-seps-val');
    var sepSelect      = document.getElementById('testtag-separator');
    var previewHtmlEl  = document.getElementById('testtag-format-preview-html');
    var attrKeyInput   = document.getElementById('testtag-attr-key');

    if (builder && activeZone) {
        var TOKEN_DEFS = {
            'type':             { label: 'type',             desc: 'auto-detect: button · heading · nav…', cat: 'type' },
            'role':             { label: 'role',             desc: '[role] attribute or implicit ARIA role', cat: 'type' },
            'identifier':       { label: 'identifier',       desc: 'smart: label · id · text…',           cat: 'ident' },
            'aria-label':       { label: 'aria-label',       desc: '[aria-label] attribute',               cat: 'ident' },
            'aria-labelledby':  { label: 'aria-labelledby',  desc: '[aria-labelledby] attribute',          cat: 'ident' },
            'placeholder':      { label: 'placeholder',      desc: '[placeholder] attribute',              cat: 'ident' },
            'id':               { label: 'id',               desc: '[id] attribute',                       cat: 'ident' },
            'name':             { label: 'name',             desc: '[name] attribute',                     cat: 'ident' }
        };

        function isLitToken(t) { return /^lit:[a-zA-Z0-9]+$/.test(t); }

        // Track whether the user has explicitly customized the token format.
        // In default mode the global separator governs all token gaps.
        var isCustomFormat = builder.dataset.formatCustomized === '1';

        var activeOrder = (builder.dataset.tokenOrder || 'type,identifier').split(',').filter(function(t) { return TOKEN_DEFS[t] || isLitToken(t); });
        if (!activeOrder.length) activeOrder = ['type', 'identifier'];
        var activeSeps  = (builder.dataset.formatSeps  || getGlobalSep()).split(',').map(function(s) { return s === '_' ? '_' : '-'; });

        // Normalise sep array length to N-1 for N tokens
        function normSeps() {
            var need = Math.max(0, activeOrder.length - 1);
            var def  = activeSeps[0] || getGlobalSep();
            while (activeSeps.length < need)  activeSeps.push(def);
            activeSeps = activeSeps.slice(0, need);
        }
        normSeps();

        function markCustom() { isCustomFormat = true; }

        var dragging = null, draggingFrom = null;

        function getAttrKey() {
            var v = attrKeyInput ? attrKeyInput.value.trim() : '';
            return v || 'data-testid';
        }

        // Returns the global separator character from the separator dropdown.
        function getGlobalSep() {
            return (sepSelect && sepSelect.value === '_') ? '_' : '-';
        }

        // Slugify a string using the global separator (mirrors PHP/JS slug()).
        function slugStr(s) {
            if (!s) return '';
            var sep = getGlobalSep();
            return s.toLowerCase()
                .replace(/[^a-z0-9]+/g, sep)
                .replace(new RegExp('^[^a-z0-9]+|[^a-z0-9]+$', 'g'), '')
                .slice(0, 50);
        }

        // Detect a semantic type token from the parsed element (mirrors autoId logic).
        function detectType(el) {
            var tag = el.tagName ? el.tagName.toLowerCase() : '';
            var role = (el.getAttribute && el.getAttribute('role')) || '';
            if (tag === 'button' || (tag === 'input' && /^(submit|button)$/.test(el.getAttribute('type') || ''))) return 'button';
            if (tag === 'a') return 'link';
            if (/^h[1-6]$/.test(tag)) return 'heading';
            if (tag === 'nav') return 'nav';
            if (tag === 'form') return 'form';
            if (tag === 'input' || tag === 'textarea' || tag === 'select') return tag;
            if (tag === 'img') return 'img';
            if (role) return role;
            return tag || 'element';
        }

        // Returns the implicit ARIA role for an element (mirrors PHP inferred_aria_role()).
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

        function detectLabelForText(el) {
            var id = (el.getAttribute && el.getAttribute('id')) || '';
            var doc = el.ownerDocument;
            var labels, i, txt;

            if (!id || !doc || !doc.querySelectorAll) return '';

            labels = doc.querySelectorAll('label[for]');
            for (i = 0; i < labels.length; i++) {
                if ((labels[i].getAttribute('for') || '') === id) {
                    txt = (labels[i].textContent || '').trim().slice(0, 50);
                    if (txt) return txt;
                }
            }

            return '';
        }

        function detectAriaLabelledByText(el) {
            var ids = ((el.getAttribute && el.getAttribute('aria-labelledby')) || '').trim();
            var doc = el.ownerDocument;
            var parts = [];
            var i, ref, txt;

            if (!ids || !doc || !doc.getElementById) return '';

            ids.split(/\s+/).forEach(function (id) {
                ref = doc.getElementById(id);
                txt = ref && ref.textContent ? ref.textContent.trim() : '';
                if (txt) parts.push(txt);
            });

            return parts.join(' ').trim().slice(0, 50);
        }

        // Derive the "smart identifier" value from the parsed element (mirrors autoId logic).
        function detectIdentifier(el) {
            var lf  = detectLabelForText(el);
            var al  = (el.getAttribute && el.getAttribute('aria-label')) || '';
            var alb = detectAriaLabelledByText(el);
            var ph  = (el.getAttribute && el.getAttribute('placeholder')) || '';
            var nm  = (el.getAttribute && el.getAttribute('name')) || '';
            var id  = (el.getAttribute && el.getAttribute('id')) || '';
            var txt = (el.textContent || '').trim().slice(0, 50);
            return lf || al || alb || ph || nm || id || txt;
        }

        // Extract per-token values from a parsed DOM element.
        function valuesFromEl(el) {
            var identVal = slugStr(detectIdentifier(el));
            var explicitRole = (el.getAttribute && el.getAttribute('role')) || '';
            var roleVal = slugStr(explicitRole || inferredAriaRole(el));
            return {
                'type':            detectType(el),
                'role':            roleVal,
                'identifier':      identVal,
                'aria-label':      slugStr((el.getAttribute && el.getAttribute('aria-label')) || ''),
                'aria-labelledby': slugStr((el.getAttribute && el.getAttribute('aria-labelledby')) || ''),
                'placeholder':     slugStr((el.getAttribute && el.getAttribute('placeholder')) || ''),
                'id':              slugStr((el.getAttribute && el.getAttribute('id')) || ''),
                'name':            slugStr((el.getAttribute && el.getAttribute('name')) || '')
            };
        }

        // Parse the preview HTML textarea and return values.
        function getPreviewValues() {
            var html = previewHtmlEl ? previewHtmlEl.value.trim() : '';
            if (!html) {
                return { 'type': 'input', 'role': 'search', 'identifier': 'search-field',
                         'aria-label': 'search-field', 'aria-labelledby': 'search-title',
                         'placeholder': 'enter-query', 'id': 'query-input', 'name': 'query' };
            }
            try {
                var doc = (new DOMParser()).parseFromString('<body>' + html + '</body>', 'text/html');
                var el  = doc.body.firstElementChild;
                if (!el) {
                    return { 'type': 'input', 'role': 'search', 'identifier': 'search-field',
                             'aria-label': 'search-field', 'aria-labelledby': 'search-title',
                             'placeholder': 'enter-query', 'id': 'query-input', 'name': 'query' };
                }
                return valuesFromEl(el);
            } catch (e) {
                return { 'type': 'element', 'role': '', 'identifier': '',
                         'aria-label': '', 'aria-labelledby': '',
                         'placeholder': '', 'id': '', 'name': '' };
            }
        }

        function updateHiddenInputs() {
            // In default (non-customized) mode write empty string so PHP keeps
            // the global separator in control of all token gaps.
            if (tokenOrderVal) tokenOrderVal.value = isCustomFormat ? activeOrder.join(',') : '';
            if (formatSepsVal) formatSepsVal.value = isCustomFormat ? activeSeps.join(',') : '';
        }

        function updatePreview() {
            var vals  = getPreviewValues();
            var parts = activeOrder.map(function(t) {
                if (isLitToken(t)) return t.slice(4);
                return vals[t] || '';
            }).filter(Boolean);
            var result = '';
            if (parts.length) {
                result = parts[0];
                var gapSep = !isCustomFormat ? getGlobalSep() : null;
                for (var i = 1; i < parts.length; i++) {
                    result += (gapSep !== null ? gapSep : (activeSeps[i - 1] || '-')) + parts[i];
                }
            }
            if (previewValueEl) previewValueEl.textContent = result;
            if (previewAttrEl)  previewAttrEl.textContent  = getAttrKey();
        }

        function makeSepToggle(idx) {
            var btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'testtag-format-sep-toggle';
            btn.textContent = activeSeps[idx] || '-';
            btn.title = 'Click to toggle separator';
            btn.addEventListener('click', function() {
                markCustom();
                activeSeps[idx] = activeSeps[idx] === '_' ? '-' : '_';
                btn.textContent = activeSeps[idx];
                updateHiddenInputs();
                updatePreview();
            });
            return btn;
        }

        function makeChip(tokenName, inActive) {
            var isLit = isLitToken(tokenName);
            var litText = isLit ? tokenName.slice(4) : '';
            var def  = !isLit ? TOKEN_DEFS[tokenName] : null;
            var chip = document.createElement('div');
            if (isLit) {
                chip.className = 'testtag-token testtag-token-cat-lit';
            } else {
                chip.className = 'testtag-token testtag-token-' + tokenName.replace(/[^a-z0-9]/g, '-') +
                                 (def.cat === 'type' ? ' testtag-token-cat-type' : ' testtag-token-cat-ident');
            }
            chip.dataset.token = tokenName;
            chip.setAttribute('draggable', 'true');

            var label = document.createElement('span');
            label.className = 'testtag-token-label';
            label.textContent = isLit ? litText : def.label;

            chip.appendChild(label);

            if (!isLit) {
                var desc = document.createElement('span');
                desc.className = 'testtag-token-desc';
                desc.textContent = def.desc;
                chip.appendChild(desc);
            }

            if (inActive) {
                var rm = document.createElement('button');
                rm.type = 'button';
                rm.className = 'testtag-token-remove';
                rm.setAttribute('aria-label', 'Remove ' + (isLit ? litText : def.label));
                rm.textContent = '×';
                rm.addEventListener('click', function(e) {
                    e.stopPropagation();
                    markCustom();
                    removeFromActive(tokenName);
                    renderAll();
                    updateHiddenInputs();
                    updatePreview();
                });
                chip.appendChild(rm);
            }

            chip.addEventListener('dragstart', function(e) {
                dragging = tokenName;
                draggingFrom = inActive ? 'active' : 'palette';
                chip.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            chip.addEventListener('dragend', function() {
                dragging = null; draggingFrom = null;
                chip.classList.remove('is-dragging');
                activeZone.classList.remove('is-drag-over');
                if (paletteZone) paletteZone.classList.remove('is-drag-over');
            });
            return chip;
        }

        function removeFromActive(tokenName) {
            var idx = activeOrder.indexOf(tokenName);
            if (idx === -1) return;
            if (idx === 0 && activeSeps.length > 0) {
                activeSeps.splice(0, 1);
            } else if (idx > 0 && idx <= activeSeps.length) {
                activeSeps.splice(idx - 1, 1);
            }
            activeOrder.splice(idx, 1);
        }

        function insertIntoActive(tokenName, insertIdx) {
            var currIdx = activeOrder.indexOf(tokenName);
            if (currIdx !== -1) {
                // Reorder within active
                removeFromActive(tokenName);
                if (insertIdx > currIdx) insertIdx = Math.max(0, insertIdx - 1);
            }
            var defSep = activeSeps[0] || '-';
            activeOrder.splice(insertIdx, 0, tokenName);
            if (insertIdx === 0) {
                activeSeps.splice(0, 0, defSep);
            } else {
                activeSeps.splice(insertIdx - 1, 0, defSep);
            }
            normSeps();
        }

        function getDropIndex(e) {
            var chips = activeZone.querySelectorAll('.testtag-token[data-token]');
            if (!chips.length) return 0;
            for (var i = 0; i < chips.length; i++) {
                var rect = chips[i].getBoundingClientRect();
                if (e.clientX < rect.left + rect.width / 2) return i;
            }
            return chips.length;
        }

        function makeAddTextInput() {
            var input = document.createElement('input');
            input.type = 'text';
            input.className = 'testtag-format-lit-input';
            input.placeholder = 'add text\u2026';
            input.setAttribute('aria-label', 'Add custom text token (a\u2013z, A\u2013Z, 0\u20139)');
            input.setAttribute('maxlength', '30');
            input.addEventListener('input', function() {
                var clean = input.value.replace(/[^a-zA-Z0-9]/g, '');
                if (clean !== input.value) input.value = clean;
            });
            function commit() {
                var val = input.value.replace(/[^a-zA-Z0-9]/g, '');
                input.value = '';
                if (!val) return;
                var tokenName = 'lit:' + val;
                if (activeOrder.indexOf(tokenName) !== -1) return;
                markCustom();
                insertIntoActive(tokenName, activeOrder.length);
                renderAll();
                updateHiddenInputs();
                updatePreview();
            }
            input.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
            });
            input.addEventListener('blur', commit);
            return input;
        }

        function renderActive() {
            activeZone.innerHTML = '';
            if (!activeOrder.length) {
                var ph = document.createElement('span');
                ph.className = 'testtag-format-unused-hint';
                ph.textContent = 'Drag tokens here';
                activeZone.appendChild(ph);
            } else {
                activeOrder.forEach(function(name, i) {
                    if (i > 0) activeZone.appendChild(makeSepToggle(i - 1));
                    activeZone.appendChild(makeChip(name, true));
                });
            }
            activeZone.appendChild(makeAddTextInput());
        }

        function renderPalette() {
            if (!paletteAll) return;
            paletteAll.innerHTML = '';
            Object.keys(TOKEN_DEFS).forEach(function(name) {
                if (activeOrder.indexOf(name) === -1) {
                    paletteAll.appendChild(makeChip(name, false));
                }
            });
        }

        function renderAll() { renderActive(); renderPalette(); }

        // Active zone drag-and-drop
        activeZone.addEventListener('dragover', function(e) {
            if (!dragging) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            activeZone.dataset.dropIdx = String(getDropIndex(e));
            activeZone.classList.add('is-drag-over');
        });
        activeZone.addEventListener('dragleave', function(e) {
            if (!activeZone.contains(e.relatedTarget)) {
                activeZone.classList.remove('is-drag-over');
                delete activeZone.dataset.dropIdx;
            }
        });
        activeZone.addEventListener('drop', function(e) {
            e.preventDefault();
            activeZone.classList.remove('is-drag-over');
            if (!dragging) return;
            var idx = parseInt(activeZone.dataset.dropIdx || '0', 10);
            delete activeZone.dataset.dropIdx;
            markCustom();
            insertIntoActive(dragging, idx);
            renderAll();
            updateHiddenInputs();
            updatePreview();
        });

        // Palette drag-and-drop (remove from active)
        if (paletteZone) {
            paletteZone.addEventListener('dragover', function(e) {
                if (!dragging || draggingFrom !== 'active') return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                paletteZone.classList.add('is-drag-over');
            });
            paletteZone.addEventListener('dragleave', function(e) {
                if (!paletteZone.contains(e.relatedTarget)) {
                    paletteZone.classList.remove('is-drag-over');
                }
            });
            paletteZone.addEventListener('drop', function(e) {
                e.preventDefault();
                paletteZone.classList.remove('is-drag-over');
                if (!dragging || draggingFrom !== 'active') return;
                markCustom();
                removeFromActive(dragging);
                renderAll();
                updateHiddenInputs();
                updatePreview();
            });
        }

        // Attribute key input — sanitize and update preview
        if (attrKeyInput) {
            attrKeyInput.addEventListener('input', function() {
                var raw   = attrKeyInput.value;
                var clean = raw.toLowerCase().replace(/[^a-z0-9\-]/g, '');
                if (clean !== raw) {
                    var pos = attrKeyInput.selectionStart - (raw.length - clean.length);
                    attrKeyInput.value = clean;
                    attrKeyInput.setSelectionRange(pos, pos);
                }
                var attrMsg = document.getElementById('testtag-attr-key-msg');
                if (!attrMsg) {
                    attrMsg = document.createElement('span');
                    attrMsg.id = 'testtag-attr-key-msg';
                    attrMsg.className = 'testtag-selector-msg';
                    // Insert after the formula bar (.testtag-formula-bar), or after the
                    // input's direct parent as a fallback for non-formula-bar layouts.
                    var formulaBar = attrKeyInput.closest('.testtag-formula-bar') || attrKeyInput.parentNode;
                    formulaBar.parentNode.insertBefore(attrMsg, formulaBar.nextSibling);
                }
                if (!clean || /^data-[a-z][a-z0-9\-]*$/.test(clean)) {
                    attrKeyInput.classList.remove('testtag-selector-error');
                    attrMsg.textContent = '';
                    attrMsg.className = 'testtag-selector-msg';
                } else {
                    attrKeyInput.classList.add('testtag-selector-error');
                    attrMsg.className = 'testtag-selector-msg is-error';
                    attrMsg.textContent = "Must start with \u2018data-\u2019 followed by a letter, then letters, digits, or hyphens only.";
                }
                updatePreview();
            });
        }

        // Preview HTML textarea — re-evaluate on input
        if (previewHtmlEl) {
            previewHtmlEl.addEventListener('input', function() {
                updatePreview();
            });
        }

        // Separator dropdown — re-slugify preview when global separator changes.
        // In default (non-customized) mode also sync the active gap separators so
        // the chip buttons and hidden input stay consistent with the global choice.
        if (sepSelect) {
            sepSelect.addEventListener('change', function() {
                if (!isCustomFormat) {
                    var g = getGlobalSep();
                    for (var i = 0; i < activeSeps.length; i++) activeSeps[i] = g;
                    renderAll();
                }
                updatePreview();
            });
        }

        // Reset format button — restore token order and separators to defaults
        var formatResetBtn = document.getElementById('testtag-format-reset');
        if (formatResetBtn) {
            formatResetBtn.addEventListener('click', function() {
                isCustomFormat = false;
                activeOrder.length = 0;
                activeOrder.push('type', 'identifier');
                activeSeps.length = 0;
                activeSeps.push(getGlobalSep());
                normSeps();
                renderAll();
                updateHiddenInputs();
                updatePreview();
            });
        }

        // Initial render
        renderAll();
        updateHiddenInputs();
        updatePreview();
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
        if (notMatch && /[>~+]/.test(notMatch[1])) {
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

    // Attach validation to selector inputs in rows added dynamically (add row / preset apply).
    // Use a MutationObserver instead of overriding appendChild for reliability.
    var rowObserver = new MutationObserver(function (mutations) {
        mutations.forEach(function (m) {
            m.addedNodes.forEach(function (node) {
                if (node.nodeType !== 1) return;
                var sel = node.querySelector && node.querySelector('input[name$="[selector]"]');
                if (sel) attachSelectorValidation(sel);
            });
        });
    });
    rowObserver.observe(tbody, { childList: true });
})();
