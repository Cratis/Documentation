// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Expand manifest-based variant macros in authored site MDX at render time.
// Product pages use the same expansion during sync; neither path edits its source.
import path from 'node:path';
import { visit } from 'unist-util-visit';
import { expandVariantTabs, ensureTabsImport } from './sync-content.mjs';
import { loadVariantDocsConfig } from './variant-docs-config.mjs';

const STARLIGHT_IMPORT = /import\s+\{([^}]+)\}\s+from\s+['"]@astrojs\/starlight\/components['"];?/g;
const ATTRIBUTES = new Set(['snippet', 'syncKey', 'variants']);

function macroSource(node, file) {
    if (node.children.length) {
        throw new Error(`[variant-tabs] ${node.name} in ${file} must be self-closing`);
    }
    const attributes = [];
    for (const attr of node.attributes) {
        if (attr.type !== 'mdxJsxAttribute' || !ATTRIBUTES.has(attr.name) || typeof attr.value !== 'string') {
            throw new Error(`[variant-tabs] ${node.name} in ${file} accepts only literal snippet, syncKey and variants attributes`);
        }
        attributes.push(`${attr.name}=${JSON.stringify(attr.value)}`);
    }
    return `<${node.name} ${attributes.join(' ')} />`;
}

/** Astro remark plugin; options.axes/source roots can be supplied by isolated tests. */
export function remarkVariantTabs(options = {}) {
    const parse = this.parse.bind(this); // Use Astro's configured MDX parser, not a second syntax implementation.
    const axesPromise = options.axes ? Promise.resolve(options.axes) : loadVariantDocsConfig().then(config => config.axes);

    return async (tree, file) => {
        const candidates = [];
        const rawHtml = [];
        visit(tree, (node, index, parent) => {
            if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name && parent && index !== undefined) {
                candidates.push({ node, index, parent });
            } else if (node.type === 'html') {
                rawHtml.push(node.value);
            }
        });
        if (!candidates.length && !rawHtml.length) return;

        const axes = await axesPromise;
        const byMacro = new Map();
        for (const axis of axes) {
            if (byMacro.has(axis.macro)) {
                throw new Error(`[variant-tabs] Ambiguous macro ${axis.macro}: multiple manifest axes use this name`);
            }
            byMacro.set(axis.macro, axis);
        }
        const macros = candidates.filter(({ node }) => byMacro.has(node.name));
        const srcPath = String(file.path ?? '(unknown MDX source)');
        if (path.extname(srcPath).toLowerCase() !== '.mdx') {
            // Plain Markdown parses a JSX-looking tag as raw HTML, not mdxJsx.
            // Reject it before Astro renders an unknown element (and before the
            // Markdown mirror copies the unexpanded macro).
            const rawMacro = rawHtml.some(value => [...byMacro.keys()].some(macro =>
                new RegExp(`<${macro}(?=[\\s/>])`).test(value)));
            if (macros.length || rawMacro) {
                throw new Error(`[variant-tabs] Variant macros require an .mdx page: ${srcPath}`);
            }
            return;
        }
        if (!macros.length) return;

        // Prepare every replacement before touching the tree. A missing/invalid
        // snippet fails the build, rather than leaving a half-expanded page.
        const replacements = [];
        for (const { node, index, parent } of macros) {
            if (node.type !== 'mdxJsxFlowElement' || parent.type !== 'root') {
                throw new Error(`[variant-tabs] ${node.name} in ${srcPath} must be a top-level block on its own line`);
            }
            const axis = byMacro.get(node.name);
            const { body } = await expandVariantTabs(macroSource(node, srcPath), {
                srcPath,
                product: { key: axis.productKey },
                variantAxes: [axis],
                reposRoot: options.reposRoot,
                docRepoRoot: options.docRepoRoot,
            });
            const nodes = parse(body).children.filter(child => child.type !== 'mdxjsEsm');
            // The fragment parser starts at line 1, not at this macro's line in the
            // page. Do not attach those incorrect source locations to generated nodes.
            const clearPositions = node => {
                delete node.position;
                for (const child of node.children ?? []) clearPositions(child);
            };
            nodes.forEach(clearPositions);
            replacements.push({ index, parent, nodes });
        }
        for (const { index, parent, nodes } of replacements.reverse()) {
            parent.children.splice(index, 1, ...nodes);
        }

        const imports = tree.children.filter(node => node.type === 'mdxjsEsm');
        const starlightImports = imports.flatMap(node =>
            [...node.value.matchAll(STARLIGHT_IMPORT)].map(match => ({ node, match })));
        if (starlightImports.length) {
            // MDX keeps blank-line-separated imports in distinct nodes. Check
            // bindings across all of them, then update only the first node.
            const bound = new Set(starlightImports.flatMap(({ match }) => match[1].split(',')
                .map(specifier => specifier.trim().split(/\s+as\s+/).at(-1))));
            const missing = ['Tabs', 'TabItem'].filter(name => !bound.has(name));
            if (missing.length) {
                const { node, match } = starlightImports[0];
                const names = match[1].split(',').map(name => name.trim()).filter(Boolean);
                const source = node.value.replace(match[0],
                    `import { ${[...names, ...missing].join(', ')} } from '@astrojs/starlight/components';`);
                const updated = parse(source).children.find(child => child.type === 'mdxjsEsm');
                delete updated.position;
                tree.children.splice(tree.children.indexOf(node), 1, updated);
            }
        } else {
            const imported = parse(ensureTabsImport('')).children[0];
            delete imported.position;
            tree.children.unshift(imported);
        }
    };
}
