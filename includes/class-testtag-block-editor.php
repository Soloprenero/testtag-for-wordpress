<?php
defined( 'ABSPATH' ) || exit;

class TestTag_Block_Editor {

    public static function init(): void {
        add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'enqueue_editor_assets' ] );
        add_filter( 'render_block',                [ __CLASS__, 'render_block' ], 10, 2 );
    }

    public static function enqueue_editor_assets(): void {
        wp_enqueue_script(
            'testtag-block-editor',
            TESTTAG_PLUGIN_URL . 'block-editor/build/index.js',
            [ 'wp-blocks', 'wp-element', 'wp-edit-post', 'wp-components', 'wp-hooks', 'wp-block-editor', 'wp-compose' ],
            TESTTAG_VERSION,
            true
        );
        wp_enqueue_style(
            'testtag-block-editor',
            TESTTAG_PLUGIN_URL . 'block-editor/build/editor.css',
            [],
            TESTTAG_VERSION
        );
        // Pass the attribute key so the sidebar preview stays accurate
        wp_localize_script( 'testtag-block-editor', 'TESTTAG_EDITOR', [
            'attributeKey' => TestTag_Settings::get_attribute_key(),
        ] );
    }

    /**
     * Apply manually set tag value from block editor sidebar to the
     * first HTML tag in the rendered block output, using the configured attribute key.
     */
    public static function render_block( string $block_content, array $block ): string {
        $value = $block['attrs']['testtagValue'] ?? '';
        if ( empty( $value ) || empty( $block_content ) ) {
            return $block_content;
        }
        $attr_key = TestTag_Settings::get_attribute_key();
        return preg_replace(
            '/^(<\w[^>]*)>/s',
            '$1 ' . esc_attr( $attr_key ) . '="' . esc_attr( $value ) . '">',
            $block_content,
            1
        );
    }
}
