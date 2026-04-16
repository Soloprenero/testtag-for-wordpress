<?php
defined( 'ABSPATH' ) || exit;

/**
 * TestTag_HTML_Processor
 *
 * Buffers the full page HTML output and injects the configured attribute
 * (data-testid, data-cy, etc.) server-side, so tags are present in the
 * raw HTML source before any JavaScript runs.
 *
 * Two layers applied in order — same priority as the JS engine:
 *   1. Selector map   — mapped via CSS-to-XPath translation
 *   2. Auto-generate  — inferred from element semantics
 *
 * After all layers run, duplicate values are suffixed (-2, -3, …).
 */
class TestTag_HTML_Processor {

    private static string $attr          = 'data-testid';
    private static string $layer_key     = 'data-testtag-layer';
    private static bool   $buffer_started = false;
    private static string $separator     = '-';
    private static array  $token_order = [ 'type', 'identifier' ];
    private static array  $format_seps = [ '-' ];

    /**
     * Within-request (and cross-request in PHP-FPM) memoization caches.
     *
     * slug_cache  — keyed by separator + "\0" + raw string.
     * clean_cache — keyed by separator + "\0" + raw string.
     * xpath_cache — keyed by raw CSS selector. Not invalidated by settings
     *               changes (pure function), but reset when it reaches
     *               MAX_CACHE_ENTRIES to cap memory usage.
     *
     * All caches are capped at MAX_CACHE_ENTRIES to prevent unbounded memory
     * growth in long-running PHP-FPM workers.
     */
    private static array $slug_cache  = [];
    private static array $clean_cache = [];
    private static array $xpath_cache = [];
    private const MAX_CACHE_ENTRIES   = 512;

    public static function init(): void {
        add_action( 'template_redirect', [ __CLASS__, 'start_buffer' ] );
        add_action( 'current_screen',    [ __CLASS__, 'maybe_start_admin_buffer' ] );
        add_filter( 'render_block',      [ __CLASS__, 'inject_block_attribute' ], 10, 2 );
    }

    // ─────────────────────────────────────────────────────────────
    // Block render — manual override injection
    // ─────────────────────────────────────────────────────────────

    /**
     * Injects a manual testtagValue block attribute into the rendered HTML of a
     * block, using the WP_HTML_Tag_Processor parser rather than a regex.
     *
     * Fires on the `render_block` filter so it covers both static (saved-content)
     * blocks and dynamic (server-side rendered) blocks.  The JS
     * `blocks.getSaveContent.extraProps` filter handles serialization for static
     * blocks in the editor; this PHP filter is the authoritative source for all
     * front-end output.
     *
     * @param string $block_content Rendered block HTML.
     * @param array  $block         Parsed block data including 'attrs'.
     * @return string Possibly-modified block HTML.
     */
    public static function inject_block_attribute( string $block_content, array $block ): string {
        if ( ! TestTag_Settings::is_enabled() ) {
            return $block_content;
        }

        $value = $block['attrs']['testtagValue'] ?? '';
        if ( ! is_string( $value ) || '' === $value ) {
            return $block_content;
        }

        if ( ! class_exists( 'WP_HTML_Tag_Processor' ) ) {
            return $block_content;
        }

        $attr      = TestTag_Settings::get_attribute_key();
        $processor = new WP_HTML_Tag_Processor( $block_content );

        if ( ! $processor->next_tag() ) {
            return $block_content;
        }

        $processor->set_attribute( $attr, $value );

        return $processor->get_updated_html();
    }

    // ─────────────────────────────────────────────────────────────
    // Output buffer
    // ─────────────────────────────────────────────────────────────

    public static function start_buffer(): void {
        if ( self::$buffer_started ) return;
        if ( ! TestTag_Settings::is_enabled() ) return;

        if ( is_admin() && ! self::is_admin_html_request() ) return;

        $prev_separator      = self::$separator;
        self::$attr          = TestTag_Settings::get_attribute_key();
        self::$separator     = TestTag_Settings::get_separator();
        self::$token_order = TestTag_Settings::get_token_order();
        self::$format_seps = TestTag_Settings::get_format_seps();

        // Flush separator-dependent caches when the configured separator changes.
        if ( self::$separator !== $prev_separator ) {
            self::$slug_cache  = [];
            self::$clean_cache = [];
        }

        self::$buffer_started = true;
        ob_start( [ __CLASS__, 'process_html' ] );
    }

    public static function maybe_start_admin_buffer( WP_Screen $screen ): void {
        if ( ! is_admin() ) return;
        if ( ! self::should_buffer_admin_screen( $screen ) ) return;
        self::start_buffer();
    }

    private static function should_buffer_admin_screen( WP_Screen $screen ): bool {
        if ( $screen->base === 'admin-post' ) return false;
        if ( $screen->base === 'admin-ajax' ) return false;
        if ( $screen->is_network ) return false;
        return true;
    }

    private static function is_admin_html_request(): bool {
        if ( wp_doing_ajax() ) return false;
        if ( wp_doing_cron() ) return false;
        if ( function_exists( 'wp_is_json_request' ) && wp_is_json_request() ) return false;
        if ( defined( 'REST_REQUEST' ) && REST_REQUEST ) return false;
        if ( defined( 'XMLRPC_REQUEST' ) && XMLRPC_REQUEST ) return false;
        return true;
    }

    public static function process_html( string $html ): string {
        if ( empty( trim( $html ) ) ) return $html;

        // ── Preserve <script type="text/html"> templates ─────────────
        // PHP's DOMDocument (libxml) mangles <script type="text/html">
        // content: the HTML parser partially parses the template markup,
        // strips closing tags, and — crucially — lets inner elements
        // escape the script block into the page body when saveHTML()
        // re-serialises the document.  On WordPress admin pages this
        // causes Backbone/Underscore template elements (media library,
        // auth-check, etc.) to be rendered as real HTML, producing a
        // blank white popup visible on Settings → General and elsewhere.
        // Fix: stash every <script type="text/html"> block before passing
        // the HTML to DOMDocument and restore the originals afterwards.
        //
        // A per-call random nonce makes placeholders collision-resistant:
        // it is astronomically unlikely that real HTML already contains
        // the pattern  <!-- TESTTAG_TPL_{nonce}_{n} -->.
        $stashed_templates = [];
        $nonce             = bin2hex( random_bytes( 8 ) );
        $html              = preg_replace_callback(
            '/<script\b[^>]*\btype=["\']text\/html["\'][^>]*>.*?<\/script>/si',
            static function ( array $m ) use ( &$stashed_templates, $nonce ): string {
                $key                       = '<!-- TESTTAG_TPL_' . $nonce . '_' . count( $stashed_templates ) . ' -->';
                $stashed_templates[ $key ] = $m[0];
                return $key;
            },
            $html
        ) ?? $html;

        // Suppress libxml warnings on real-world HTML.
        $prev = libxml_use_internal_errors( true );

        $doc = new DOMDocument( '1.0', 'UTF-8' );

        // loadHTML mangles UTF-8 without this meta hint.
        $wrapped = '<?xml encoding="UTF-8">' . $html;
        if ( ! $doc->loadHTML( $wrapped, LIBXML_NOERROR | LIBXML_NOWARNING ) ) {
            libxml_use_internal_errors( $prev );
            return $html;
        }
        libxml_clear_errors();
        libxml_use_internal_errors( $prev );

        $xpath = new DOMXPath( $doc );

        // Layer 1 — selector map.
        self::apply_selector_map( $doc, $xpath );

        // Layer 2 — auto-generate.
        self::auto_generate( $doc, $xpath );

        // Dedup.
        self::dedup( $xpath );

        // Serialise back to HTML, strip the xml declaration wrapper.
        $out = $doc->saveHTML();
        $out = preg_replace( '/^<\?xml[^>]+>\n?/', '', $out );

        // ── Restore stashed <script type="text/html"> templates ──────
        if ( ! empty( $stashed_templates ) ) {
            $out = str_replace(
                array_keys( $stashed_templates ),
                array_values( $stashed_templates ),
                $out
            );
        }

        return $out ?: $html;
    }

    // ─────────────────────────────────────────────────────────────
    // Layer 1 — Selector map (CSS → XPath)
    // ─────────────────────────────────────────────────────────────

    private static function apply_selector_map( DOMDocument $doc, DOMXPath $xpath ): void {
        $attr = self::$attr;
        foreach ( TestTag_Settings::get_selector_map() as $row ) {
            $selector = $row['selector'] ?? '';
            $testid   = $row['testid']   ?? '';
            if ( ! $selector || ! $testid ) continue;

            $xp = self::css_to_xpath( $selector );
            if ( ! $xp ) continue;

            try {
                $nodes = $xpath->query( $xp );
            } catch ( \Exception $e ) {
                continue;
            }
            if ( ! $nodes ) continue;

            foreach ( $nodes as $node ) {
                if ( ! ( $node instanceof DOMElement ) ) continue;
                if ( $node->hasAttribute( $attr ) ) continue;
                $node->setAttribute( $attr, $testid );
                $node->setAttribute( self::$layer_key, 'selector-map' );
            }
        }
    }

    /**
     * Minimal CSS→XPath translator covering the subset used in selector maps.
     * Handles: tag, .class, #id, [attr], [attr=val], [attr$=val], descendant ( ),
     * child (>), multiple selectors (,), :not(), common pseudo-classes stripped.
     *
     * Results are memoized in self::$xpath_cache (pure function; never invalidated).
     */
    private static function css_to_xpath( string $css ): ?string {
        if ( isset( self::$xpath_cache[ $css ] ) ) {
            // '' is used as the sentinel for a cached null (uncompilable selector).
            return self::$xpath_cache[ $css ] !== '' ? self::$xpath_cache[ $css ] : null;
        }

        $result = self::css_to_xpath_compute( $css );

        if ( count( self::$xpath_cache ) >= self::MAX_CACHE_ENTRIES ) {
            self::$xpath_cache = [];
        }
        // Store '' instead of null so isset() correctly detects cached entries.
        return ( self::$xpath_cache[ $css ] = $result ?? '' ) !== '' ? $result : null;
    }

    private static function css_to_xpath_compute( string $css ): ?string {
        // Multiple selectors — translate each and union them.
        if ( str_contains( $css, ',' ) ) {
            $parts = array_map( 'trim', explode( ',', $css ) );
            $xparts = [];
            foreach ( $parts as $part ) {
                $xp = self::css_to_xpath( $part );
                if ( $xp ) $xparts[] = $xp;
            }
            return $xparts ? implode( ' | ', $xparts ) : null;
        }

        $css = trim( $css );

        // Tokenise into simple segments split by combinator.
        // We support: ' ' (descendant), '>' (child).
        $tokens = preg_split( '/\s*(>)\s*|\s+/', $css, -1, PREG_SPLIT_DELIM_CAPTURE | PREG_SPLIT_NO_EMPTY );

        $xpath  = '';
        $combinator = '//'; // start with descendant from root

        foreach ( $tokens as $token ) {
            if ( $token === '>' ) {
                $combinator = '/';
                continue;
            }

            $part  = $token;
            $xnode = '*';   // element name
            $conds = [];    // XPath predicates

            // Tag name
            if ( preg_match( '/^([a-zA-Z][a-zA-Z0-9]*)/', $part, $m ) ) {
                $xnode = strtolower( $m[1] );
                $part  = substr( $part, strlen( $m[0] ) );
            }

            // Process remaining simple selectors on this token.
            while ( $part !== '' ) {
                // #id
                if ( preg_match( '/^#([\w-]+)/', $part, $m ) ) {
                    $conds[] = '@id=' . self::xpath_quote( $m[1] );
                    $part = substr( $part, strlen( $m[0] ) );
                }
                // .class
                elseif ( preg_match( '/^\.([\w-]+)/', $part, $m ) ) {
                    $conds[] = 'contains(concat(" ",normalize-space(@class)," ")," ' . $m[1] . ' ")';
                    $part = substr( $part, strlen( $m[0] ) );
                }
                // [attr$=val] ends-with
                elseif ( preg_match( '/^\[([^\]~\|^$*!]+)\$=["\']?([^"\'\\]]*)["\']?\]/', $part, $m ) ) {
                    $conds[] = 'substring(@' . $m[1] . ',string-length(@' . $m[1] . ')-' . (strlen($m[2])-1) . ')=' . self::xpath_quote( $m[2] );
                    $part = substr( $part, strlen( $m[0] ) );
                }
                // [attr*=val] contains
                elseif ( preg_match( '/^\[([^\]~\|^$*!]+)\*=["\']?([^"\'\\]]*)["\']?\]/', $part, $m ) ) {
                    $conds[] = 'contains(@' . $m[1] . ',' . self::xpath_quote( $m[2] ) . ')';
                    $part = substr( $part, strlen( $m[0] ) );
                }
                // [attr=val]
                elseif ( preg_match( '/^\[([^\]~\|^$*!=]+)=["\']?([^"\'\\]]*)["\']?\]/', $part, $m ) ) {
                    $conds[] = '@' . $m[1] . '=' . self::xpath_quote( $m[2] );
                    $part = substr( $part, strlen( $m[0] ) );
                }
                // [attr] bare presence
                elseif ( preg_match( '/^\[([^\]]+)\]/', $part, $m ) ) {
                    $conds[] = '@' . trim( $m[1] );
                    $part = substr( $part, strlen( $m[0] ) );
                }
                // Strip pseudo-classes/elements we can't translate
                elseif ( preg_match( '/^::?[\w-]+(\([^)]*\))?/', $part, $m ) ) {
                    $part = substr( $part, strlen( $m[0] ) );
                }
                else {
                    break; // unknown — stop
                }
            }

            $predicate = $conds ? '[' . implode( ' and ', $conds ) . ']' : '';
            $xpath    .= $combinator . $xnode . $predicate;
            $combinator = '//'; // reset to descendant after first segment
        }

        return $xpath ?: null;
    }

    // ─────────────────────────────────────────────────────────────
    // Layer 2 — Auto-generate
    // ─────────────────────────────────────────────────────────────

    private static function auto_generate( DOMDocument $doc, DOMXPath $xpath ): void {
        $targets_xp = implode( ' | ', [
            '//a', '//button',
            '//input', '//textarea', '//select', '//option', '//form',
            '//section', '//article', '//aside', '//main', '//header', '//footer', '//nav',
            '//h1', '//h2', '//h3', '//h4', '//h5', '//h6',
            '//p',
            '//img',
            '//ul', '//ol', '//li',
            '//table', '//tr', '//th', '//td',
            '//fieldset',
            '//details', '//summary',
            '//figure',
            '//*[@id]',
            '//*[@role]',
            '//*[@data-element_type]',
            '//*[@data-widget_type]',
            '//*[contains(@class,"wp-block-")]',
        ] );

        $attr          = self::$attr;
        $text_fallback = TestTag_Settings::get_text_fallback();

        // Pre-build a label-for map: element-id → label text.
        // This replaces per-element XPath queries in get_label_text() with a
        // single up-front pass, reducing XPath overhead from O(n) to O(1).
        $label_map = self::build_label_map( $xpath );

        $nodes = $xpath->query( $targets_xp );
        if ( ! $nodes ) return;

        foreach ( $nodes as $node ) {
            if ( ! ( $node instanceof DOMElement ) ) continue;
            if ( $node->hasAttribute( $attr ) ) continue;
            $value = self::auto_id( $node, $xpath, $text_fallback, $label_map );
            if ( ! $value ) continue;
            $node->setAttribute( $attr, $value );
            $node->setAttribute( self::$layer_key, 'auto' );
        }
    }

    /**
     * Builds a map from element IDs to associated label text.
     * Scans all <label for="..."> elements once so get_label_text() can do a
     * simple array lookup instead of running a per-element XPath query.
     *
     * @param DOMXPath $xpath
     * @return array<string,string>  id → label text
     */
    private static function build_label_map( DOMXPath $xpath ): array {
        $map    = [];
        $labels = $xpath->query( '//label[@for]' );
        if ( ! $labels ) return $map;
        foreach ( $labels as $label ) {
            if ( ! ( $label instanceof DOMElement ) ) continue;
            $for = $label->getAttribute( 'for' );
            // Store only the first matching label in DOM order (including empty
            // text) so lookup behaviour is identical to the previous per-element
            // XPath query which returned the first label found.
            if ( $for && ! isset( $map[ $for ] ) ) {
                $map[ $for ] = trim( $label->textContent );
            }
        }
        return $map;
    }

    private static function auto_id( DOMElement $el, DOMXPath $xpath, bool $text_fallback = true, array $label_map = [] ): ?string {
        $tag = strtolower( $el->tagName );
        $tv  = self::element_token_values( $el, $xpath );

        // ── Form controls ─────────────────────────────────────────
        if ( in_array( $tag, [ 'input', 'textarea', 'select' ], true ) ) {
            $type  = strtolower( $el->getAttribute( 'type' ) ?: $tag );
            $label = self::get_label_text( $el, $xpath, $label_map );
            $hint  = $label
                ?: $el->getAttribute( 'name' )
                ?: $el->getAttribute( 'placeholder' )
                ?: '';

            if ( $type === 'hidden' )  return null; // never tag hidden inputs
            if ( $type === 'search' )  return self::format_id( 'input', 'search', $tv );
            if ( in_array( $type, [ 'submit', 'button' ], true ) ) return self::format_id( 'button', self::slug( $el->getAttribute( 'value' ) ?: $hint ?: 'submit' ), $tv );
            if ( $type === 'checkbox' ) return self::format_id( 'checkbox', self::slug( $hint ), $tv );
            if ( $type === 'radio' )   return self::format_id( 'radio', self::slug( $hint ), $tv );
            if ( $tag === 'select' )   return self::format_id( 'select', self::slug( $hint ), $tv );
            if ( $tag === 'textarea' ) return self::format_id( 'textarea', self::slug( $hint ), $tv );
            return self::format_id( 'input', self::slug( $hint ?: $type ), $tv );
        }

        // ── Buttons ───────────────────────────────────────────────
        if ( $tag === 'button' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'button', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'button', $clean, $tv );
            }
            $name = $el->getAttribute( 'name' );
            if ( $name ) return self::format_id( 'button', self::slug( $name ), $tv );
            $value = $el->getAttribute( 'value' );
            if ( $value ) return self::format_id( 'button', self::slug( $value ), $tv );
            if ( $text_fallback ) {
                $text = trim( $el->textContent );
                if ( $text ) return self::format_id( 'button', self::slug( $text ), $tv );
            }
            return null;
        }

        // ── Links ─────────────────────────────────────────────────
        if ( $tag === 'a' ) {
            $href     = $el->getAttribute( 'href' ) ?: '';
            $linkText = trim( $el->textContent );

            if ( self::ancestor_matches( $el, [ 'nav', 'header' ] ) ||
                 self::has_class_fragment( $el, 'elementor-nav' ) ) {
                $al = $el->getAttribute( 'aria-label' );
                if ( $al ) return self::format_id( 'nav', self::slug( $al ), $tv );
                if ( $href === '/' ) return self::format_id( 'nav', 'home', $tv );
                if ( str_starts_with( $href, '#' ) ) {
                    $frag = self::slug( substr( $href, 1 ) );
                    if ( $frag ) return self::format_id( 'nav', $frag, $tv );
                }
                $frag = self::href_path_fragment( $href );
                if ( $frag ) return self::format_id( 'nav', $frag, $tv );
                if ( $text_fallback ) return self::format_id( 'nav', self::slug( $linkText ?: $href ), $tv );
                return null;
            }

            if ( preg_match( '/\.(pdf|docx?|xlsx?|pptx?|zip)$/i', $href ) ) {
                $al = $el->getAttribute( 'aria-label' );
                if ( $al ) return self::format_id( 'download', self::slug( $al ), $tv );
                if ( $text_fallback && $linkText ) return self::format_id( 'download', self::slug( $linkText ), $tv );
                return self::format_id( 'download', self::slug( basename( $href ) ), $tv );
            }

            // Card-style anchor: an <a> wrapping block-level content (image, heading,
            // paragraph, div). Treat like a paragraph — use nearest tagged ancestor
            // as the prefix so card links stay scoped to their container.
            foreach ( [ 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'article', 'section', 'ul', 'ol' ] as $block ) {
                if ( $el->getElementsByTagName( $block )->length > 0 ) {
                    $parent = $el->parentNode;
                    while ( $parent instanceof DOMElement ) {
                        if ( $parent->hasAttribute( self::$attr ) ) {
                            return self::format_id( 'link', $parent->getAttribute( self::$attr ), $tv );
                        }
                        $parent = $parent->parentNode;
                    }
                    return null;
                }
            }

            // Regular link — stable-first
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'link', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'link', $clean, $tv );
            }
            $frag = self::href_path_fragment( $href );
            if ( $frag ) return self::format_id( 'link', $frag, $tv );
            if ( str_starts_with( $href, '#' ) ) {
                $frag = self::slug( substr( $href, 1 ) );
                if ( $frag ) return self::format_id( 'link', $frag, $tv );
            }
            if ( $text_fallback && $linkText ) return self::format_id( 'link', self::slug( $linkText ), $tv );
            return null;
        }

        // ── Navigation ────────────────────────────────────────────
        if ( $tag === 'nav' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'nav', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'nav', $clean, $tv );
            }
            if ( $text_fallback ) {
                $h = self::first_heading_text( $el );
                if ( $h ) return self::format_id( 'nav', self::slug( $h ), $tv );
            }
            return null;
        }

        // ── Landmark elements ─────────────────────────────────────
        if ( in_array( $tag, [ 'section', 'article', 'aside', 'main', 'header', 'footer' ], true ) ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( $tag, self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( $tag, $clean, $tv );
            }
            if ( $text_fallback ) {
                $h = self::first_heading_text( $el );
                if ( $h ) return self::format_id( $tag, self::slug( $h ), $tv );
            }
            return null;
        }

        // ── Headings ──────────────────────────────────────────────
        if ( preg_match( '/^h[1-6]$/', $tag ) ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'heading', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'heading', $clean, $tv );
            }
            if ( $text_fallback ) {
                $text = trim( $el->textContent );
                if ( $text ) return self::format_id( 'heading', self::slug( $text ), $tv );
            }
            return null;
        }

        // ── Paragraphs ────────────────────────────────────────────
        // Use the nearest tagged ancestor's value as a prefix so paragraphs
        // stay scoped to their container. Never embed prose content in the tag.
        if ( $tag === 'p' ) {
            $parent = $el->parentNode;
            while ( $parent instanceof DOMElement ) {
                if ( $parent->hasAttribute( self::$attr ) ) {
                    return self::format_id( 'text', $parent->getAttribute( self::$attr ), $tv );
                }
                $parent = $parent->parentNode;
            }
            return null;
        }

        // ── Forms ─────────────────────────────────────────────────
        if ( $tag === 'form' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'form', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'form', $clean, $tv );
            }
            if ( $text_fallback ) {
                $fl = $el->getElementsByTagName( 'legend' )->item( 0 )
                   ?? self::first_heading_element( $el );
                if ( $fl ) {
                    $t = trim( $fl->textContent );
                    if ( $t ) return self::format_id( 'form', self::slug( $t ), $tv );
                }
            }
            return 'form';
        }

        // ── Images ────────────────────────────────────────────────
        if ( $tag === 'img' ) {
            $alt = $el->getAttribute( 'alt' );
            return $alt ? self::format_id( 'img', self::slug( $alt ), $tv ) : null;
        }

        // ── Lists ─────────────────────────────────────────────────
        if ( $tag === 'ul' || $tag === 'ol' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'list', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'list', $clean, $tv );
            }
            if ( $text_fallback ) {
                $h = self::first_heading_text( $el );
                if ( $h ) return self::format_id( 'list', self::slug( $h ), $tv );
            }
            return null;
        }

        // ── List items ────────────────────────────────────────────
        if ( $tag === 'li' ) {
            $relVal    = $el->getAttribute( 'rel' );
            $parentEl  = $el->parentNode instanceof DOMElement ? $el->parentNode : null;
            $parentCls = $parentEl ? $parentEl->getAttribute( 'class' ) : '';
            $isSelectList = $parentEl && (
                str_contains( $parentCls, 'select' ) ||
                str_contains( $parentCls, 'options' )
            );

            if ( $isSelectList || $relVal ) {
                // Custom select option — walk up to find a data-name wrapper or sibling <select>
                $optValue  = $relVal ?: ( $text_fallback ? trim( $el->textContent ) : '' );
                if ( ! $optValue ) return null;
                $optSlug   = self::slug( $optValue );
                if ( ! $optSlug ) return null;
                $selectName = null;
                $walker    = $el->parentNode;
                while ( $walker instanceof DOMElement ) {
                    if ( $walker->hasAttribute( 'data-name' ) ) {
                        $selectName = $walker->getAttribute( 'data-name' );
                        break;
                    }
                    foreach ( $walker->childNodes as $child ) {
                        if ( $child instanceof DOMElement && $child->tagName === 'select' && $child->hasAttribute( 'name' ) ) {
                            $selectName = $child->getAttribute( 'name' );
                            break 2;
                        }
                    }
                    $walker = $walker->parentNode;
                }
                return $selectName
                    ? self::format_id( 'option', self::slug( $selectName ) . self::$separator . $optSlug, $tv )
                    : self::format_id( 'option', $optSlug, $tv );
            }

            // Standard list item
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'item', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'item', $clean, $tv );
            }
            if ( $text_fallback ) {
                $text = trim( $el->textContent );
                if ( $text ) return self::format_id( 'item', self::slug( substr( $text, 0, 40 ) ), $tv );
            }
            return null;
        }

        // ── Native select options ─────────────────────────────────
        if ( $tag === 'option' ) {
            $value    = $el->getAttribute( 'value' );
            $optValue = ( $value !== '' ) ? $value : ( $text_fallback ? trim( $el->textContent ) : '' );
            if ( $optValue === '' ) return null;
            $optSlug  = self::slug( $optValue );
            if ( $optSlug === '' ) return null;
            // Find the parent <select>
            $selectEl = $el->parentNode;
            while ( $selectEl instanceof DOMElement && strtolower( $selectEl->tagName ) !== 'select' ) {
                $selectEl = $selectEl->parentNode;
            }
            $selectName = null;
            if ( $selectEl instanceof DOMElement ) {
                $selectName = $selectEl->getAttribute( 'name' ) ?: $selectEl->getAttribute( 'id' );
            }
            return $selectName
                ? self::format_id( 'option', self::slug( $selectName ) . self::$separator . $optSlug, $tv )
                : self::format_id( 'option', $optSlug, $tv );
        }

        // ── Tables ────────────────────────────────────────────────
        if ( $tag === 'table' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'table', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'table', $clean, $tv );
            }
            $caption = $el->getElementsByTagName( 'caption' )->item( 0 );
            if ( $caption ) {
                $text = trim( $caption->textContent );
                if ( $text ) return self::format_id( 'table', self::slug( $text ), $tv );
            }
            if ( $text_fallback ) {
                $h = self::first_heading_text( $el );
                if ( $h ) return self::format_id( 'table', self::slug( $h ), $tv );
            }
            return null;
        }

        // ── Table rows ────────────────────────────────────────────
        if ( $tag === 'tr' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'row', self::slug( $al ), $tv );
            // Position among sibling <tr> elements (1-indexed)
            $n    = 1;
            $prev = $el->previousSibling;
            while ( $prev ) {
                if ( $prev instanceof DOMElement && strtolower( $prev->tagName ) === 'tr' ) $n++;
                $prev = $prev->previousSibling;
            }
            return self::format_id( 'row', (string) $n, $tv );
        }

        // ── Table header cells ────────────────────────────────────
        if ( $tag === 'th' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'col', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'col', $clean, $tv );
            }
            if ( $text_fallback ) {
                $text = trim( $el->textContent );
                if ( $text ) return self::format_id( 'col', self::slug( $text ), $tv );
            }
            return null;
        }

        // ── Table data cells ──────────────────────────────────────
        if ( $tag === 'td' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'cell', self::slug( $al ), $tv );
            $headers = $el->getAttribute( 'headers' );
            if ( $headers ) return self::format_id( 'cell', self::slug( $headers ), $tv );
            // Column position among siblings (1-indexed)
            $col  = 1;
            $prev = $el->previousSibling;
            while ( $prev ) {
                if ( $prev instanceof DOMElement && in_array( strtolower( $prev->tagName ), [ 'td', 'th' ], true ) ) $col++;
                $prev = $prev->previousSibling;
            }
            return self::format_id( 'cell', (string) $col, $tv );
        }

        // ── Fieldsets ─────────────────────────────────────────────
        if ( $tag === 'fieldset' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'fieldset', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'fieldset', $clean, $tv );
            }
            if ( $text_fallback ) {
                $legend = $el->getElementsByTagName( 'legend' )->item( 0 );
                if ( $legend ) {
                    $text = trim( $legend->textContent );
                    if ( $text ) return self::format_id( 'fieldset', self::slug( $text ), $tv );
                }
            }
            return null;
        }

        // ── Details / Summary ─────────────────────────────────────
        if ( $tag === 'details' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'details', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'details', $clean, $tv );
            }
            if ( $text_fallback ) {
                $summary = $el->getElementsByTagName( 'summary' )->item( 0 );
                if ( $summary ) {
                    $text = trim( $summary->textContent );
                    if ( $text ) return self::format_id( 'details', self::slug( $text ), $tv );
                }
            }
            return null;
        }

        if ( $tag === 'summary' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'summary', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'summary', $clean, $tv );
            }
            if ( $text_fallback ) {
                $text = trim( $el->textContent );
                if ( $text ) return self::format_id( 'summary', self::slug( $text ), $tv );
            }
            return null;
        }

        // ── Figures ───────────────────────────────────────────────
        if ( $tag === 'figure' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( 'figure', self::slug( $al ), $tv );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( 'figure', $clean, $tv );
            }
            if ( $text_fallback ) {
                $figcaption = $el->getElementsByTagName( 'figcaption' )->item( 0 );
                if ( $figcaption ) {
                    $text = trim( $figcaption->textContent );
                    if ( $text ) return self::format_id( 'figure', self::slug( $text ), $tv );
                }
            }
            return null;
        }

        // ── Divs / spans ──────────────────────────────────────────
        if ( $tag === 'div' || $tag === 'span' ) {
            // For auto-generated values use role (if present) or the HTML tag
            // as a prefix so the element type is always identifiable.
            $prefix = $el->getAttribute( 'role' ) ?: $tag;

            // 1. aria-label (most reliable stable source)
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return self::format_id( $prefix, self::slug( $al ), $tv );

            // 2. Stable id (non-numeric, cleaned)
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return self::format_id( $prefix, $clean, $tv );
            }

            // 3. Elementor section/container — data-element_type
            $eType = $el->getAttribute( 'data-element_type' );
            if ( $eType === 'section' || $eType === 'container' ) {
                if ( $text_fallback ) {
                    $h = self::first_heading_text( $el );
                    if ( $h ) return self::format_id( 'section', self::slug( $h ), $tv );
                }
                return null;
            }

            // 4. Elementor widget — data-widget_type
            $eWidget = $el->getAttribute( 'data-widget_type' );
            if ( $eWidget ) {
                $wType   = preg_replace( '/\.default$/', '', $eWidget );
                $wType   = preg_replace( '/^wp-widget-/', '', $wType );
                $cleaned = self::clean( self::slug( $wType ) );
                if ( $cleaned ) return self::format_id( $prefix, $cleaned, $tv );
                if ( $text_fallback ) {
                    $h = self::first_heading_text( $el );
                    if ( $h ) return self::format_id( $prefix, self::slug( $h ), $tv );
                }
                return null;
            }

            // 5. Gutenberg blocks — wp-block-* class slug
            $classes = preg_split( '/\s+/', $el->getAttribute( 'class' ) );
            foreach ( $classes as $cls ) {
                if ( str_starts_with( $cls, 'wp-block-' ) ) {
                    $blockName = substr( $cls, strlen( 'wp-block-' ) );
                    $cleaned   = self::clean( self::slug( $blockName ) );
                    if ( $cleaned ) return self::format_id( $prefix, $cleaned, $tv );
                    if ( $text_fallback ) {
                        $h = self::first_heading_text( $el );
                        if ( $h ) return self::format_id( $prefix, self::slug( $h ), $tv );
                    }
                    return null;
                }
            }

            // 6. role with text fallback label
            $role = $el->getAttribute( 'role' );
            if ( $role && $text_fallback ) {
                $label = self::slug( substr( trim( $el->textContent ), 0, 30 ) );
                if ( $label ) return self::format_id( $role, $label, $tv );
            }
        }

        return null;
    }

    // ─────────────────────────────────────────────────────────────
    // Dedup
    // ─────────────────────────────────────────────────────────────

    private static function dedup( DOMXPath $xpath ): void {
        $attr  = self::$attr;
        $nodes = $xpath->query( '//*[@' . $attr . ']' );
        if ( ! $nodes ) return;

        // Group tagged elements by their parent so counters reset between
        // unrelated containers — e.g. each product card gets its own
        // "post-title" rather than "post-title-2", "post-title-3" page-wide.
        $by_parent = [];
        foreach ( $nodes as $node ) {
            if ( ! ( $node instanceof DOMElement ) ) continue;
            $by_parent[ spl_object_id( $node->parentNode ) ][] = $node;
        }

        foreach ( $by_parent as $siblings ) {
            $seen = [];
            foreach ( $siblings as $node ) {
                $value = $node->getAttribute( $attr );
                if ( ! $value ) continue;
                if ( ! isset( $seen[ $value ] ) ) {
                    $seen[ $value ] = 1;
                } else {
                    $seen[ $value ]++;
                    $node->setAttribute( $attr, $value . self::$separator . $seen[ $value ] );
                }
            }
        }
    }

    // ─────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────

    /**
     * Safely quote a string for use inside an XPath predicate.
     *
     * Backslash is NOT an escape character in XPath 1.0 — addslashes() cannot
     * be used here.  This method wraps the value in double-quotes, or in single
     * quotes if it contains a double-quote, or uses XPath concat() when the
     * value contains both types of quotes.
     */
    private static function xpath_quote( string $val ): string {
        if ( strpos( $val, '"' ) === false ) {
            return '"' . $val . '"';
        }
        if ( strpos( $val, "'" ) === false ) {
            return "'" . $val . "'";
        }
        // Both quote types present — build a concat() expression.
        $parts = preg_split( '/(")/', $val, -1, PREG_SPLIT_DELIM_CAPTURE );
        $concat = [];
        foreach ( $parts as $part ) {
            if ( $part === '' ) continue;
            $concat[] = ( $part === '"' ) ? "'\"'" : ( '"' . $part . '"' );
        }
        return 'concat(' . implode( ',', $concat ) . ')';
    }

    /**
     * Returns the text of the label associated with a form control.
     *
     * Prefers the pre-built `$label_map` (id → label text) built by
     * build_label_map() to avoid repeated per-element XPath queries.
     * Falls back to aria-label / aria-labelledby for unlabelled controls.
     *
     * @param DOMElement       $el
     * @param DOMXPath         $xpath
     * @param array<string,string> $label_map  id → label text (from build_label_map)
     * @return string
     */
    private static function get_label_text( DOMElement $el, DOMXPath $xpath, array $label_map = [] ): string {
        $id = $el->getAttribute( 'id' );
        if ( $id ) {
            if ( isset( $label_map[ $id ] ) ) {
                return $label_map[ $id ];
            }
            // Fallback for callers that don't supply the pre-built map.
            $labels = $xpath->query( '//label[@for=' . self::xpath_quote( $id ) . ']' );
            if ( $labels && $labels->length > 0 ) {
                return trim( $labels->item( 0 )->textContent );
            }
        }
        // aria-label
        $al = $el->getAttribute( 'aria-label' );
        if ( $al ) return $al;
        // aria-labelledby
        $alby = $el->getAttribute( 'aria-labelledby' );
        if ( $alby ) {
            $ref = $xpath->query( '//*[@id=' . self::xpath_quote( $alby ) . ']' );
            if ( $ref && $ref->length > 0 ) return trim( $ref->item( 0 )->textContent );
        }
        return '';
    }

    private static function first_heading_text( DOMElement $el ): string {
        foreach ( [ 'h1','h2','h3','h4','h5','h6' ] as $htag ) {
            $found = $el->getElementsByTagName( $htag )->item( 0 );
            if ( $found ) {
                $text = trim( $found->textContent );
                if ( $text ) return $text;
            }
        }
        return '';
    }

    private static function first_heading_element( DOMElement $el ): ?DOMElement {
        foreach ( [ 'h1','h2','h3','h4','h5','h6' ] as $htag ) {
            $found = $el->getElementsByTagName( $htag )->item( 0 );
            if ( $found ) return $found;
        }
        return null;
    }

    private static function ancestor_matches( DOMElement $el, array $tags ): bool {
        $parent = $el->parentNode;
        while ( $parent && $parent instanceof DOMElement ) {
            if ( in_array( strtolower( $parent->tagName ), $tags, true ) ) return true;
            $parent = $parent->parentNode;
        }
        return false;
    }

    private static function has_class_fragment( DOMElement $el, string $fragment ): bool {
        return str_contains( $el->getAttribute( 'class' ), $fragment );
    }

    /**
     * Extracts a stable, slug-friendly path fragment from an href.
     * Returns the last non-empty path segment, or null for anchors / mailto / bare hosts.
     */
    private static function href_path_fragment( string $href ): ?string {
        if ( ! $href || $href === '/' ) return null;
        if ( str_starts_with( $href, '#' ) ) return null;
        if ( str_starts_with( $href, 'mailto:' ) ) return null;
        if ( str_starts_with( $href, 'tel:' ) ) return null;

        $path = parse_url( $href, PHP_URL_PATH ) ?: '';
        $path = trim( $path, '/' );
        if ( ! $path ) return null;

        // Use only the last path segment — strip file extensions
        $segments = explode( '/', $path );
        $segment  = end( $segments );
        $segment  = preg_replace( '/\.[a-z0-9]+$/i', '', $segment ); // strip extension
        $clean    = self::slug( $segment );

        return ( $clean && strlen( $clean ) > 1 ) ? $clean : null;
    }

    // ─────────────────────────────────────────────────────────────
    // slug(), format_id(), and clean() — PHP ports of the JS equivalents
    // ─────────────────────────────────────────────────────────────

    /**
     * Builds a formatted tag value by combining a semantic type string with
     * an identifier, applying the user-configured separator and token order.
     *
     * `$token_values` may provide explicit per-token values keyed by token name
     * (role, aria-label, aria-labelledby, placeholder, id, name). When a
     * specific token is active in the configured order and has an explicit value,
     * that value is used instead of the generic `$identifier` fallback.
     *
     * @param string $type         Semantic type, e.g. 'button', 'heading'.
     * @param string $identifier   Slugified identifier derived from element attrs.
     * @param array  $token_values Optional per-token values keyed by token name.
     * @return string
     */
    private static function format_id( string $type, string $identifier, array $token_values = [] ): string {
        $type_class  = [ 'type', 'role' ];
        $ident_class = [ 'identifier', 'aria-label', 'aria-labelledby', 'placeholder', 'id', 'name' ];

        // Build per-token value map seeded with explicit per-token values.
        $values = array_fill_keys( array_merge( $type_class, $ident_class ), '' );
        $values['type'] = $type;
        foreach ( $token_values as $token => $value ) {
            if ( array_key_exists( $token, $values ) && is_string( $value ) && $value !== '' ) {
                $values[ $token ] = $value;
            }
        }

        // Assign the fallback identifier to the first active ident-class token
        // that does not already have an explicit value (skip literal tokens).
        foreach ( self::$token_order as $token ) {
            if ( strncmp( $token, 'lit:', 4 ) === 0 ) continue;
            if ( in_array( $token, $ident_class, true ) && $values[ $token ] === '' ) {
                $values[ $token ] = $identifier;
                break;
            }
        }

        // Build the output, tracking original token indices for per-gap separators.
        $parts        = [];
        $part_indices = [];
        foreach ( self::$token_order as $i => $token ) {
            if ( strncmp( $token, 'lit:', 4 ) === 0 ) {
                $val = preg_replace( '/[^a-zA-Z0-9]/', '', substr( $token, 4 ) );
            } else {
                $val = $values[ $token ] ?? '';
            }
            if ( $val !== '' ) {
                $parts[]        = $val;
                $part_indices[] = $i;
            }
        }

        if ( empty( $parts ) ) return $type;

        $result = $parts[0];
        for ( $k = 1, $n = count( $parts ); $k < $n; $k++ ) {
            // Use the sep configured for the gap at position (part_indices[k] - 1).
            $sep     = self::$format_seps[ $part_indices[ $k ] - 1 ] ?? self::$separator;
            $result .= $sep . $parts[ $k ];
        }
        return $result;
    }

    /**
     * Extracts and slugifies per-token attribute values from a DOM element.
     * Used to populate concrete token slots (role, aria-label, id, etc.) in
     * format_id() so each configured token resolves to the right attribute.
     *
     * For aria-labelledby, referenced element texts are resolved via XPath.
     *
     * @param DOMElement $el
     * @param DOMXPath   $xpath
     * @return array<string,string>
     */
    /**
     * Returns the implicit ARIA role for an element when no explicit role attribute is set.
     */
    private static function inferred_aria_role( DOMElement $el ): string {
        $tag  = strtolower( $el->tagName );
        $type = strtolower( $el->getAttribute( 'type' ) );

        static $map = [
            'button'   => 'button',
            'a'        => 'link',
            'nav'      => 'navigation',
            'main'     => 'main',
            'header'   => 'banner',
            'footer'   => 'contentinfo',
            'aside'    => 'complementary',
            'article'  => 'article',
            'section'  => 'region',
            'form'     => 'form',
            'dialog'   => 'dialog',
            'table'    => 'table',
            'textarea' => 'textbox',
            'ul'       => 'list',
            'ol'       => 'list',
            'li'       => 'listitem',
            'img'      => 'img',
            'figure'   => 'figure',
            'details'  => 'group',
            'summary'  => 'button',
            'fieldset' => 'group',
            'meter'    => 'meter',
            'progress' => 'progressbar',
            'output'   => 'status',
            'hr'       => 'separator',
            'h1'       => 'heading',
            'h2'       => 'heading',
            'h3'       => 'heading',
            'h4'       => 'heading',
            'h5'       => 'heading',
            'h6'       => 'heading',
        ];

        if ( 'input' === $tag ) {
            $input_roles = [
                'button'   => 'button',
                'submit'   => 'button',
                'reset'    => 'button',
                'image'    => 'button',
                'checkbox' => 'checkbox',
                'radio'    => 'radio',
                'range'    => 'slider',
                'number'   => 'spinbutton',
                'search'   => 'searchbox',
                'email'    => 'textbox',
                'tel'      => 'textbox',
                'text'     => 'textbox',
                'url'      => 'textbox',
                'password' => 'textbox',
                ''         => 'textbox',
            ];
            return $input_roles[ $type ] ?? 'textbox';
        }

        if ( 'select' === $tag ) {
            return ( $el->hasAttribute( 'multiple' ) || (int) $el->getAttribute( 'size' ) > 1 ) ? 'listbox' : 'combobox';
        }

        return $map[ $tag ] ?? '';
    }

    private static function element_token_values( DOMElement $el, DOMXPath $xpath ): array {
        $values = [];

        $role = $el->getAttribute( 'role' ) ?: self::inferred_aria_role( $el );
        if ( $role ) {
            $values['role'] = self::slug( $role );
        }

        $al = $el->getAttribute( 'aria-label' );
        if ( $al ) {
            $values['aria-label'] = self::slug( $al );
        }

        // Resolve aria-labelledby IDs to their referenced elements' text.
        $alb_ids = trim( $el->getAttribute( 'aria-labelledby' ) );
        if ( $alb_ids ) {
            $texts = [];
            foreach ( preg_split( '/\s+/', $alb_ids ) as $ref_id ) {
                if ( ! $ref_id ) {
                    continue;
                }
                $escaped = str_replace( '"', '&quot;', $ref_id );
                $refs    = $xpath->query( '//*[@id="' . $escaped . '"]' );
                if ( $refs && $refs->length > 0 ) {
                    $text = trim( $refs->item( 0 )->textContent );
                    if ( $text ) {
                        $texts[] = $text;
                    }
                }
            }
            $resolved = $texts ? self::slug( implode( ' ', $texts ) ) : self::slug( $alb_ids );
            if ( $resolved ) {
                $values['aria-labelledby'] = $resolved;
            }
        }

        $ph = $el->getAttribute( 'placeholder' );
        if ( $ph ) {
            $values['placeholder'] = self::slug( $ph );
        }

        $id = $el->getAttribute( 'id' );
        if ( $id ) {
            $values['id'] = self::slug( $id );
        }

        $name = $el->getAttribute( 'name' );
        if ( $name ) {
            $values['name'] = self::slug( $name );
        }

        return $values;
    }

    private static function slug( string $str ): string {
        $sep = self::$separator;
        $key = $sep . "\0" . $str;
        if ( isset( self::$slug_cache[ $key ] ) ) {
            return self::$slug_cache[ $key ];
        }
        if ( count( self::$slug_cache ) >= self::MAX_CACHE_ENTRIES ) {
            self::$slug_cache = [];
        }
        $s = strtolower( $str );
        $s = preg_replace( '/<[^>]+>/', '', $s );          // strip HTML tags
        $s = preg_replace( '/[^a-z0-9]+/', $sep, $s );     // non-alphanumeric → separator
        $s = trim( $s, $sep );
        return self::$slug_cache[ $key ] = substr( $s, 0, 50 );
    }

    private static array $strip_prefixes = [];
    private static array $strip_segments = [];
    private static bool  $naming_rules_loaded = false;

    /**
     * Loads strip_prefixes and strip_segments from the canonical naming-rules.json
     * so the rule definitions are maintained in a single place shared with JS.
     */
    private static function load_naming_rules(): void {
        if ( self::$naming_rules_loaded ) return; // already loaded
        self::$naming_rules_loaded = true;
        $file  = TESTTAG_PLUGIN_DIR . 'src/naming-rules.json';
        if ( ! file_exists( $file ) ) return;
        $json  = file_get_contents( $file ); // phpcs:ignore WordPress.WP.AlternativeFunctions.file_get_contents_file_get_contents
        $rules = [];
        if ( $json ) {
            $decoded = json_decode( $json, true );
            if ( is_array( $decoded ) ) {
                $rules = $decoded;
            }
        }
        self::$strip_prefixes = $rules['stripPrefixes'] ?? [];
        self::$strip_segments = $rules['stripSegments'] ?? [];
    }

    /**
     * Returns the naming rules from the canonical naming-rules.json for use
     * by the dynamic injector JS via window.TESTTAG.namingRules.
     */
    public static function get_naming_rules(): array {
        self::load_naming_rules();
        return [
            'stripPrefixes' => self::$strip_prefixes,
            'stripSegments' => self::$strip_segments,
        ];
    }

    private static function clean( string $s ): string {
        if ( ! $s ) return $s;
        self::load_naming_rules();
        $sep = self::$separator;
        $key = $sep . "\0" . $s;
        if ( isset( self::$clean_cache[ $key ] ) ) {
            return self::$clean_cache[ $key ];
        }
        if ( count( self::$clean_cache ) >= self::MAX_CACHE_ENTRIES ) {
            self::$clean_cache = [];
        }
        $sep_q = preg_quote( $sep, '/' );
        $out   = $s;
        // Strip leading framework prefix (first match only).
        // Prefixes are defined with hyphens; translate to the current separator.
        foreach ( self::$strip_prefixes as $prefix ) {
            $prefix_sep = str_replace( '-', $sep, $prefix );
            if ( str_starts_with( $out, $prefix_sep ) ) {
                $out = substr( $out, strlen( $prefix_sep ) );
                break;
            }
        }
        // Strip standalone segment tokens separated by the current separator.
        $segments_re = '/(?:^|' . $sep_q . ')(' . implode( '|', self::$strip_segments ) . ')(?=' . $sep_q . '|$)/';
        $out = preg_replace( $segments_re, '', $out );
        // Collapse repeated separators and trim.
        $out = preg_replace( '/' . $sep_q . '{2,}/', $sep, $out );
        return self::$clean_cache[ $key ] = trim( $out, $sep );
    }
}
