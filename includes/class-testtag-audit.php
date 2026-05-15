<?php
defined( 'ABSPATH' ) || exit;

/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 *
 * TestTag_Audit
 *
 * Adds an "🔍 Audit Mode" toggle to the WordPress admin bar that,
 * when clicked, draws coloured overlays on every tagged element
 * showing its tag value, attribute key, and which layer set it.
 *
 * The overlay JS (audit-overlay.js) is always enqueued alongside the
 * layer marker when TestTag is enabled, because the admin bar is only
 * visible to logged-in users who already see the layer marker running.
 *
 * Keyboard shortcut: Alt+Shift+T (works even without the admin bar).
 */
class TestTag_Audit {

    public static function init(): void {
        add_action( 'wp_enqueue_scripts',    [ __CLASS__, 'enqueue_overlay_assets' ] );
        add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_overlay_assets' ] );
        add_action( 'admin_bar_menu',        [ __CLASS__, 'add_admin_bar_button' ], 999 );
    }

    // ─────────────────────────────────────────────────────────────
    // Assets
    // ─────────────────────────────────────────────────────────────

    public static function enqueue_overlay_assets(): void {
        // Load whenever TestTag is enabled so keyboard toggle works even when
        // the admin bar is hidden (for example, frontend automation sessions).
        if ( ! TestTag_Settings::is_enabled() ) return;

        wp_enqueue_script(
            'testtag-audit-overlay',
            TESTTAG_PLUGIN_URL . 'js/audit-overlay.js',
            [ 'testtag-layer-marker' ],   // depend on layer marker so it runs after
            TESTTAG_VERSION,
            true
        );
    }

    // ─────────────────────────────────────────────────────────────
    // Admin bar button
    // ─────────────────────────────────────────────────────────────

    public static function add_admin_bar_button( WP_Admin_Bar $admin_bar ): void {
        if ( ! TestTag_Settings::is_enabled() ) return;
        if ( ! is_admin_bar_showing() ) return;

        $admin_bar->add_node( [
            'id'    => 'testtag-audit',
            'title' => '🔍 Audit Mode',
            'href'  => '#',
            'meta'  => [
                'title' => 'Toggle Test ID Auto Injector Audit Mode — shows coloured overlays on all tagged elements (Alt+Shift+T)',
            ],
        ] );
    }
}
