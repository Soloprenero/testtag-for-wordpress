/**
 * Copyright (c) 2026 Gary Young III (https://garyyoungiii.com)
 * Soloprenero — https://soloprenero.com
 *
 * Test ID Auto Injector — Block Editor Panel Source
 * Requires @wordpress/scripts to compile.
 * Run `npm run build` to output to block-editor/build/index.js
 */

const { addFilter } = wp.hooks;
const { registerPlugin } = wp.plugins;
const { PluginDocumentSettingPanel } = wp.editPost;
const { TextControl, Notice } = wp.components;
const { useSelect, useDispatch } = wp.data;

const attrKey = window.TESTTAG_EDITOR?.attributeKey || 'data-testid';

function slug(str) {
    return (str || '').toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').substring(0, 50);
}

function getAutoPreview({ name, attributes: attr }) {
    const base = name.replace('core/', '').replace('/', '-');
    if (name === 'core/heading')    return `h${attr.level || 2}-${slug(attr.content || '')}`;
    if (name === 'core/paragraph')  { const t = slug(attr.content || ''); return t ? `p-${t}` : 'paragraph'; }
    if (name === 'core/button')     return `button-${slug(attr.text || '')}`;
    if (name === 'core/image')      return (attr.alt || attr.caption) ? `img-${slug(attr.alt || attr.caption)}` : 'img';
    if (name === 'core/group' || name === 'core/cover') return `section-${slug(attr.anchor || base)}`;
    if (name === 'core/navigation') return 'nav';
    if (name === 'core/search')     return 'search-form';
    if (name === 'core/list')       return 'list';
    if (name === 'core/quote')      return `blockquote-${slug(attr.value || '')}`;
    if (attr.anchor)               return `${base}-${slug(attr.anchor)}`;
    return base;
}

addFilter('blocks.registerBlockType', 'testtag/add-attribute', (settings) => ({
    ...settings,
    attributes: {
        ...settings.attributes,
        testtagValue: { type: 'string', default: '' },
    },
}));

function TestTagDocumentPanel() {
    const selectedBlock = useSelect(
        (select) => select('core/block-editor').getSelectedBlock(),
        []
    );
    const { updateBlockAttributes } = useDispatch('core/block-editor');

    if (!selectedBlock) {
        return (
            <PluginDocumentSettingPanel
                name="testtag-document-panel"
                title="Test ID Auto Injector"                initialOpen={true}
            >
                <Notice status="info" isDismissible={false}>
                    Select a block to set a manual Test ID Auto Injector override.
                </Notice>
            </PluginDocumentSettingPanel>
        );
    }

    const { clientId, name, attributes } = selectedBlock;
    const testtagValue = attributes?.testtagValue || '';
    const preview = getAutoPreview({ name, attributes: attributes || {} });

    return (
        <PluginDocumentSettingPanel
            name="testtag-document-panel"
            title="Test ID Auto Injector"
            initialOpen={true}
        >
            <Notice status="info" isDismissible={false}>
                {`Selected block: ${name}`}
            </Notice>
            <TextControl
                label={attrKey}
                value={testtagValue}
                placeholder={preview}
                onChange={(value) => updateBlockAttributes(clientId, { testtagValue: value })}
                help={testtagValue
                    ? `${attrKey}="${testtagValue}" (manual override — rendered server-side)`
                    : `Auto-generated: "${preview}". Type to override.`}
            />
            {testtagValue && (
                <Notice status="success" isDismissible={false}>
                    Manual override is active for the selected block.
                </Notice>
            )}
        </PluginDocumentSettingPanel>
    );
}

registerPlugin('testtag-document-panel', {
    render: TestTagDocumentPanel,
});

addFilter('blocks.getSaveContent.extraProps', 'testtag/save-props', (extraProps, blockType, { testtagValue }) => {
    if (testtagValue) return { ...extraProps, [attrKey]: testtagValue };
    return extraProps;
});
