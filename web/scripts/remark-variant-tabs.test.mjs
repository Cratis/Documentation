// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { compile } from '@mdx-js/mdx';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkMdx from 'remark-mdx';
import { loadVariantDocsConfig } from './variant-docs-config.mjs';
import { remarkVariantTabs } from './remark-variant-tabs.mjs';
import { convertFile } from './sync-content.mjs';

const config = await loadVariantDocsConfig();

async function fixture(productKey, axisKey) {
    const root = await mkdtemp(path.join(os.tmpdir(), 'variant-tabs-'));
    const docRepoRoot = path.join(root, 'Documentation');
    const axis = config.getAxis(productKey, axisKey);
    const selected = [axis.snippetVariants[0], axis.snippetVariants.at(-1)];
    const variants = selected.map(({ key, label }, index) => ({
        key, label, src: path.join(root, productKey === 'arc' ? 'Arc' : 'Chronicle', 'Documentation', `snippets-${index}`),
    }));
    const fixtureAxis = { ...axis, snippetVariants: variants };
    const snippet = 'capstone/event-sourced';
    const contents = new Map();
    for (const variant of variants) {
        const source = path.join(variant.src, snippet + '.md');
        const content = `\`\`\`text\n${variant.key} owned example\n\`\`\`\n`;
        await mkdir(path.dirname(source), { recursive: true });
        await writeFile(source, content);
        contents.set(source, content);
    }
    const sitePath = path.join(docRepoRoot, 'web/src/content/docs/capstone.mdx');
    await mkdir(path.dirname(sitePath), { recursive: true });
    return { root, docRepoRoot, sitePath, axis: fixtureAxis, variants, snippet, contents };
}

async function render(source, f) {
    const processor = unified().use(remarkParse).use(remarkMdx).use(remarkVariantTabs, {
        axes: [f.axis], reposRoot: f.root, docRepoRoot: f.docRepoRoot,
    });
    return processor.run(processor.parse(source), { path: f.sitePath });
}

for (const [productKey, axisKey] of [['arc', 'backend'], ['chronicle', 'client']]) {
    test(`${productKey} site-owned MDX expands manifest tabs without changing author sources`, async (t) => {
        const f = await fixture(productKey, axisKey);
        t.after(() => rm(f.root, { recursive: true, force: true }));
        const source = `---\ntitle: Capstone\n---\n\nimport { Steps } from '@astrojs/starlight/components';\n\n# Capstone\n\n<${f.axis.macro} snippet="${f.snippet}" variants="${f.variants[1].key},${f.variants[0].key}" />\n\n<${f.axis.macro} snippet="${f.snippet}" />\n`;
        await writeFile(f.sitePath, source);
        const rendered = await render(source, f);
        const repeated = await render(source, f);
        const compiled = await compile({ path: f.sitePath, value: source }, {
            remarkPlugins: [[remarkVariantTabs, { axes: [f.axis], reposRoot: f.root, docRepoRoot: f.docRepoRoot }]],
        });
        assert.match(String(compiled), /TabItem/);
        assert.deepEqual(rendered, repeated);
        assert.equal((await readFile(f.sitePath, 'utf8')), source);
        const imports = rendered.children.filter(child => child.type === 'mdxjsEsm');
        assert.equal(imports.length, 1);
        assert.match(imports[0].value, /Steps, Tabs, TabItem/);
        const tabs = rendered.children.filter(child => child.type === 'mdxJsxFlowElement' && child.name === 'Tabs');
        assert.equal(tabs.length, 2);
        for (const tab of tabs) {
            assert.equal(tab.attributes[0].value, f.axis.syncKey);
            const items = tab.children.filter(child => child.type === 'mdxJsxFlowElement' && child.name === 'TabItem');
            assert.deepEqual(items.map(item => item.attributes[0].value), f.variants.map(variant => variant.label));
            for (const [index, item] of items.entries()) {
                assert.equal(item.children.find(child => child.type === 'code').value, `${f.variants[index].key} owned example`);
                const link = item.children.flatMap(child => child.children ?? []).find(child => child.type === 'link');
                assert.match(link.url, new RegExp(`github.com/Cratis/${productKey === 'arc' ? 'Arc' : 'Chronicle'}/blob/main/Documentation/snippets-${index}/capstone/event-sourced.md$`));
            }
        }
        for (const [file, content] of f.contents) assert.equal(await readFile(file, 'utf8'), content);
        // The product sync uses the same renderer and must leave client snippets intact.
        const synced = await convertFile(source, {
            basename: 'capstone.mdx', dir: path.dirname(f.sitePath), srcPath: f.sitePath,
            product: { key: productKey, src: path.dirname(f.sitePath) },
            variantAxes: [f.axis], reposRoot: f.root, docRepoRoot: f.docRepoRoot,
        });
        assert.match(synced, new RegExp(`<Tabs syncKey="${f.axis.syncKey}">`));
        assert.ok(!synced.includes(`<${f.axis.macro}`));
        assert.equal(await readFile(f.sitePath, 'utf8'), source);
    });
}

test('separate Starlight imports do not duplicate bindings, including aliased imports', async (t) => {
    const f = await fixture('arc', 'backend');
    t.after(() => rm(f.root, { recursive: true, force: true }));
    for (const imports of [
        "import { Steps } from '@astrojs/starlight/components';\nimport { TabItem } from '@astrojs/starlight/components';",
        "import { Tabs as OtherTabs } from '@astrojs/starlight/components';\nimport { TabItem } from '@astrojs/starlight/components';",
        "import { Tabs as OtherTabs, TabItem as OtherItem } from '@astrojs/starlight/components';",
    ]) {
        const source = `${imports}\n\n# Before\n\nSeveral lines of introduction.\n\n<${f.axis.macro} snippet="${f.snippet}" />\n`;
        const rendered = await render(source, f);
        const importNodes = rendered.children.filter(node => node.type === 'mdxjsEsm');
        const statements = importNodes.map(node => node.value);
        assert.equal(importNodes[0].position, undefined);
        assert.equal((statements.join('\n').match(/\bTabs\b(?=\s*[,}])/g) ?? []).length, 1);
        assert.equal((statements.join('\n').match(/\bTabItem\b(?=\s*[,}])/g) ?? []).length, 1);
        const originalHeading = rendered.children.find(node => node.type === 'heading');
        assert.equal(originalHeading.position.start.line, imports.split('\n').length + 2);
        const tabs = rendered.children.find(node => node.type === 'mdxJsxFlowElement' && node.name === 'Tabs');
        assert.equal(tabs.position, undefined);
        assert.equal(tabs.children[0].position, undefined);
        await compile({ path: f.sitePath, value: source }, {
            remarkPlugins: [[remarkVariantTabs, { axes: [f.axis], reposRoot: f.root, docRepoRoot: f.docRepoRoot }]],
        });
    }
});

test('blank-line-separated Starlight imports preserve MDX nodes and share bindings', async (t) => {
    const f = await fixture('arc', 'backend');
    t.after(() => rm(f.root, { recursive: true, force: true }));
    for (const trailingImport of [
        "import { TabItem } from '@astrojs/starlight/components';",
        "import { Tabs as OtherTabs, TabItem as OtherItem } from '@astrojs/starlight/components';",
    ]) {
        const source = `import { Steps } from '@astrojs/starlight/components';\n\nimport Helper from './helper.js';\n\n${trailingImport}\n\n# Before\n\n<${f.axis.macro} snippet="${f.snippet}" />\n`;
        const rendered = await render(source, f);
        const imports = rendered.children.filter(node => node.type === 'mdxjsEsm');
        assert.equal(imports.length, 3);
        assert.equal(imports[0].position, undefined);
        assert.equal(imports[1].value, "import Helper from './helper.js';");
        assert.equal(imports[1].position.start.line, 3);
        assert.equal(imports[2].value, trailingImport);
        const statements = imports.map(node => node.value).join('\n');
        assert.equal((statements.match(/\bTabs\b(?=\s*[,}])/g) ?? []).length, 1);
        assert.equal((statements.match(/\bTabItem\b(?=\s*[,}])/g) ?? []).length, 1);
        assert.equal(rendered.children.find(node => node.type === 'heading').position.start.line, 7);
        await compile({ path: f.sitePath, value: source }, {
            remarkPlugins: [[remarkVariantTabs, { axes: [f.axis], reposRoot: f.root, docRepoRoot: f.docRepoRoot }]],
        });
    }
});

test('a variant snippet symlink may not escape its configured root', async (t) => {
    const f = await fixture('arc', 'backend');
    t.after(() => rm(f.root, { recursive: true, force: true }));
    const snippetPath = path.join(f.variants[0].src, f.snippet + '.md');
    const outside = path.join(f.root, 'public-outside.md');
    await writeFile(outside, '```text\nnot owned by this client\n```\n');
    await rm(snippetPath);
    await symlink(outside, snippetPath);
    await assert.rejects(render(`<${f.axis.macro} snippet="${f.snippet}" />`, f), /Variant snippet escapes configured root/);
});

test('missing and invalid variants fail or warn without writing to the site page', async (t) => {
    const f = await fixture('arc', 'backend');
    t.after(() => rm(f.root, { recursive: true, force: true }));
    const source = `<${f.axis.macro} snippet="${f.snippet}" variants="unknown" />`;
    await writeFile(f.sitePath, source);
    await assert.rejects(render(source, f), /variant\(s\) that do not exist: unknown/);
    await assert.rejects(render(`<${f.axis.macro} />`, f), /missing snippet/);
    await assert.rejects(render(`<${f.axis.macro} snippet="\.\.\/outside" />`, f), /Invalid variant snippet ID/);
    await assert.rejects(render(`<${f.axis.macro} snippet={value} />`, f), /accepts only literal/);
    const previousMissing = console.warn;
    console.warn = () => {};
    try {
        await assert.rejects(render(`<${f.axis.macro} snippet="missing" />`, f), /no matching snippet/);
    } finally {
        console.warn = previousMissing;
    }
    const missing = path.join(f.variants[1].src, f.snippet + '.md');
    await rm(missing);
    const warnings = [];
    const previous = console.warn;
    console.warn = message => warnings.push(message);
    try {
        const partial = await render(`<${f.axis.macro} snippet="${f.snippet}" />`, f);
        assert.equal(partial.children.find(child => child.name === 'Tabs').children.filter(child => child.name === 'TabItem').length, 1);
        assert.match(warnings.join('\n'), /tab is missing/);
    } finally {
        console.warn = previous;
    }
    assert.equal(await readFile(f.sitePath, 'utf8'), source);
});
