// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PRODUCTS, walk } from './sync-content.mjs';
import { isSkippedRootFile } from './root-files.mjs';

const fixturesRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)), '../.ai-work/root-files');

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

test('a declared root page named like a bootstrap file is synced only from the product root', async (context) => {
    const root = await fixture(context);
    const source = path.join(root, 'screenplay');
    const familySource = path.join(root, 'stage-guides');
    const output = path.join(root, 'generated');
    const familyOutput = path.join(root, 'family-generated');
    await put(source, 'agents.md', '# Agents\n\nAn agents block lists what an agent may call.\n');
    await put(source, 'claude.md', '@.cratis/PROJECT.md\n');
    await put(familySource, 'agents.md', '# Stage Agents\n\nStage-specific bootstrap.\n');

    const product = { key: 'screenplay', src: source, includeRootPages: ['agents.md'] };
    await walk(source, output, product);
    await walk(familySource, familyOutput, product, { contentRoot: familySource, slugBase: 'screenplay/stage/guides' });

    assert.match(await fs.readFile(path.join(output, 'agents.md'), 'utf8'), /An agents block/);
    await assert.rejects(fs.access(path.join(output, 'claude.md')), { code: 'ENOENT' });
    await assert.rejects(fs.access(path.join(familyOutput, 'agents.md')), { code: 'ENOENT' });
});

test('Screenplay declares its agents page', () => {
    assert.deepEqual(PRODUCTS.find((candidate) => candidate.key === 'screenplay').includeRootPages, ['agents.md']);
});

test('root files are skipped for bootstrap names and a product\'s own excluded root files', () => {
    const product = { key: 'arc', src: '/docs/arc', excludeRootFiles: ['project-context.md'] };
    assert.equal(isSkippedRootFile('AGENTS.md', '/docs/arc', product), true);
    assert.equal(isSkippedRootFile('Project-Context.md', '/docs/arc', product), true);
    assert.equal(isSkippedRootFile('index.md', '/docs/arc', product), false);
});
