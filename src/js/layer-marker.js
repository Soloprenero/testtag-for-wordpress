/**
 * TestTag for WordPress — layer marker
 *
 * Marks the layer source on server-tagged elements so Audit Mode
 * can display which layer set each tag.
 */
(function () {
    'use strict';

    var config = window.TESTTAG || { attributeKey: 'data-testid', debug: false };
    var ATTR   = config.attributeKey || 'data-testid';

    function log() {
        if (config.debug) {
            console.log.apply(console, ['[TestTag]'].concat(Array.prototype.slice.call(arguments)));
        }
    }

    function run() {
        // Any pre-authored tagged element that didn't get an explicit
        // layer from selector-map/auto/dynamic is treated as inline.
        document.querySelectorAll('[' + ATTR + ']').forEach(function (el) {
            if (!el.hasAttribute('data-testtag-layer')) {
                el.setAttribute('data-testtag-layer', 'inline');
            }
        });
        log('ready, attribute key: ' + ATTR);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', run);
    } else {
        run();
    }

})();
