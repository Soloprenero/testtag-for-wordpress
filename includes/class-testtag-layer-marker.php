<?php
defined( 'ABSPATH' ) || exit;

class TestTag_Layer_Marker {

    public static function init(): void {
        add_action( 'wp_enqueue_scripts',    [ __CLASS__, 'enqueue' ] );
        add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue' ] );
    }

    public static function enqueue(): void {
        if ( ! TestTag_Settings::is_enabled() ) return;

        wp_enqueue_script(
            'testtag-layer-marker',
            TESTTAG_PLUGIN_URL . 'js/layer-marker.js',
            [],
            TESTTAG_VERSION,
            true
        );

        wp_localize_script( 'testtag-layer-marker', 'TESTTAG', [
            'attributeKey' => TestTag_Settings::get_attribute_key(),
            'selectorMap'  => TestTag_Settings::get_selector_map(),
            'textFallback' => TestTag_Settings::get_text_fallback(),
            'debug'        => defined( 'WP_DEBUG' ) && WP_DEBUG,
        ] );

        wp_enqueue_script(
            'testtag-tag-engine',
            TESTTAG_PLUGIN_URL . 'js/tag-engine.js',
            [],
            TESTTAG_VERSION,
            true
        );

        wp_enqueue_script(
            'testtag-dynamic-injector',
            TESTTAG_PLUGIN_URL . 'js/dynamic-injector.js',
            [ 'testtag-layer-marker', 'testtag-tag-engine' ],
            TESTTAG_VERSION,
            true
        );
    }
}
