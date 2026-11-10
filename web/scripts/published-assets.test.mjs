// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { walk } from './sync-content.mjs';
import { emitDocArtifacts } from './emit-doc-artifacts.mjs';
import { assetLinkTarget, publishedAssetPath } from './published-assets.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const fixturesRoot = path.resolve(webRoot, '../.ai-work/published-assets');

async function fixture(context) {
    await fs.mkdir(fixturesRoot, { recursive: true });
    const root = await fs.mkdtemp(path.join(fixturesRoot, 'regression-'));
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    return root;
}

async function put(root, relative, content) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
}

test('an asset is published under slugged directories with a lowercased, cleaned name', () => {
    assert.equal(publishedAssetPath('Agents/Capability Manifest.v1.JSON'), 'agents/capabilitymanifest.v1.json');
    assert.equal(publishedAssetPath('schema.json'), 'schema.json');
});

test('only in-root links to assets Astro does not process are routed', () => {
    const roots = { dir: '/docs/mcp', product: { key: 'screenplay', src: '/docs' } };
    assert.equal(assetLinkTarget(roots, '../manifest.schema.json', 'raw', '#x'), '/screenplay/manifest.schema.json#x');
    assert.equal(assetLinkTarget(roots, 'shot.png', 'shot.png', ''), 'shot.png');
    assert.equal(assetLinkTarget(roots, '/screenplay/a.json', '/screenplay/a.json', ''), '/screenplay/a.json');
    assert.equal(assetLinkTarget(roots, 'reference.md', 'reference.md', ''), null);
});

test('relative links to published assets name the route the asset is copied to', async (context) => {
    const root = await fixture(context);
    const source = path.join(root, 'authored');
    const docs = path.join(root, 'docs');
    const output = path.join(root, 'dist');
    await put(source, 'Manifests.md', [
        '[schema](Manifest-v1.schema.json?raw=1#top) [example](Manifest-v1.example.play)',
        '<a href="Data/Report.html">report</a> ![chart](chart.png)',
    ].join('\n'));
    await put(source, 'Mcp/reference.md', '[schema](../Manifest-v1.schema.json "Schema")\n');
    await put(source, 'Manifest-v1.schema.json', '{}');
    await put(source, 'Manifest-v1.example.play', 'module X');
    await put(source, 'Data/Report.html', '<p></p>');
    await put(source, 'chart.png', 'png');
    const productDocs = path.join(docs, 'fixture');
    await walk(source, productDocs, { key: 'fixture', src: source });

    const manifests = await fs.readFile(path.join(productDocs, 'Manifests.md'), 'utf8');
    assert.ok(manifests.includes('](/fixture/manifest-v1.schema.json?raw=1#top)'), manifests);
    assert.ok(manifests.includes('](/fixture/manifest-v1.example.play)'), manifests);
    assert.ok(manifests.includes('href="/fixture/data/report.html"'), manifests);
    assert.ok(manifests.includes('](chart.png)'), manifests);
    const reference = await fs.readFile(path.join(productDocs, 'Mcp/reference.md'), 'utf8');
    assert.ok(reference.includes('](/fixture/manifest-v1.schema.json "Schema")'), reference);

    await emitDocArtifacts(docs, output);
    for (const route of ['manifest-v1.schema.json', 'manifest-v1.example.play', 'data/report.html']) {
        await fs.access(path.join(output, 'fixture', route));
    }
});
