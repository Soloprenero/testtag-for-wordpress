/**
 * TestTag for WordPress — Block Editor Panel Source
 * Requires @wordpress/scripts to compile.
 * Run `npm run build` to output to block-editor/build/index.js
 */

const { addFilter }                  = wp.hooks;
const { createHigherOrderComponent } = wp.compose;
const { InspectorAdvancedControls }  = wp.blockEditor;
const { PanelBody, TextControl, Notice } = wp.components;
const { Fragment }                   = wp.element;

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

addFilter('editor.BlockEdit', 'testtag/inspector-panel',
    createHigherOrderComponent((BlockEdit) => (props) => {
        if (!props.isSelected) return <BlockEdit {...props} />;

        const { testtagValue } = props.attributes;
        const preview = getAutoPreview(props);

        return (
            <Fragment>
                <BlockEdit {...props} />
                <InspectorAdvancedControls>
                    <PanelBody title="🏷️ TestTag" initialOpen={false}>
                        <TextControl
                            label={attrKey}
                            value={testtagValue}
                            placeholder={preview}
                            onChange={(v) => props.setAttributes({ testtagValue: v })}
                            help={testtagValue
                                ? `${attrKey}="${testtagValue}" (manual override — rendered server-side)`
                                : `Auto-generated: "${preview}". Type to override.`}
                        />
                        {testtagValue && (
                            <Notice status="info" isDismissible={false}>
                                Manual override set. Rendered server-side and takes priority over auto-generation.
                            </Notice>
                        )}
                    </PanelBody>
                </InspectorAdvancedControls>
            </Fragment>
        );
    }, 'testtagInspectorPanel')
);

addFilter('blocks.getSaveContent.extraProps', 'testtag/save-props', (extraProps, blockType, { testtagValue }) => {
    if (testtagValue) return { ...extraProps, [attrKey]: testtagValue };
    return extraProps;
});
