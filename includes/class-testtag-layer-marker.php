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
            'separator'    => TestTag_Settings::get_separator(),
            'tokenOrder'   => implode( ',', TestTag_Settings::get_token_order() ),
            'formatSeps'   => implode( ',', TestTag_Settings::get_format_seps() ),
            'debug'        => defined( 'WP_DEBUG' ) && WP_DEBUG,
        ] );

        wp_enqueue_script(
            'testtag-dynamic-injector',
            TESTTAG_PLUGIN_URL . 'js/dynamic-injector.js',
            [ 'testtag-layer-marker' ],
            TESTTAG_VERSION,
            true
        );
    }
}
