<?php
defined( 'ABSPATH' ) || exit;

class TestTag_Settings {

    const OPTION_SELECTOR_MAP   = 'testtag_selector_map';
    const OPTION_FORCE_ENABLE   = 'testtag_force_enable';
    const OPTION_ATTRIBUTE_KEY  = 'testtag_attribute_key';
    const OPTION_TEXT_FALLBACK  = 'testtag_text_fallback';
    const OPTION_SEPARATOR      = 'testtag_separator';
    const OPTION_TOKEN_ORDER    = 'testtag_token_order';
    const OPTION_FORMAT_SEPS    = 'testtag_format_seps';
    // Keep for migration/backward-compat but no longer register them:
    const OPTION_TYPE_PREFIX    = 'testtag_type_prefix';
    const OPTION_TYPE_POSITION  = 'testtag_type_position';
    const DEFAULT_ATTRIBUTE     = 'data-testid';

    public static function init(): void {
        add_action( 'admin_menu',            [ __CLASS__, 'add_settings_page' ] );
        add_action( 'admin_init',            [ __CLASS__, 'register_settings' ] );
        add_action( 'admin_enqueue_scripts', [ __CLASS__, 'enqueue_admin_assets' ] );
        add_action( 'admin_post_testtag_export', [ __CLASS__, 'handle_export' ] );
        add_action( 'admin_post_testtag_import', [ __CLASS__, 'handle_import' ] );
        add_filter( 'plugin_action_links_testtag-for-wordpress/testtag-for-wordpress.php',
                    [ __CLASS__, 'add_plugin_action_links' ] );
    }

    /**
     * The attribute key to inject — e.g. data-testid, data-cy, data-test.
     * Configurable in Settings → TestTag.
     */
    public static function get_attribute_key(): string {
        $key = get_option( self::OPTION_ATTRIBUTE_KEY, self::DEFAULT_ATTRIBUTE );
        // Sanitize: must start with data- and contain only valid attribute chars
        if ( ! preg_match( '/^data-[a-z][a-z0-9\-]*$/', $key ) ) {
            return self::DEFAULT_ATTRIBUTE;
        }
        return $key;
    }

    /**
     * Whether visible-text fallback is enabled for auto-generated tags.
     * Defaults to true for backward compatibility.
     * When disabled, elements without stable attributes (id/name/aria/etc.)
     * are skipped rather than generating text-based tags.
     */
    public static function get_text_fallback(): bool {
        return get_option( self::OPTION_TEXT_FALLBACK, '1' ) === '1';
    }

    /**
     * The separator character used between parts of an auto-generated tag value.
     * Defaults to '-'. Allowed values: '-' or '_'.
     */
    public static function get_separator(): string {
        $sep = get_option( self::OPTION_SEPARATOR, '-' );
        return in_array( $sep, [ '-', '_' ], true ) ? $sep : '-';
    }

    /**
     * Ordered list of active token keys for the tag format.
     * Defaults to ['type', 'identifier'] (existing behaviour).
     */
    public static function get_token_order(): array {
        $raw = get_option( self::OPTION_TOKEN_ORDER );
        if ( false === $raw ) {
            // Migrate from old options (backward compat)
            $prefix   = get_option( self::OPTION_TYPE_PREFIX, '1' ) === '1';
            $position = get_option( self::OPTION_TYPE_POSITION, 'prefix' );
            if ( ! $prefix ) return [ 'identifier' ];
            return $position === 'suffix' ? [ 'identifier', 'type' ] : [ 'type', 'identifier' ];
        }
        $valid  = [ 'type', 'role', 'identifier', 'aria-label', 'aria-labelledby', 'placeholder', 'id', 'name' ];
        $tokens = array_values( array_filter(
            array_map( 'trim', explode( ',', $raw ) ),
            fn( $t ) => in_array( $t, $valid, true ) || preg_match( '/^lit:[a-zA-Z0-9]+$/', $t )
        ) );
        return $tokens ?: [ 'type', 'identifier' ];
    }

    /**
     * Per-gap separator list. One entry per gap between adjacent active tokens.
     * Defaults to ['-'].
     */
    public static function get_format_seps(): array {
        $raw  = get_option( self::OPTION_FORMAT_SEPS, '-' );
        $seps = array_map(
            fn( $s ) => in_array( trim( $s ), [ '-', '_' ], true ) ? trim( $s ) : '-',
            explode( ',', $raw )
        );
        return $seps ?: [ '-' ];
    }

    /**
     * Whether the element type is included as a prefix/suffix in auto-generated tags.
     * Defaults to true (e.g. 'button-submit', 'heading-about').
     */
    public static function get_type_prefix(): bool {
        $type_class = [ 'type', 'role' ];
        foreach ( self::get_token_order() as $t ) {
            if ( in_array( $t, $type_class, true ) ) return true;
        }
        return false;
    }

    /**
     * Position of the element type relative to the identifier.
     * 'prefix' (default): type first — e.g. 'button-submit'.
     * 'suffix': identifier first — e.g. 'submit-button'.
     */
    public static function get_type_position(): string {
        $order      = self::get_token_order();
        $type_class = [ 'type', 'role' ];
        $id_class   = [ 'identifier', 'aria-label', 'aria-labelledby', 'placeholder', 'id', 'name' ];
        $ti = PHP_INT_MAX; $ii = PHP_INT_MAX;
        foreach ( $order as $i => $t ) {
            if ( in_array( $t, $type_class, true ) && $i < $ti ) $ti = $i;
            if ( in_array( $t, $id_class,   true ) && $i < $ii ) $ii = $i;
        }
        return $ti < $ii ? 'prefix' : 'suffix';
    }

    // ─────────────────────────────────────────────────────────────
    // DEFAULT SELECTOR MAP
    // Universal defaults that apply to any WordPress site.
    // No site-specific hrefs, IDs, or plugin class names.
    // Override or extend via Settings → TestTag in wp-admin.
    // ─────────────────────────────────────────────────────────────
    public static function get_default_selector_map(): array {
        return [
            // Primary nav home link
            [ 'selector' => 'nav a[href="/"]',                              'testid' => 'nav-home' ],

            // WordPress standard search
            [ 'selector' => '.search-form, form[role="search"]',            'testid' => 'search-form' ],
            [ 'selector' => 'input[type="search"]',                         'testid' => 'input-search' ],

            // WordPress standard site structure
            [ 'selector' => '.site-header',                                   'testid' => 'site-header' ],
            [ 'selector' => '.site-footer',                                   'testid' => 'site-footer' ],
            [ 'selector' => '.main-navigation, #site-navigation',             'testid' => 'main-nav' ],
            [ 'selector' => '.skip-link',                                     'testid' => 'skip-to-content' ],
            [ 'selector' => '#primary, main#main, .site-main',               'testid' => 'main-content' ],
            [ 'selector' => '#secondary, aside.widget-area',                  'testid' => 'sidebar' ],

            // WordPress post structure
            [ 'selector' => '.wp-block-post-title, .entry-title',            'testid' => 'post-title' ],
            [ 'selector' => '.wp-block-post-content, .entry-content',        'testid' => 'post-content' ],
            [ 'selector' => '.wp-block-post-excerpt, .entry-summary',        'testid' => 'post-excerpt' ],

            // WordPress comments
            [ 'selector' => '#comments',                                      'testid' => 'comments-section' ],
            [ 'selector' => '#comment-form, .comment-form',                  'testid' => 'comment-form' ],
            [ 'selector' => '#comment',                                       'testid' => 'comment-input' ],
            [ 'selector' => '#author',                                        'testid' => 'comment-author-input' ],
            [ 'selector' => '#email',                                         'testid' => 'comment-email-input' ],
            [ 'selector' => '#submit',                                        'testid' => 'comment-submit-btn' ],

            // WordPress pagination
            [ 'selector' => '.pagination, .nav-links',                       'testid' => 'pagination' ],
            [ 'selector' => '.nav-previous, .prev.page-numbers',             'testid' => 'pagination-prev' ],
            [ 'selector' => '.nav-next, .next.page-numbers',                 'testid' => 'pagination-next' ],
        ];
    }

    public static function get_selector_map(): array {
        $saved = get_option( self::OPTION_SELECTOR_MAP, [] );
        return ! empty( $saved ) ? $saved : self::get_default_selector_map();
    }

    public static function is_enabled(): bool {
        if ( get_option( self::OPTION_FORCE_ENABLE, '0' ) === '1' ) {
            return true;
        }
        $env = function_exists( 'wp_get_environment_type' ) ? wp_get_environment_type() : 'production';
        if ( in_array( $env, [ 'local', 'development', 'staging' ], true ) ) {
            return true;
        }
        return is_user_logged_in() && current_user_can( 'manage_options' );
    }

    // ─────────────────────────────────────────────────────────────
    // ADMIN
    // ─────────────────────────────────────────────────────────────
    public static function add_settings_page(): void {
        add_management_page(
            'TestTag for WordPress',
            'TestTag',
            'manage_options',
            'testtag',
            [ __CLASS__, 'render_settings_page' ]
        );
    }

    public static function add_plugin_action_links( array $links ): array {
        $url = admin_url( 'tools.php?page=testtag' );
        array_unshift( $links, '<a href="' . esc_url( $url ) . '">Settings</a>' );
        return $links;
    }

    public static function register_settings(): void {
        register_setting( 'testtag_group', self::OPTION_FORCE_ENABLE );
        register_setting( 'testtag_group', self::OPTION_TEXT_FALLBACK );
        register_setting( 'testtag_group', self::OPTION_TOKEN_ORDER, [
            'sanitize_callback' => function ( $val ) {
                $valid  = [ 'type', 'role', 'identifier', 'aria-label', 'aria-labelledby', 'placeholder', 'id', 'name' ];
                $tokens = array_values( array_filter(
                    array_map( 'trim', explode( ',', $val ) ),
                    fn( $t ) => in_array( $t, $valid, true )
                ) );
                return implode( ',', $tokens ) ?: 'type,identifier';
            },
        ] );
        register_setting( 'testtag_group', self::OPTION_FORMAT_SEPS, [
            'sanitize_callback' => function ( $val ) {
                $seps = array_map(
                    fn( $s ) => in_array( trim( $s ), [ '-', '_' ], true ) ? trim( $s ) : '-',
                    explode( ',', $val )
                );
                return implode( ',', $seps ) ?: '-';
            },
        ] );
        register_setting( 'testtag_group', self::OPTION_ATTRIBUTE_KEY, [
            'sanitize_callback' => function ( $val ) {
                $val = sanitize_text_field( $val );
                return preg_match( '/^data-[a-z][a-z0-9\-]*$/', $val ) ? $val : self::DEFAULT_ATTRIBUTE;
            },
        ] );
        register_setting( 'testtag_group', self::OPTION_SEPARATOR, [
            'sanitize_callback' => function ( $val ) {
                $val = sanitize_text_field( $val );
                return in_array( $val, [ '-', '_' ], true ) ? $val : '-';
            },
        ] );
        register_setting( 'testtag_group', self::OPTION_SELECTOR_MAP, [
            'sanitize_callback' => [ __CLASS__, 'sanitize_selector_map' ],
        ] );
    }

    // ─────────────────────────────────────────────────────────────
    // EXPORT / IMPORT
    // ─────────────────────────────────────────────────────────────
    public static function handle_export(): void {
        check_admin_referer( 'testtag_export' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }

        $data = [
            'version'  => '1.0',
            'plugin'   => 'testtag-for-wordpress',
            'settings' => [
                self::OPTION_ATTRIBUTE_KEY  => self::get_attribute_key(),
                self::OPTION_FORCE_ENABLE   => get_option( self::OPTION_FORCE_ENABLE, '0' ),
                self::OPTION_TEXT_FALLBACK  => get_option( self::OPTION_TEXT_FALLBACK, '1' ),
                self::OPTION_SEPARATOR      => self::get_separator(),
                self::OPTION_TOKEN_ORDER    => implode( ',', self::get_token_order() ),
                self::OPTION_FORMAT_SEPS    => implode( ',', self::get_format_seps() ),
                self::OPTION_SELECTOR_MAP   => self::get_selector_map(),
            ],
        ];

        $filename = 'testtag-settings-' . gmdate( 'Y-m-d' ) . '.json';
        header( 'Content-Type: application/json; charset=utf-8' );
        header( 'Content-Disposition: attachment; filename="' . $filename . '"' );
        header( 'Cache-Control: no-cache, no-store, must-revalidate' );
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
        echo wp_json_encode( $data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES );
        exit;
    }

    public static function handle_import(): void {
        check_admin_referer( 'testtag_import' );
        if ( ! current_user_can( 'manage_options' ) ) {
            wp_die( 'Unauthorized' );
        }

        $redirect = admin_url( 'tools.php?page=testtag' );

        if ( empty( $_FILES['testtag_import_file']['tmp_name'] ) ) {
            wp_redirect( add_query_arg( 'testtag_import', 'no_file', $redirect ) );
            exit;
        }

        $tmp_name = wp_unslash( $_FILES['testtag_import_file']['tmp_name'] );
        if ( ! is_string( $tmp_name ) || ! is_uploaded_file( $tmp_name ) ) {
            wp_redirect( add_query_arg( 'testtag_import', 'no_file', $redirect ) );
            exit;
        }

        // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
        $content = file_get_contents( $tmp_name );
        if ( $content === false ) {
            wp_redirect( add_query_arg( 'testtag_import', 'invalid', $redirect ) );
            exit;
        }
        $data = json_decode( $content, true );

        if (
            ! is_array( $data ) ||
            empty( $data['settings'] ) ||
            ( $data['plugin'] ?? '' ) !== 'testtag-for-wordpress'
        ) {
            wp_redirect( add_query_arg( 'testtag_import', 'invalid', $redirect ) );
            exit;
        }

        $s = $data['settings'];

        if ( isset( $s[ self::OPTION_ATTRIBUTE_KEY ] ) ) {
            $key = sanitize_text_field( $s[ self::OPTION_ATTRIBUTE_KEY ] );
            if ( ! preg_match( '/^data-[a-z][a-z0-9\-]*$/', $key ) ) {
                $key = self::DEFAULT_ATTRIBUTE;
            }
            update_option( self::OPTION_ATTRIBUTE_KEY, $key );
        }

        if ( isset( $s[ self::OPTION_FORCE_ENABLE ] ) ) {
            update_option( self::OPTION_FORCE_ENABLE, $s[ self::OPTION_FORCE_ENABLE ] === '1' ? '1' : '0' );
        }

        if ( isset( $s[ self::OPTION_TEXT_FALLBACK ] ) ) {
            update_option( self::OPTION_TEXT_FALLBACK, $s[ self::OPTION_TEXT_FALLBACK ] === '0' ? '0' : '1' );
        }

        if ( isset( $s[ self::OPTION_SEPARATOR ] ) ) {
            $sep = sanitize_text_field( $s[ self::OPTION_SEPARATOR ] );
            update_option( self::OPTION_SEPARATOR, in_array( $sep, [ '-', '_' ], true ) ? $sep : '-' );
        }

        if ( isset( $s[ self::OPTION_TOKEN_ORDER ] ) ) {
            $valid  = [ 'type', 'role', 'identifier', 'aria-label', 'aria-labelledby', 'placeholder', 'id', 'name' ];
            $tokens = array_values( array_filter(
                array_map( 'trim', explode( ',', sanitize_text_field( $s[ self::OPTION_TOKEN_ORDER ] ) ) ),
                fn( $t ) => in_array( $t, $valid, true ) || preg_match( '/^lit:[a-zA-Z0-9]+$/', $t )
            ) );
            update_option( self::OPTION_TOKEN_ORDER, implode( ',', $tokens ) ?: 'type,identifier' );
        }

        if ( isset( $s[ self::OPTION_FORMAT_SEPS ] ) ) {
            $seps = array_map(
                fn( $s2 ) => in_array( trim( $s2 ), [ '-', '_' ], true ) ? trim( $s2 ) : '-',
                explode( ',', sanitize_text_field( $s[ self::OPTION_FORMAT_SEPS ] ) )
            );
            update_option( self::OPTION_FORMAT_SEPS, implode( ',', $seps ) ?: '-' );
        }

        if ( isset( $s[ self::OPTION_SELECTOR_MAP ] ) ) {
            update_option( self::OPTION_SELECTOR_MAP, self::sanitize_selector_map( $s[ self::OPTION_SELECTOR_MAP ] ) );
        }

        wp_redirect( add_query_arg( 'testtag_import', 'success', $redirect ) );
        exit;
    }

    public static function sanitize_selector_map( $input ): array {
        if ( ! is_array( $input ) ) return self::get_default_selector_map();
        $out = [];
        foreach ( $input as $row ) {
            $s = sanitize_text_field( $row['selector'] ?? '' );
            $t = sanitize_text_field( $row['testid']   ?? '' );
            if ( $s && $t ) $out[] = [ 'selector' => $s, 'testid' => $t ];
        }
        return $out;
    }

    public static function enqueue_admin_assets( string $hook ): void {
        if ( $hook !== 'tools_page_testtag' ) return;
        wp_enqueue_style(  'testtag-admin', TESTTAG_PLUGIN_URL . 'admin/admin.css', [], TESTTAG_VERSION );
        wp_enqueue_script( 'testtag-admin', TESTTAG_PLUGIN_URL . 'admin/admin.js',  [], TESTTAG_VERSION, true );
        wp_localize_script( 'testtag-admin', 'TESTTAG_ADMIN', [
            'defaults'  => self::get_default_selector_map(),
            'rowCount'  => count( self::get_selector_map() ),
            'presets'   => TestTag_Presets::get_all(),
        ] );
    }

    public static function render_settings_page(): void {
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $tab = isset( $_GET['tab'] ) ? sanitize_key( $_GET['tab'] ) : 'settings';

        $map          = self::get_selector_map();
        $force        = get_option( self::OPTION_FORCE_ENABLE, '0' );
        $attrKey      = self::get_attribute_key();
        $textFallback = get_option( self::OPTION_TEXT_FALLBACK, '1' );
        $separator    = self::get_separator();
        $tokenOrder = implode( ',', self::get_token_order() );
        $formatSeps = implode( ',', self::get_format_seps() );

        $base_url = admin_url( 'tools.php?page=testtag' );
        ?>
        <div class="wrap testtag-wrap">
            <h1>🏷️ TestTag for WordPress</h1>

            <nav class="nav-tab-wrapper">
                <a href="<?php echo esc_url( $base_url . '&tab=settings' ); ?>"
                   class="nav-tab <?php echo $tab === 'settings' ? 'nav-tab-active' : ''; ?>">Settings</a>
                <a href="<?php echo esc_url( $base_url . '&tab=about' ); ?>"
                   class="nav-tab <?php echo $tab === 'about' ? 'nav-tab-active' : ''; ?>">About</a>
            </nav>

            <?php if ( $tab === 'settings' ) : ?>

            <?php
            // phpcs:ignore WordPress.Security.NonceVerification.Recommended
            $import_status = isset( $_GET['testtag_import'] ) ? sanitize_key( $_GET['testtag_import'] ) : '';
            if ( $import_status === 'success' ) :
            ?>
            <div class="notice notice-success is-dismissible testtag-preset-notice">
                <p>Settings imported successfully.</p>
            </div>
            <?php elseif ( $import_status === 'invalid' ) : ?>
            <div class="notice notice-error is-dismissible testtag-preset-notice">
                <p>Import failed: the file does not appear to be a valid TestTag settings export.</p>
            </div>
            <?php elseif ( $import_status === 'no_file' ) : ?>
            <div class="notice notice-error is-dismissible testtag-preset-notice">
                <p>Import failed: no file was uploaded.</p>
            </div>
            <?php endif; ?>

            <div class="testtag-card">
                <h2>About</h2>
                <p>
                    Automatically tag any element on your WordPress site with test attributes
                    for <strong>Playwright</strong>, <strong>Cypress</strong>, <strong>Selenium</strong>,
                    or any automation framework that queries the DOM.
                </p>
                <p><strong>Four layers, applied in order:</strong></p>
                <ol>
                    <li><strong>Inline attributes</strong> — existing handwritten <code>data-*</code> values in markup</li>
                    <li><strong>CSS selector map</strong> — explicit mappings below</li>
                    <li><strong>Auto-generation</strong> — inferred from element semantics (fills in everything else)</li>
                    <li><strong>Dynamic injector</strong> — applies selector map + auto-generation to AJAX/post-load DOM</li>
                </ol>
                <p>An existing attribute is <strong>never overwritten</strong> — higher priority layers always win.</p>
            </div>

            <form method="post" action="options.php">
                <?php settings_fields( 'testtag_group' ); ?>

                <div class="testtag-card">
                    <h2>Test Tag Format</h2>
                    <p class="description">
                        The HTML attribute to inject. Match this to your test framework's selector convention.
                    </p>
                    <div class="testtag-format-builder" id="testtag-format-builder"
                         data-token-order="<?php echo esc_attr( $tokenOrder ); ?>"
                         data-format-seps="<?php echo esc_attr( $formatSeps ); ?>">
                        <div class="testtag-attrkey-layout">

                            <!-- Left column: formula bar + separator + HTML preview -->
                            <div class="testtag-attrkey-col-main">

                                <!-- Formula bar: [attr name]="[active zone]" on one line -->
                                <div class="testtag-formula-bar">
                                    <input type="text" id="testtag-attr-key"
                                        name="<?php echo self::OPTION_ATTRIBUTE_KEY; ?>"
                                        value="<?php echo esc_attr( $attrKey ); ?>"
                                        class="testtag-formula-attr-input"
                                        placeholder="data-testid"
                                        aria-label="Attribute name" />
                                    <span class="testtag-formula-eq">="</span>
                                    <div class="testtag-format-zone testtag-format-active" id="testtag-format-active"></div>
                                    <span class="testtag-formula-close">"</span>
                                    <button type="button" id="testtag-format-reset" class="button button-small testtag-format-reset-btn" title="Reset tag format to default" aria-label="Reset tag format to default">↺ Reset</button>
                                </div>
                                <p class="description testtag-formula-help">
                                    Attribute name must start with <code>data-</code>.
                                    Drag tokens to compose the value. Click&nbsp;× or drag to Palette to remove.
                                    Click a separator to toggle <code>-</code>&nbsp;/&nbsp;<code>_</code>.
                                </p>

                                <div class="testtag-attrkey-field testtag-separator-field">
                                    <label for="testtag-separator">Default separator</label>
                                    <select id="testtag-separator" name="<?php echo self::OPTION_SEPARATOR; ?>">
                                        <option value="-" <?php selected( $separator, '-' ); ?>>Hyphen — <code>search-field</code></option>
                                        <option value="_" <?php selected( $separator, '_' ); ?>>Underscore — <code>search_field</code></option>
                                    </select>
                                    <p class="description">
                                        Replaces spaces in auto-generated values (e.g. aria-label <em>Search Field</em> → <code>search-field</code>). Also used in dedup suffixes.
                                    </p>
                                </div>

                                <div class="testtag-format-preview">
                                    <span class="testtag-format-preview-label">Preview HTML <span class="testtag-format-preview-hint">(edit or paste your own element)</span></span>
                                    <textarea id="testtag-format-preview-html" class="testtag-format-preview-html" rows="3" spellcheck="false" placeholder="Paste any element HTML here…"><input role="search" aria-label="Search Field" aria-labelledby="search-title" placeholder="Enter Query" id="query-input" name="query"></textarea>
                                    <span class="testtag-format-preview-output">
                                        <span class="testtag-format-preview-label">Result</span>
                                        <span id="testtag-format-preview-attr"><?php echo esc_html( $attrKey ); ?></span>="<code id="testtag-format-preview-value"></code>"
                                    </span>
                                </div>

                            </div><!-- /.testtag-attrkey-col-main -->

                            <!-- Right column: token palette -->
                            <div class="testtag-attrkey-col-palette">
                                <div class="testtag-format-zone-label">Palette</div>
                                <div class="testtag-format-zone testtag-format-palette" id="testtag-format-palette">
                                    <div class="testtag-palette-chips" id="testtag-palette-all"></div>
                                </div>
                            </div><!-- /.testtag-attrkey-col-palette -->

                        </div><!-- /.testtag-attrkey-layout -->
                        <input type="hidden" name="<?php echo esc_attr( self::OPTION_TOKEN_ORDER ); ?>" id="testtag-token-order-val" value="<?php echo esc_attr( $tokenOrder ); ?>" />
                        <input type="hidden" name="<?php echo esc_attr( self::OPTION_FORMAT_SEPS ); ?>" id="testtag-format-seps-val" value="<?php echo esc_attr( $formatSeps ); ?>" />
                    </div><!-- /#testtag-format-builder -->
                </div>

                <div class="testtag-card">
                    <h2>Injection Control</h2>
                    <table class="form-table">
                        <tr>
                            <th scope="row">Force Enable</th>
                            <td>
                                <label>
                                    <input type="checkbox" name="<?php echo self::OPTION_FORCE_ENABLE; ?>"
                                        value="1" <?php checked( $force, '1' ); ?> />
                                    Inject attributes for <strong>all visitors</strong> on all environments
                                </label>
                                <p class="description">
                                    Leave unchecked to inject only for logged-in admins and
                                    <code>local</code> / <code>development</code> / <code>staging</code> environments.
                                    Enable this when running automation against a production URL.
                                </p>
                            </td>
                        </tr>
                        <tr>
                            <th scope="row">Text Fallback</th>
                            <td>
                                <label>
                                    <input type="checkbox" name="<?php echo self::OPTION_TEXT_FALLBACK; ?>"
                                        value="1" <?php checked( $textFallback, '1' ); ?> />
                                    Use visible text as a <strong>last-resort</strong> source for auto-generated tags
                                </label>
                                <p class="description">
                                    When checked, elements with no stable attribute (aria-label, id, name, etc.) fall
                                    back to button text, heading text, or link text. Uncheck to skip those elements
                                    entirely — tags stay stable even when copy or translations change.
                                    <strong>Checked by default for backward compatibility.</strong>
                                </p>
                            </td>
                        </tr>
                    </table>
                </div>

                <div class="testtag-card" id="testtag-presets-card">
                    <h2>Plugin Presets</h2>
                    <p class="description">
                        One-click selector maps for common plugins.
                        Applying a preset <strong>appends</strong> its entries to your current map —
                        your existing rows are never removed. Save Settings after applying to persist.
                    </p>
                    <div class="testtag-preset-grid">
                        <?php foreach ( TestTag_Presets::get_all() as $key => $preset ) : ?>
                        <div class="testtag-preset-item <?php echo $preset['active'] ? 'is-active' : 'is-inactive'; ?>">
                            <div class="testtag-preset-meta">
                                <strong><?php echo esc_html( $preset['label'] ); ?></strong>
                                <span class="testtag-preset-count">
                                    <?php echo count( $preset['entries'] ); ?> selectors
                                </span>
                            </div>
                            <?php if ( $preset['active'] ) : ?>
                                <button type="button"
                                    class="button button-secondary testtag-apply-preset"
                                    data-preset="<?php echo esc_attr( $key ); ?>">
                                    Apply
                                </button>
                            <?php else : ?>
                                <span class="testtag-preset-inactive">Not installed</span>
                            <?php endif; ?>
                        </div>
                        <?php endforeach; ?>
                    </div>
                </div>

                <div class="testtag-card">
                    <h2>CSS Selector Map</h2>
                    <p class="description">
                        Maps CSS selectors to explicit tag values for theme elements outside block content —
                        nav, footer, widgets, Elementor sections. Applied before auto-generation so these always win.
                    </p>
                    <table class="widefat testtag-map-table" id="testtag-map-table">
                        <thead>
                            <tr>
                                <th>CSS Selector</th>
                                <th>Tag value</th>
                                <th width="80"></th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php foreach ( $map as $i => $row ) : ?>
                            <tr class="testtag-row">
                                <td><input type="text"
                                    name="<?php echo self::OPTION_SELECTOR_MAP; ?>[<?php echo $i; ?>][selector]"
                                    value="<?php echo esc_attr( $row['selector'] ); ?>"
                                    placeholder="nav a[href='#about']"
                                    class="regular-text" /></td>
                                <td><input type="text"
                                    name="<?php echo self::OPTION_SELECTOR_MAP; ?>[<?php echo $i; ?>][testid]"
                                    value="<?php echo esc_attr( $row['testid'] ); ?>"
                                    placeholder="nav-about"
                                    class="regular-text" /></td>
                                <td><button type="button" class="button testtag-remove-row">Remove</button></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td colspan="3">
                                    <button type="button" class="button button-secondary" id="testtag-add-row">+ Add Row</button>
                                    <button type="button" class="button" id="testtag-reset-defaults">Reset to Defaults</button>
                                </td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <?php submit_button( 'Save Settings' ); ?>
            </form>

            <div class="testtag-card">
                <h2>Export / Import Settings</h2>
                <p class="description">
                    Back up your selector map, attribute key, and injection settings to a JSON file —
                    or restore them on another site.
                </p>

                <div class="testtag-io-row">
                    <div>
                        <h3>Export</h3>
                        <p class="description">Download all current settings as a <code>.json</code> file.</p>
                        <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
                            <input type="hidden" name="action" value="testtag_export" />
                            <?php wp_nonce_field( 'testtag_export' ); ?>
                            <button type="submit" class="button button-secondary">Export Settings</button>
                        </form>
                    </div>

                    <div>
                        <h3>Import</h3>
                        <p class="description">Upload a previously exported <code>.json</code> file. <strong>This will overwrite your current settings.</strong></p>
                        <form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" enctype="multipart/form-data">
                            <input type="hidden" name="action" value="testtag_import" />
                            <?php wp_nonce_field( 'testtag_import' ); ?>
                            <div class="testtag-import-row">
                                <input type="file" name="testtag_import_file" accept=".json" id="testtag-import-file" />
                                <button type="submit" class="button button-primary" id="testtag-import-btn" disabled>Import Settings</button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>

            <?php elseif ( $tab === 'about' ) : ?>

            <div class="testtag-card">
                <h2>About the Author</h2>
                <div class="testtag-author">
                    <div class="testtag-author-name">Gary Young III</div>
                    <p class="description">
                        TestTag is offered as <strong>pay what you want</strong>. If it saves you time,
                        you can support the project with a pay-what-you-want contribution.
                    </p>
                    <div class="testtag-author-links">
                        <?php foreach ( self::get_author_links() as $link ) : ?>
                        <a href="<?php echo esc_url( $link['url'] ); ?>"
                           class="button button-secondary testtag-author-link"
                           target="_blank" rel="noopener noreferrer">
                            <?php echo esc_html( $link['label'] ); ?>
                        </a>
                        <?php endforeach; ?>
                    </div>
                </div>
            </div>

            <div class="testtag-card">
                <h2>License</h2>
                <p>
                    TestTag for WordPress is open-source software licensed under the
                    <a href="https://www.gnu.org/licenses/gpl-2.0.html" target="_blank" rel="noopener noreferrer">GNU General Public License v2.0 or later</a>.
                    You are free to use, modify, and distribute it under those terms.
                </p>
                <p>
                    <a href="https://github.com/garyyoungiii/testtag-for-wordpress" target="_blank" rel="noopener noreferrer">View on GitHub</a>
                </p>
            </div>

            <div class="testtag-card">
                <h2>Changelog</h2>
                <div class="testtag-changelog">
                    <?php foreach ( self::get_changelog() as $entry ) : ?>
                    <div class="testtag-changelog-entry">
                        <div class="testtag-changelog-header">
                            <span class="testtag-changelog-version">v<?php echo esc_html( $entry['version'] ); ?></span>
                            <span class="testtag-changelog-date"><?php echo esc_html( $entry['date'] ); ?></span>
                        </div>
                        <ul>
                            <?php foreach ( $entry['changes'] as $change ) : ?>
                            <li><?php echo wp_kses( $change, [ 'code' => [], 'strong' => [], 'em' => [] ] ); ?></li>
                            <?php endforeach; ?>
                        </ul>
                    </div>
                    <?php endforeach; ?>
                </div>
            </div>

            <?php endif; ?>
        </div>
        <?php
    }

    private static function get_author_links(): array {
        $links = [
            [ 'label' => 'Website',  'url' => 'https://garyyoungiii.com' ],
            [ 'label' => 'Fiverr',   'url' => '' ],
            [ 'label' => 'Upwork',   'url' => '' ],
            [ 'label' => 'Support TestTag (Pay What You Want)', 'url' => 'https://soloprenero.com/buy/testtag-for-wordpress/' ],
        ];
        return array_values( array_filter( $links, fn( $l ) => ! empty( $l['url'] ) ) );
    }

    private static function get_changelog(): array {
        return [
            [
                'version' => '1.5.0',
                'date'    => '2026-04-06',
                'changes' => [
                    'New: String format configuration — choose <strong>separator</strong> (<code>-</code> or <code>_</code>), whether to <strong>include the element type</strong>, and whether it appears <strong>before or after the identifier</strong>.',
                    'Settings are in the <em>Test Tag Format</em> card alongside the existing attribute key field.',
                    'Separator applies to both the type/identifier join and word boundaries within slugs (e.g. <code>button_send_message</code> with <code>_</code>).',
                    'Dedup counter suffixes now also use the configured separator.',
                    'String format settings are included in Export / Import.',
                ],
            ],
            [
                'version' => '1.4.1',
                'date'    => '2026-04-04',
                'changes' => [
                    'CI/release hardening only (no runtime plugin behavior changes).',
                    'Updated GitHub Actions for Node 24 transition readiness.',
                    'Release packaging now validates required files and excludes non-runtime project files.',
                ],
            ],
            [
                'version' => '1.4.1-beta',
                'date'    => '2026-03-21',
                'changes' => [
                    'Card-style anchors (an <code>&lt;a&gt;</code> wrapping block-level content) now tagged as <code>link-{ancestor}</code> instead of embedding link text.',
                    'Paragraph elements (<code>&lt;p&gt;</code>) now tagged as <code>text-{ancestor}</code>; prose content is never embedded in the tag value.',
                    'Dedup is now scoped per-parent element rather than page-wide; sibling containers each receive clean base values without global counters.',
                ],
            ],
            [
                'version' => '1.4.0',
                'date'    => '2026-03-21',
                'changes' => [
                    'New: Export / Import Settings — download current settings as a dated JSON file and restore on any site.',
                    'New: Dynamic injector (<code>js/dynamic-injector.js</code>) — MutationObserver applies selector map and auto-generation to AJAX-loaded content client-side.',
                    'Dynamic injector never overwrites server-side tags; server-side always wins.',
                    'Dynamic dedup tracked independently from server-side tags; value collisions are intentional and resolved by scoping locators.',
                ],
            ],
        ];
    }
}
