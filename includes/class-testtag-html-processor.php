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

    private static string $attr      = 'data-testid';
    private static string $layer_key = 'data-testtag-layer';
    private static bool $buffer_started = false;

    public static function init(): void {
        add_action( 'template_redirect', [ __CLASS__, 'start_buffer' ] );
        add_action( 'current_screen',    [ __CLASS__, 'maybe_start_admin_buffer' ] );
    }

    // ─────────────────────────────────────────────────────────────
    // Output buffer
    // ─────────────────────────────────────────────────────────────

    public static function start_buffer(): void {
        if ( self::$buffer_started ) return;
        if ( ! TestTag_Settings::is_enabled() ) return;

        if ( is_admin() && ! self::is_admin_html_request() ) return;

        self::$attr = TestTag_Settings::get_attribute_key();
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
     */
    private static function css_to_xpath( string $css ): ?string {
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
            '//input', '//textarea', '//select', '//form',
            '//section', '//article', '//aside', '//main', '//header', '//footer',
            '//h1', '//h2', '//h3', '//h4', '//h5', '//h6',
            '//p',
            '//img',
            '//*[@id]',
            '//*[@role]',
            '//*[@data-element_type]',
            '//*[@data-widget_type]',
            '//*[contains(@class,"wp-block-")]',
            '//ul[contains(@class,"select")]//li',
            '//ul[contains(@class,"options")]//li',
            '//*[@rel and self::li]',
        ] );

        $attr          = self::$attr;
        $text_fallback = TestTag_Settings::get_text_fallback();
        $nodes         = $xpath->query( $targets_xp );
        if ( ! $nodes ) return;

        foreach ( $nodes as $node ) {
            if ( ! ( $node instanceof DOMElement ) ) continue;
            if ( $node->hasAttribute( $attr ) ) continue;
            $value = self::auto_id( $node, $xpath, $text_fallback );
            if ( ! $value ) continue;
            $node->setAttribute( $attr, $value );
            $node->setAttribute( self::$layer_key, 'auto' );
        }
    }

    private static function auto_id( DOMElement $el, DOMXPath $xpath, bool $text_fallback = true ): ?string {
        $tag = strtolower( $el->tagName );

        // ── Form controls ─────────────────────────────────────────
        if ( in_array( $tag, [ 'input', 'textarea', 'select' ], true ) ) {
            $type  = strtolower( $el->getAttribute( 'type' ) ?: $tag );
            $label = self::get_label_text( $el, $xpath );
            $hint  = $label
                ?: $el->getAttribute( 'name' )
                ?: $el->getAttribute( 'placeholder' )
                ?: '';

            if ( $type === 'hidden' )  return null; // never tag hidden inputs
            if ( $type === 'search' )  return 'input-search';
            if ( in_array( $type, [ 'submit', 'button' ], true ) ) return 'button-' . self::slug( $el->getAttribute( 'value' ) ?: $hint ?: 'submit' );
            if ( $type === 'checkbox' ) return 'checkbox-' . self::slug( $hint );
            if ( $type === 'radio' )   return 'radio-'    . self::slug( $hint );
            if ( $tag === 'select' )   return 'select-'   . self::slug( $hint );
            if ( $tag === 'textarea' ) return 'textarea-' . self::slug( $hint );
            return 'input-' . self::slug( $hint ?: $type );
        }

        // ── Buttons ───────────────────────────────────────────────
        if ( $tag === 'button' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return 'button-' . self::slug( $al );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return 'button-' . $clean;
            }
            $name = $el->getAttribute( 'name' );
            if ( $name ) return 'button-' . self::slug( $name );
            $value = $el->getAttribute( 'value' );
            if ( $value ) return 'button-' . self::slug( $value );
            if ( $text_fallback ) {
                $text = trim( $el->textContent );
                if ( $text ) return 'button-' . self::slug( $text );
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
                if ( $al ) return 'nav-' . self::slug( $al );
                if ( $href === '/' ) return 'nav-home';
                if ( str_starts_with( $href, '#' ) ) return 'nav-' . self::slug( substr( $href, 1 ) );
                $frag = self::href_path_fragment( $href );
                if ( $frag ) return 'nav-' . $frag;
                if ( $text_fallback ) return 'nav-' . self::slug( $linkText ?: $href );
                return null;
            }

            if ( preg_match( '/\.(pdf|docx?|xlsx?|pptx?|zip)$/i', $href ) ) {
                $al = $el->getAttribute( 'aria-label' );
                if ( $al ) return 'download-' . self::slug( $al );
                if ( $text_fallback && $linkText ) return 'download-' . self::slug( $linkText );
                return 'download-' . self::slug( basename( $href ) );
            }

            // Card-style anchor: an <a> wrapping block-level content (image, heading,
            // paragraph, div). Treat like a paragraph — use nearest tagged ancestor
            // as the prefix so card links stay scoped to their container.
            foreach ( [ 'div', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'figure', 'article', 'section', 'ul', 'ol' ] as $block ) {
                if ( $el->getElementsByTagName( $block )->length > 0 ) {
                    $parent = $el->parentNode;
                    while ( $parent instanceof DOMElement ) {
                        if ( $parent->hasAttribute( self::$attr ) ) {
                            return 'link-' . $parent->getAttribute( self::$attr );
                        }
                        $parent = $parent->parentNode;
                    }
                    return null;
                }
            }

            // Regular link — stable-first
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return 'link-' . self::slug( $al );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return 'link-' . $clean;
            }
            $frag = self::href_path_fragment( $href );
            if ( $frag ) return 'link-' . $frag;
            if ( str_starts_with( $href, '#' ) ) return 'link-' . self::slug( substr( $href, 1 ) );
            if ( $text_fallback && $linkText ) return 'link-' . self::slug( $linkText );
            return null;
        }

        // ── Landmark elements ─────────────────────────────────────
        if ( in_array( $tag, [ 'section', 'article', 'aside', 'main', 'header', 'footer' ], true ) ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return $tag . '-' . self::slug( $al );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return $tag . '-' . $clean;
            }
            if ( $text_fallback ) {
                $h = self::first_heading_text( $el );
                if ( $h ) return $tag . '-' . self::slug( $h );
            }
            return null;
        }

        // ── Headings ──────────────────────────────────────────────
        if ( preg_match( '/^h[1-6]$/', $tag ) ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return 'heading-' . self::slug( $al );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return 'heading-' . $clean;
            }
            if ( $text_fallback ) {
                $text = trim( $el->textContent );
                if ( $text ) return 'heading-' . self::slug( $text );
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
                    return 'text-' . $parent->getAttribute( self::$attr );
                }
                $parent = $parent->parentNode;
            }
            return null;
        }

        // ── Forms ─────────────────────────────────────────────────
        if ( $tag === 'form' ) {
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return 'form-' . self::slug( $al );
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return 'form-' . $clean;
            }
            if ( $text_fallback ) {
                $fl = $el->getElementsByTagName( 'legend' )->item( 0 )
                   ?? self::first_heading_element( $el );
                if ( $fl ) {
                    $t = trim( $fl->textContent );
                    if ( $t ) return 'form-' . self::slug( $t );
                }
            }
            return 'form';
        }

        // ── Images ────────────────────────────────────────────────
        if ( $tag === 'img' ) {
            $alt = $el->getAttribute( 'alt' );
            return $alt ? 'img-' . self::slug( $alt ) : null;
        }

        // ── Custom select options ─────────────────────────────────
        if ( $tag === 'li' ) {
            $relVal = $el->getAttribute( 'rel' );
            $optValue = $relVal ?: ( $text_fallback ? trim( $el->textContent ) : '' );
            if ( ! $optValue ) return null;
            $optSlug = self::slug( $optValue );
            if ( ! $optSlug ) return null;

            // Walk up to find a data-name wrapper or sibling <select>
            $selectName = null;
            $parent = $el->parentNode;
            while ( $parent && $parent instanceof DOMElement ) {
                if ( $parent->hasAttribute( 'data-name' ) ) {
                    $selectName = $parent->getAttribute( 'data-name' );
                    break;
                }
                // Look for a sibling or descendant <select>
                foreach ( $parent->childNodes as $child ) {
                    if ( $child instanceof DOMElement && $child->tagName === 'select' && $child->hasAttribute( 'name' ) ) {
                        $selectName = $child->getAttribute( 'name' );
                        break 2;
                    }
                }
                $parent = $parent->parentNode;
            }

            return $selectName
                ? 'option-' . self::slug( $selectName ) . '-' . $optSlug
                : 'option-' . $optSlug;
        }

        // ── Divs / spans ──────────────────────────────────────────
        if ( $tag === 'div' || $tag === 'span' ) {
            // For auto-generated values use role (if present) or the HTML tag
            // as a prefix so the element type is always identifiable.
            $prefix = $el->getAttribute( 'role' ) ?: $tag;

            // 1. aria-label (most reliable stable source)
            $al = $el->getAttribute( 'aria-label' );
            if ( $al ) return $prefix . '-' . self::slug( $al );

            // 2. Stable id (non-numeric, cleaned)
            $id = $el->getAttribute( 'id' );
            if ( $id ) {
                $clean = self::clean( self::slug( $id ) );
                if ( $clean && ! ctype_digit( $clean ) && strlen( $clean ) > 1 ) return $prefix . '-' . $clean;
            }

            // 3. Elementor section/container — data-element_type
            $eType = $el->getAttribute( 'data-element_type' );
            if ( $eType === 'section' || $eType === 'container' ) {
                if ( $text_fallback ) {
                    $h = self::first_heading_text( $el );
                    if ( $h ) return 'section-' . self::slug( $h );
                }
                return null;
            }

            // 4. Elementor widget — data-widget_type
            $eWidget = $el->getAttribute( 'data-widget_type' );
            if ( $eWidget ) {
                $wType   = preg_replace( '/\.default$/', '', $eWidget );
                $wType   = preg_replace( '/^wp-widget-/', '', $wType );
                $cleaned = self::clean( self::slug( $wType ) );
                if ( $cleaned ) return $prefix . '-' . $cleaned;
                if ( $text_fallback ) {
                    $h = self::first_heading_text( $el );
                    if ( $h ) return $prefix . '-' . self::slug( $h );
                }
                return null;
            }

            // 5. Gutenberg blocks — wp-block-* class slug
            $classes = preg_split( '/\s+/', $el->getAttribute( 'class' ) );
            foreach ( $classes as $cls ) {
                if ( str_starts_with( $cls, 'wp-block-' ) ) {
                    $blockName = substr( $cls, strlen( 'wp-block-' ) );
                    $cleaned   = self::clean( self::slug( $blockName ) );
                    if ( $cleaned ) return $prefix . '-' . $cleaned;
                    if ( $text_fallback ) {
                        $h = self::first_heading_text( $el );
                        if ( $h ) return $prefix . '-' . self::slug( $h );
                    }
                    return null;
                }
            }

            // 6. role with text fallback label
            $role = $el->getAttribute( 'role' );
            if ( $role && $text_fallback ) {
                $label = self::slug( substr( trim( $el->textContent ), 0, 30 ) );
                if ( $label ) return $role . '-' . $label;
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
                    $node->setAttribute( $attr, $value . '-' . $seen[ $value ] );
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

    private static function get_label_text( DOMElement $el, DOMXPath $xpath ): string {
        $id = $el->getAttribute( 'id' );
        if ( $id ) {
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
    // slug() and clean() — PHP ports of the JS equivalents
    // ─────────────────────────────────────────────────────────────

    private static function slug( string $str ): string {
        $str = strtolower( $str );
        $str = preg_replace( '/<[^>]+>/', '', $str );          // strip HTML tags
        $str = preg_replace( '/[^a-z0-9]+/', '-', $str );      // non-alphanumeric → hyphen
        $str = trim( $str, '-' );
        return substr( $str, 0, 50 );
    }

    private static array $strip_prefixes = [
        'core-', 'woocommerce-', 'wc-', 'wpcf7-f', 'gform-', 'gfield-', 'wp-', 'wordpress-',
    ];

    private static array $strip_segments = [
        'elementor', 'woocommerce', 'wc', 'core',
        'divi', 'avada', 'betheme', 'flatsome', 'astra', 'generatepress',
        'oceanwp', 'hello', 'twentytwentyfour', 'twentytwentythree',
        'twentytwentytwo', 'twentytwentyone', 'twentytwenty',
        'widget', 'module', 'block', 'section', 'container', 'wrapper',
        'inner', 'outer', 'holder',
    ];

    private static function clean( string $s ): string {
        if ( ! $s ) return $s;
        // Strip leading framework prefix (first match only)
        foreach ( self::$strip_prefixes as $prefix ) {
            if ( str_starts_with( $s, $prefix ) ) {
                $s = substr( $s, strlen( $prefix ) );
                break;
            }
        }
        // Strip standalone segment tokens
        $segments_re = '/(?:^|-)(' . implode( '|', self::$strip_segments ) . ')(?=-|$)/';
        $s = preg_replace( $segments_re, '', $s );
        // Collapse hyphens and trim
        $s = preg_replace( '/-{2,}/', '-', $s );
        return trim( $s, '-' );
    }
}
