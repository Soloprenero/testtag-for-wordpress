<?php
/**
 * Standalone benchmark for TestTag_HTML_Processor::process_html().
 *
 * Measures HTML processing time on a large synthetic page that mirrors
 * a typical WordPress frontend (blog listing, contact form, product grid,
 * Elementor widgets, navigation menus).
 *
 * Runs entirely without WordPress by supplying minimal stubs for the
 * WordPress functions referenced by TestTag_Settings and
 * TestTag_HTML_Processor.
 *
 * Usage:
 *   php benchmarks/benchmark-html-processor.php
 *
 * Output:
 *   avg=<ms>  min=<ms>  max=<ms>  tags=<count>  html_len=<bytes>
 */

// ─── Minimal WordPress stubs ─────────────────────────────────────────────────
define( 'ABSPATH', __DIR__ . '/../' );

if ( ! function_exists( 'get_option' ) ) {
    function get_option( string $key, $default = false ) {
        static $options = [
            'testtag_attribute_key'  => 'data-testid',
            'testtag_separator'      => '-',
            'testtag_text_fallback'  => '1',
            'testtag_token_order'    => 'type,identifier',
            'testtag_format_seps'    => '-',
            'testtag_selector_map'   => false,
            'testtag_force_enable'   => '0',
        ];
        $v = $options[ $key ] ?? $default;
        return $v === false ? $default : $v;
    }
}

foreach ( [
    'wp_doing_ajax'          => fn() => false,
    'wp_doing_cron'          => fn() => false,
    'wp_is_json_request'     => fn() => false,
    'is_user_logged_in'      => fn() => true,
    'wp_get_environment_type' => fn() => 'development',
    'current_user_can'       => fn( $c ) => true,
    'sanitize_text_field'    => fn( $s ) => trim( $s ),
    'esc_url'                => fn( $u ) => $u,
    'admin_url'              => fn( $p ) => 'http://localhost/wp-admin/' . $p,
    'add_action'             => fn() => null,
    'add_filter'             => fn() => null,
    'add_management_page'    => fn() => null,
    'register_setting'       => fn() => null,
] as $fn => $cb ) {
    if ( ! function_exists( $fn ) ) {
        // PHP 8 — create_function replaced by anonymous function assignment
        // We use a wrapper to register named stubs.
    }
}

// Use direct function declarations for compatibility:
if ( ! function_exists( 'wp_doing_ajax' ) )          { function wp_doing_ajax():bool{ return false; } }
if ( ! function_exists( 'wp_doing_cron' ) )          { function wp_doing_cron():bool{ return false; } }
if ( ! function_exists( 'wp_is_json_request' ) )     { function wp_is_json_request():bool{ return false; } }
if ( ! function_exists( 'is_user_logged_in' ) )      { function is_user_logged_in():bool{ return true; } }
if ( ! function_exists( 'wp_get_environment_type' ) ) { function wp_get_environment_type():string{ return 'development'; } }
if ( ! function_exists( 'current_user_can' ) )       { function current_user_can(string $c):bool{ return true; } }
if ( ! function_exists( 'sanitize_text_field' ) )    { function sanitize_text_field(string $s):string{ return trim($s); } }
if ( ! function_exists( 'esc_url' ) )                { function esc_url(string $u):string{ return $u; } }
if ( ! function_exists( 'admin_url' ) )              { function admin_url(string $p):string{ return 'http://localhost/wp-admin/'.$p; } }
if ( ! function_exists( 'add_action' ) )             { function add_action():void{} }
if ( ! function_exists( 'add_filter' ) )             { function add_filter():void{} }
if ( ! function_exists( 'add_management_page' ) )    { function add_management_page():void{} }
if ( ! function_exists( 'register_setting' ) )       { function register_setting():void{} }

// ─── Load plugin classes ──────────────────────────────────────────────────────
require_once __DIR__ . '/../includes/class-testtag-settings.php';
require_once __DIR__ . '/../includes/class-testtag-html-processor.php';

// ─── HTML page generator ──────────────────────────────────────────────────────

/**
 * Generates a large synthetic HTML page that exercises all auto-tag paths:
 * blog posts, form controls with labels, product cards, Elementor widgets,
 * Gutenberg blocks, and navigation menus.
 */
function generate_large_html(): string {
    $html  = '<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Benchmark Page</title></head><body>';

    // ── Site header + primary nav ──────────────────────────────────────────
    $html .= '<header class="site-header"><nav class="main-navigation">';
    foreach ( [ 'Home', 'About', 'Services', 'Portfolio', 'Blog', 'Contact' ] as $item ) {
        $html .= '<a href="/' . strtolower( $item ) . '">' . $item . '</a>';
    }
    $html .= '</nav></header>';

    $html .= '<main id="primary">';

    // ── Blog post listing (30 posts) ───────────────────────────────────────
    for ( $p = 1; $p <= 30; $p++ ) {
        $html .= '<article class="post-' . $p . ' wp-block-post">';
        $html .= '<h2 class="wp-block-post-title entry-title">'
               . '<a href="/post-' . $p . '">Post Title Number ' . $p . '</a>'
               . '</h2>';
        $html .= '<div class="wp-block-post-excerpt entry-summary">'
               . '<p>This is the excerpt for post ' . $p . '. It contains repeating patterns.</p>'
               . '</div>';
        $html .= '<div class="wp-block-post-content entry-content">'
               . '<p>Main content paragraph for post ' . $p . '.</p>'
               . '<img src="/image-' . $p . '.jpg" alt="Featured image for post ' . $p . '">'
               . '<a href="/post-' . $p . '" class="read-more">Read More</a>'
               . '</div>';
        $html .= '</article>';
    }

    // ── Contact form with labelled controls ────────────────────────────────
    $html .= '<section aria-label="Contact Us"><h2>Contact Us</h2>';
    $html .= '<form id="contact-form" aria-label="Contact form">';
    foreach ( [
        [ 'text',  'first-name',  'First Name',    'Enter first name' ],
        [ 'text',  'last-name',   'Last Name',     'Enter last name' ],
        [ 'email', 'email',       'Email Address', 'Enter email' ],
        [ 'tel',   'phone',       'Phone Number',  'Enter phone' ],
        [ 'text',  'subject',     'Subject',       'Enter subject' ],
        [ 'text',  'company',     'Company',       'Enter company' ],
        [ 'url',   'website',     'Website',       'Enter website URL' ],
    ] as [ $type, $name, $label, $ph ] ) {
        $id   = 'field-' . $name;
        $html .= '<div class="form-field">'
               . '<label for="' . $id . '">' . $label . '</label>'
               . '<input type="' . $type . '" id="' . $id . '" name="' . $name . '" placeholder="' . $ph . '">'
               . '</div>';
    }
    $html .= '<div class="form-field">'
           . '<label for="field-message">Message</label>'
           . '<textarea name="message" id="field-message" placeholder="Your message"></textarea>'
           . '</div>';
    $html .= '<button type="submit" id="submit-contact">Send Message</button>';
    $html .= '</form></section>';

    // ── WooCommerce-style product grid (20 products) ───────────────────────
    $html .= '<section aria-label="Products"><h2>Our Products</h2>';
    $html .= '<div class="woocommerce">';
    for ( $i = 1; $i <= 20; $i++ ) {
        $html .= '<div class="product wc-block-product">'
               . '<a href="/product-' . $i . '">'
               . '<img src="/product-' . $i . '.jpg" alt="Product ' . $i . '">'
               . '<h3>Product Name ' . $i . '</h3>'
               . '</a>'
               . '<span class="price">$' . ( $i * 10 ) . '.00</span>'
               . '<button class="add-to-cart" data-product-id="' . $i . '" '
               . 'aria-label="Add Product ' . $i . ' to cart">Add to Cart</button>'
               . '</div>';
    }
    $html .= '</div></section>';

    // ── Elementor section / widget ─────────────────────────────────────────
    $html .= '<div data-element_type="section" class="elementor-section">'
           . '<div data-element_type="container" class="elementor-container">'
           . '<div data-widget_type="heading.default" class="elementor-widget"><h2>Elementor Heading</h2></div>'
           . '<div data-widget_type="text-editor.default" class="elementor-widget"><p>Elementor text content.</p></div>'
           . '<div data-widget_type="image.default" class="elementor-widget">'
           . '<img src="/hero.jpg" alt="Hero banner"></div>'
           . '</div></div>';

    // ── Secondary navigation with category links ───────────────────────────
    $html .= '<nav aria-label="Category Navigation">';
    foreach ( [ 'Technology', 'Business', 'Health', 'Travel', 'Food', 'Lifestyle', 'Finance', 'Education', 'Sports', 'Entertainment' ] as $cat ) {
        $slug  = strtolower( str_replace( ' ', '-', $cat ) );
        $html .= '<a href="/category/' . $slug . '">' . $cat . '</a>';
    }
    $html .= '</nav>';

    $html .= '</main>';
    $html .= '<footer class="site-footer"><p>Footer content</p>'
           . '<nav aria-label="Footer Navigation">';
    foreach ( [ 'Privacy Policy', 'Terms of Service', 'Cookie Policy' ] as $link ) {
        $slug  = strtolower( str_replace( ' ', '-', $link ) );
        $html .= '<a href="/' . $slug . '">' . $link . '</a>';
    }
    $html .= '</nav></footer>';
    $html .= '</body></html>';
    return $html;
}

// ─── Benchmark runner ─────────────────────────────────────────────────────────
$html       = generate_large_html();
$iterations = 10;

// Warm-up run (primes opcode cache and DOM internals).
TestTag_HTML_Processor::process_html( $html );

$times = [];
for ( $i = 0; $i < $iterations; $i++ ) {
    $t0      = microtime( true );
    $out     = TestTag_HTML_Processor::process_html( $html );
    $times[] = ( microtime( true ) - $t0 ) * 1000;
}

$avg = array_sum( $times ) / count( $times );
$min = min( $times );
$max = max( $times );

$tagged_count = substr_count( $out, 'data-testid=' );

printf(
    "avg=%.2fms  min=%.2fms  max=%.2fms  tags=%d  html_len=%d  php=%s\n",
    $avg, $min, $max, $tagged_count, strlen( $html ), PHP_VERSION
);
