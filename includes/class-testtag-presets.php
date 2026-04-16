<?php
defined( 'ABSPATH' ) || exit;

/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 *
 * TestTag_Presets
 *
 * Selector map presets for common WordPress plugins.
 * Each preset is only surfaced in the admin UI when that plugin is active.
 *
 * Covered plugins:
 *   - WooCommerce
 *   - Contact Form 7
 *   - Gravity Forms
 *
 * Yoast SEO is intentionally omitted — its output is <head> metadata,
 * not testable frontend DOM elements.
 */
class TestTag_Presets {

    // ─────────────────────────────────────────────────────────────
    // Registry
    // ─────────────────────────────────────────────────────────────

    private static function registry(): array {
        return [
            'woocommerce' => [
                'label'  => 'WooCommerce',
                'active' => fn() => class_exists( 'WooCommerce' ),
            ],
            'cf7' => [
                'label'  => 'Contact Form 7',
                'active' => fn() => class_exists( 'WPCF7' ),
            ],
            'gravityforms' => [
                'label'  => 'Gravity Forms',
                'active' => fn() => class_exists( 'GFForms' ),
            ],
        ];
    }

    /**
     * Returns all presets keyed by slug:
     *   label   string  Human-readable plugin name
     *   active  bool    Whether the plugin is currently installed & active
     *   entries array   Selector map rows [ ['selector'=>…, 'testid'=>…], … ]
     */
    public static function get_all(): array {
        $out = [];
        foreach ( self::registry() as $key => $meta ) {
            $out[ $key ] = [
                'label'   => $meta['label'],
                'active'  => (bool) ( $meta['active'] )(),
                'entries' => self::entries( $key ),
            ];
        }
        return $out;
    }

    private static function entries( string $key ): array {
        return match ( $key ) {
            'woocommerce'  => self::woocommerce(),
            'cf7'          => self::cf7(),
            'gravityforms' => self::gravityforms(),
            default        => [],
        };
    }

    // ─────────────────────────────────────────────────────────────
    // WooCommerce
    // ─────────────────────────────────────────────────────────────
    private static function woocommerce(): array {
        return [
            // Shop / archive
            [ 'selector' => '.woocommerce-products-header__title',                   'testid' => 'woo-shop-title' ],
            [ 'selector' => 'ul.products',                                            'testid' => 'woo-product-list' ],
            [ 'selector' => 'ul.products li.product',                                 'testid' => 'woo-product-card' ],
            [ 'selector' => 'ul.products li.product a.woocommerce-loop-product__link','testid' => 'woo-product-link' ],
            [ 'selector' => 'ul.products li.product .price',                          'testid' => 'woo-product-price' ],
            [ 'selector' => 'ul.products li.product .button',                         'testid' => 'woo-add-to-cart-loop' ],

            // Single product
            [ 'selector' => '.product .product_title',                                'testid' => 'woo-product-title' ],
            [ 'selector' => '.product .woocommerce-product-gallery',                  'testid' => 'woo-product-gallery' ],
            [ 'selector' => '.product .woocommerce-product-gallery__image',           'testid' => 'woo-product-image' ],
            [ 'selector' => '.product p.price, .product span.price',                  'testid' => 'woo-price' ],
            [ 'selector' => '.product .woocommerce-product-details__short-description','testid' => 'woo-short-description' ],
            [ 'selector' => '.product .cart',                                          'testid' => 'woo-add-to-cart-form' ],
            [ 'selector' => '.product .quantity input[type="number"]',                 'testid' => 'woo-quantity-input' ],
            [ 'selector' => '.product .single_add_to_cart_button',                    'testid' => 'woo-add-to-cart-btn' ],
            [ 'selector' => '.product .woocommerce-tabs',                              'testid' => 'woo-product-tabs' ],
            [ 'selector' => '.product .woocommerce-tabs .tabs',                        'testid' => 'woo-tabs-nav' ],
            [ 'selector' => '.product .woocommerce-Tabs-panel--description',           'testid' => 'woo-tab-description' ],
            [ 'selector' => '.product .woocommerce-Tabs-panel--reviews',               'testid' => 'woo-tab-reviews' ],
            [ 'selector' => '.related.products',                                       'testid' => 'woo-related-products' ],

            // Cart
            [ 'selector' => 'form.woocommerce-cart-form',                             'testid' => 'woo-cart-form' ],
            [ 'selector' => '.woocommerce-cart-form__contents',                        'testid' => 'woo-cart-table' ],
            [ 'selector' => '.woocommerce-cart-form__cart-item',                       'testid' => 'woo-cart-item' ],
            [ 'selector' => '.woocommerce-cart-form__cart-item .product-name a',       'testid' => 'woo-cart-item-name' ],
            [ 'selector' => '.woocommerce-cart-form__cart-item .product-quantity input','testid' => 'woo-cart-item-qty' ],
            [ 'selector' => '.woocommerce-cart-form__cart-item .product-price',        'testid' => 'woo-cart-item-price' ],
            [ 'selector' => 'button[name="update_cart"]',                              'testid' => 'woo-update-cart-btn' ],
            [ 'selector' => '.cart-collaterals .cart_totals',                          'testid' => 'woo-cart-totals' ],
            [ 'selector' => '.cart_totals .order-total',                               'testid' => 'woo-cart-order-total' ],
            [ 'selector' => '.wc-proceed-to-checkout .checkout-button',                'testid' => 'woo-checkout-btn' ],
            [ 'selector' => '#coupon_code',                                            'testid' => 'woo-coupon-input' ],
            [ 'selector' => 'button[name="apply_coupon"]',                             'testid' => 'woo-apply-coupon-btn' ],

            // Checkout
            [ 'selector' => 'form.woocommerce-checkout',                              'testid' => 'woo-checkout-form' ],
            [ 'selector' => '#billing_first_name',                                    'testid' => 'woo-billing-first-name' ],
            [ 'selector' => '#billing_last_name',                                     'testid' => 'woo-billing-last-name' ],
            [ 'selector' => '#billing_email',                                         'testid' => 'woo-billing-email' ],
            [ 'selector' => '#billing_phone',                                         'testid' => 'woo-billing-phone' ],
            [ 'selector' => '#billing_address_1',                                     'testid' => 'woo-billing-address' ],
            [ 'selector' => '#billing_city',                                          'testid' => 'woo-billing-city' ],
            [ 'selector' => '#billing_postcode',                                      'testid' => 'woo-billing-postcode' ],
            [ 'selector' => '#billing_country',                                       'testid' => 'woo-billing-country' ],
            [ 'selector' => '#billing_state',                                         'testid' => 'woo-billing-state' ],
            [ 'selector' => '#ship-to-different-address-checkbox',                    'testid' => 'woo-ship-different-checkbox' ],
            [ 'selector' => '#order_comments',                                        'testid' => 'woo-order-notes' ],
            [ 'selector' => '#payment',                                               'testid' => 'woo-payment-section' ],
            [ 'selector' => '#payment ul.payment_methods',                            'testid' => 'woo-payment-methods' ],
            [ 'selector' => '#place_order',                                           'testid' => 'woo-place-order-btn' ],

            // Order confirmation
            [ 'selector' => '.woocommerce-order-received .woocommerce-order',         'testid' => 'woo-order-confirmation' ],
            [ 'selector' => '.woocommerce-order-overview',                            'testid' => 'woo-order-overview' ],
            [ 'selector' => '.woocommerce-order-overview__order',                     'testid' => 'woo-order-number' ],
            [ 'selector' => '.woocommerce-order-overview__total',                     'testid' => 'woo-order-total' ],

            // My Account
            [ 'selector' => '.woocommerce-MyAccount-navigation',                      'testid' => 'woo-account-nav' ],
            [ 'selector' => '.woocommerce-MyAccount-content',                         'testid' => 'woo-account-content' ],
            [ 'selector' => 'form.woocommerce-form-login',                            'testid' => 'woo-login-form' ],
            [ 'selector' => '#username',                                              'testid' => 'woo-login-username' ],
            [ 'selector' => 'form.woocommerce-form-login #password',                  'testid' => 'woo-login-password' ],
            [ 'selector' => 'form.woocommerce-form-login button[type="submit"]',       'testid' => 'woo-login-btn' ],
            [ 'selector' => 'form.woocommerce-form-register',                         'testid' => 'woo-register-form' ],
            [ 'selector' => 'form.woocommerce-form-register button[type="submit"]',   'testid' => 'woo-register-btn' ],

            // Notices
            [ 'selector' => '.woocommerce-message',                                   'testid' => 'woo-notice-success' ],
            [ 'selector' => '.woocommerce-error',                                     'testid' => 'woo-notice-error' ],
            [ 'selector' => '.woocommerce-info',                                      'testid' => 'woo-notice-info' ],

            // Mini-cart (header widget)
            [ 'selector' => '.widget_mini_cart, .woocommerce-mini-cart',              'testid' => 'woo-mini-cart' ],
            [ 'selector' => 'a.cart-contents, a.woocommerce-cart-link',               'testid' => 'woo-cart-icon' ],
        ];
    }

    // ─────────────────────────────────────────────────────────────
    // Contact Form 7
    // ─────────────────────────────────────────────────────────────
    private static function cf7(): array {
        return [
            // Form wrapper
            [ 'selector' => '.wpcf7',                                                 'testid' => 'cf7-form-wrapper' ],
            [ 'selector' => '.wpcf7 form.wpcf7-form',                                 'testid' => 'cf7-form' ],

            // Common field types (CF7 uses plain HTML inputs inside shortcode output)
            [ 'selector' => '.wpcf7 input[name="your-name"]',                         'testid' => 'cf7-name' ],
            [ 'selector' => '.wpcf7 input[name="your-email"]',                        'testid' => 'cf7-email' ],
            [ 'selector' => '.wpcf7 input[name="your-subject"]',                      'testid' => 'cf7-subject' ],
            [ 'selector' => '.wpcf7 textarea[name="your-message"]',                   'testid' => 'cf7-message' ],
            [ 'selector' => '.wpcf7 input[type="tel"]',                               'testid' => 'cf7-phone' ],
            [ 'selector' => '.wpcf7 input[type="url"]',                               'testid' => 'cf7-url' ],
            [ 'selector' => '.wpcf7 input[type="file"]',                              'testid' => 'cf7-file-upload' ],

            // Submit
            [ 'selector' => '.wpcf7 input[type="submit"], .wpcf7 button[type="submit"]', 'testid' => 'cf7-submit-btn' ],

            // Response messages
            [ 'selector' => '.wpcf7 .wpcf7-response-output',                          'testid' => 'cf7-response' ],
            [ 'selector' => '.wpcf7 .wpcf7-mail-sent-ok',                             'testid' => 'cf7-success-msg' ],
            [ 'selector' => '.wpcf7 .wpcf7-validation-errors',                        'testid' => 'cf7-error-msg' ],
            [ 'selector' => '.wpcf7 .wpcf7-spam-blocked',                             'testid' => 'cf7-spam-msg' ],

            // Field-level validation
            [ 'selector' => '.wpcf7 .wpcf7-not-valid-tip',                            'testid' => 'cf7-field-error' ],
        ];
    }

    // ─────────────────────────────────────────────────────────────
    // Gravity Forms
    // ─────────────────────────────────────────────────────────────
    private static function gravityforms(): array {
        return [
            // Form wrapper — GF uses gform_wrapper + gform_body pattern
            [ 'selector' => '.gform_wrapper',                                          'testid' => 'gf-form-wrapper' ],
            [ 'selector' => '.gform_wrapper form',                                     'testid' => 'gf-form' ],
            [ 'selector' => '.gform_body',                                             'testid' => 'gf-form-body' ],
            [ 'selector' => '.gform_page',                                             'testid' => 'gf-form-page' ],

            // Common field containers
            [ 'selector' => '.gform_wrapper .gfield',                                  'testid' => 'gf-field' ],
            [ 'selector' => '.gform_wrapper .gfield_label',                            'testid' => 'gf-field-label' ],
            [ 'selector' => '.gform_wrapper input[type="text"]',                       'testid' => 'gf-input-text' ],
            [ 'selector' => '.gform_wrapper input[type="email"]',                      'testid' => 'gf-input-email' ],
            [ 'selector' => '.gform_wrapper input[type="tel"]',                        'testid' => 'gf-input-phone' ],
            [ 'selector' => '.gform_wrapper input[type="number"]',                     'testid' => 'gf-input-number' ],
            [ 'selector' => '.gform_wrapper input[type="url"]',                        'testid' => 'gf-input-url' ],
            [ 'selector' => '.gform_wrapper input[type="file"]',                       'testid' => 'gf-input-file' ],
            [ 'selector' => '.gform_wrapper textarea',                                  'testid' => 'gf-input-textarea' ],
            [ 'selector' => '.gform_wrapper select',                                   'testid' => 'gf-input-select' ],
            [ 'selector' => '.gform_wrapper input[type="checkbox"]',                   'testid' => 'gf-input-checkbox' ],
            [ 'selector' => '.gform_wrapper input[type="radio"]',                      'testid' => 'gf-input-radio' ],

            // Name field (compound)
            [ 'selector' => '.gform_wrapper .name_first input',                        'testid' => 'gf-name-first' ],
            [ 'selector' => '.gform_wrapper .name_last input',                         'testid' => 'gf-name-last' ],

            // Address field (compound)
            [ 'selector' => '.gform_wrapper .ginput_complex.ginput_container_address', 'testid' => 'gf-address-field' ],

            // Date / time
            [ 'selector' => '.gform_wrapper .ginput_container_date input',             'testid' => 'gf-input-date' ],
            [ 'selector' => '.gform_wrapper .ginput_container_time input',             'testid' => 'gf-input-time' ],

            // Consent / signature
            [ 'selector' => '.gform_wrapper .ginput_container_consent input',          'testid' => 'gf-consent-checkbox' ],

            // Navigation & submit
            [ 'selector' => '.gform_wrapper .gform_next_button',                       'testid' => 'gf-next-btn' ],
            [ 'selector' => '.gform_wrapper .gform_previous_button',                   'testid' => 'gf-prev-btn' ],
            [ 'selector' => '.gform_wrapper .gform_button[type="submit"]',             'testid' => 'gf-submit-btn' ],
            [ 'selector' => '.gform_wrapper .gform_page_footer .gform_button',        'testid' => 'gf-page-submit-btn' ],

            // Progress bar (multi-step)
            [ 'selector' => '.gform_wrapper .gf_progressbar_wrapper',                  'testid' => 'gf-progress-bar' ],
            [ 'selector' => '.gform_wrapper .gf_progressbar',                          'testid' => 'gf-progress-fill' ],
            [ 'selector' => '.gform_wrapper .gf_step',                                 'testid' => 'gf-step-indicator' ],

            // Confirmation & validation
            [ 'selector' => '.gform_confirmation_wrapper',                             'testid' => 'gf-confirmation' ],
            [ 'selector' => '.gform_wrapper .gfield_error',                            'testid' => 'gf-field-error' ],
            [ 'selector' => '.gform_wrapper .validation_error',                        'testid' => 'gf-validation-error' ],
            [ 'selector' => '.gform_wrapper .gfield_description',                      'testid' => 'gf-field-description' ],
        ];
    }
}
