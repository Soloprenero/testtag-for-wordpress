<?php
/**
 * Plugin Name:  TestTag for WordPress
 * Plugin URI:   https://github.com/garyyoungiii/testtag-for-wordpress
 * Description:  Automatically tag any element on your WordPress site with test
 *               attributes for Playwright, Cypress, Selenium, or any automation
 *               framework. Two layers: auto-generation from element semantics
 *               and a CSS selector map for explicit overrides. Works on any WordPress site —
 *               Elementor, Gutenberg, or classic themes.
 * Version:      1.6.0-beta
 * Author:       Gary Young III
 * Author URI:   https://garyyoungiii.com
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * License:      GPL-2.0-or-later
 * License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 * Copyright:    (c) 2026 Gary Young III (https://garyyoungiii.com) / Soloprenero (https://soloprenero.com)
 * Text Domain:  testtag
 */

defined( 'ABSPATH' ) || exit;

define( 'TESTTAG_VERSION',    '1.6.0-beta' );
define( 'TESTTAG_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TESTTAG_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-presets.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-settings.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-html-processor.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-layer-marker.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-audit.php';

TestTag_Settings::init();
TestTag_HTML_Processor::init();
TestTag_Layer_Marker::init();
TestTag_Audit::init();
