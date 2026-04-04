<?php
defined( 'ABSPATH' ) || exit;

class TestTag_Block_Editor {

    public static function init(): void {
        add_action( 'enqueue_block_editor_assets', [ __CLASS__, 'enqueue_editor_assets' ] );
        add_filter( 'render_block',                [ __CLASS__, 'render_block' ], 10, 2 );
    }

    public static function enqueue_editor_assets(): void {
        $asset_file = TESTTAG_PLUGIN_DIR . 'block-editor/build/index.asset.php';
        $asset_data = [
            'dependencies' => [ 'wp-blocks', 'wp-element', 'wp-edit-post', 'wp-components', 'wp-hooks', 'wp-block-editor', 'wp-compose' ],
            'version'      => TESTTAG_VERSION,
        ];

        if ( file_exists( $asset_file ) ) {
            $generated = require $asset_file;
            if ( is_array( $generated ) ) {
                if ( isset( $generated['dependencies'] ) && is_array( $generated['dependencies'] ) ) {
                    $asset_data['dependencies'] = array_values(
                        array_unique(
                            array_merge( $asset_data['dependencies'], $generated['dependencies'] )
                        )
                    );
                }
                $asset_data['version'] = $generated['version'] ?? $asset_data['version'];
            }
        }

        wp_enqueue_script(
            'testtag-block-editor',
            TESTTAG_PLUGIN_URL . 'block-editor/build/index.js',
            $asset_data['dependencies'],
            $asset_data['version'],
            true
        );

        // Some builds emit only JS; enqueue editor.css only when present.
        if ( file_exists( TESTTAG_PLUGIN_DIR . 'block-editor/build/editor.css' ) ) {
            wp_enqueue_style(
                'testtag-block-editor',
                TESTTAG_PLUGIN_URL . 'block-editor/build/editor.css',
                [],
                $asset_data['version']
            );
        }

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
