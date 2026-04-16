/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 */
const defaultConfig = require('@wordpress/scripts/config/webpack.config');
const path = require('path');

module.exports = {
    ...defaultConfig,
    entry: {
        index: path.resolve(__dirname, 'block-editor/src/index.js'),
    },
    output: {
        path:     path.resolve(__dirname, 'block-editor/build'),
        filename: '[name].js',
    },
};
