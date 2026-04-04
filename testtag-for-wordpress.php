<?php
/**
 * Plugin Name:  TestTag for WordPress
 * Plugin URI:   https://github.com/garyyoungiii/testtag-for-wordpress
 * Description:  Automatically tag any element on your WordPress site with test
 *               attributes for Playwright, Cypress, Selenium, or any automation
 *               framework. Three layers: auto-generation from element semantics,
 *               CSS selector map for explicit overrides, and a block editor sidebar
 *               field for per-block manual overrides. Works on any WordPress site —
 *               Elementor, Gutenberg, or classic themes.
 * Version:      1.4.1-beta
 * Author:       Gary Young III
 * Author URI:   https://garyyoungiii.com
 * Requires at least: 6.0
 * Requires PHP: 8.0
 * License:      GPL-2.0-or-later
 * License URI:  https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:  testtag
 */

defined( 'ABSPATH' ) || exit;

define( 'TESTTAG_VERSION',    '1.4.1-beta' );
define( 'TESTTAG_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'TESTTAG_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-presets.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-settings.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-html-processor.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-layer-marker.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-block-editor.php';
require_once TESTTAG_PLUGIN_DIR . 'includes/class-testtag-audit.php';

TestTag_Settings::init();
TestTag_HTML_Processor::init();
TestTag_Layer_Marker::init();
TestTag_Block_Editor::init();
TestTag_Audit::init();
