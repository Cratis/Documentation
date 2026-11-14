// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { isExcludedPageTocHref } from './excluded-doc-pages.mjs';
import { PRODUCTS, droppedSidebarEntriesSnapshot, entryToItem, isExcludedRootTocHref, walk } from './sync-content.mjs';

const fixturesRoot = new URL('../../.ai-work/285/exclusions/', import.meta.url);
const excludedPath = 'backend/csharp/mcp/capability-manifest.md';
const reason = 'The contract is unimplemented; publish when implemented and authoring markers are removed.';

async function fixture(context, page = excludedPath) {
    await fs.mkdir(fixturesRoot, { recursive: true });
    const root = await fs.mkdtemp(new URL('regression-', fixturesRoot));
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const product = { key: 'fixture', src: path.join(root, 'source'), excludePages: [{ path: page, reason }] };
    await fs.mkdir(product.src);
    return { product, output: path.join(root, 'output') };
}

async function put(root, relative, content) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
}

test('isExcludedRootTocHref still defaults to the configured products when called with two arguments', () => {
    const product = PRODUCTS.find((candidate) => candidate.src && candidate.excludeRootFiles?.length);
    assert.ok(product, 'expected a product with excludeRootFiles');
    assert.equal(isExcludedRootTocHref(product.excludeRootFiles[0], product.src), true);
    assert.equal(isExcludedRootTocHref('not-excluded-page.md', product.src), false);
});

test('Arc excludes the unimplemented capability manifest with a reason and removal condition', () => {
    const arc = PRODUCTS.find((product) => product.key === 'arc');
    assert.deepEqual(arc.excludePages, [{
        path: excludedPath,
        reason: 'Describes the capability-manifest contract from Cratis/Arc#3750 and #3751, which Arc has not implemented yet; publish once Arc ships it and the page loses its TODO markers.',
    }]);
});

test('walk excludes only the exact nested page, ignoring case and separator differences', async (context) => {
    const { product, output } = await fixture(context, 'BACKEND\\CSHARP\\MCP\\CAPABILITY-MANIFEST.MD');
    await put(product.src, excludedPath, '# Capability manifest\n\n<!-- TODO: implement -->\n');
    const retained = ['capability-manifest.md', 'other/capability-manifest.md', 'backend/csharp/mcp/nested/capability-manifest.md'];
    for (const page of retained) await put(product.src, page, '# Published page\n\nAvailable now.\n');
    const warning = context.mock.method(console, 'warn', () => {});

    await walk(product.src, output, product);

    await assert.rejects(fs.access(path.join(output, excludedPath)), { code: 'ENOENT' });
    for (const page of retained) assert.match(await fs.readFile(path.join(output, page), 'utf8'), /Available now/);
    assert.equal(warning.mock.callCount(), 0);
});

test('toc hrefs to excluded pages are silently omitted, not recorded as dropped entries', async (context) => {
    const { product } = await fixture(context);
    PRODUCTS.push(product);
    context.after(() => PRODUCTS.splice(PRODUCTS.indexOf(product), 1));
    const directory = path.join(product.src, 'backend/csharp/mcp');
    const before = droppedSidebarEntriesSnapshot();
    const slugs = new Set(['fixture/other/capability-manifest']);
    for (const href of ['./capability-manifest.md#contract', '.\\CAPABILITY-MANIFEST.MD?view=full']) {
        assert.equal(isExcludedPageTocHref(href, directory, PRODUCTS), true);
        assert.equal(await entryToItem({ name: 'Manifest', href }, directory, 'fixture/backend/csharp/mcp', slugs), null);
    }
    assert.equal(isExcludedPageTocHref(excludedPath, product.src, PRODUCTS), true);
    assert.equal(isExcludedPageTocHref('other/capability-manifest.md', product.src, PRODUCTS), false);
    assert.deepEqual(await entryToItem({ name: 'Other', href: 'other/capability-manifest.md' }, product.src, 'fixture', slugs), {
        label: 'Other', slug: 'fixture/other/capability-manifest',
    });
    assert.deepEqual(droppedSidebarEntriesSnapshot(), before);

    await entryToItem({ name: 'Missing', href: 'missing.md' }, directory, 'fixture/backend/csharp/mcp', slugs);
    assert.equal(droppedSidebarEntriesSnapshot().length, before.length + 1);
});

function withCi(context, value) {
    const previous = process.env.CI;
    if (value === undefined) delete process.env.CI; else process.env.CI = value;
    context.after(() => { if (previous === undefined) delete process.env.CI; else process.env.CI = previous; });
}

test('outside CI, a missing excluded source only warns, so an older local checkout still syncs', async (context) => {
    withCi(context, undefined);
    const { product, output } = await fixture(context);
    const warning = context.mock.method(console, 'warn', () => {});

    await walk(product.src, output, product);

    assert.equal(warning.mock.callCount(), 1);
    assert.match(String(warning.mock.calls[0].arguments[0]), /Stale exclusion/);
});

test('in CI, walk rejects a stale exclusion when its source file is missing', async (context) => {
    withCi(context, 'true');
    const { product, output } = await fixture(context);
    await assert.rejects(walk(product.src, output, product), (error) => {
        assert.match(error.message, /Stale exclusion/);
        assert.ok(error.message.includes(excludedPath));
        return true;
    });
});

test('a marker-free excluded page warns once without failing or publishing it', async (context) => {
    const { product, output } = await fixture(context);
    await put(product.src, excludedPath, '# Capability manifest\n\nThe contract is implemented.\n');
    const warning = context.mock.method(console, 'warn', () => {});

    await walk(product.src, output, product);

    assert.equal(warning.mock.callCount(), 1);
    const [message] = warning.mock.calls[0].arguments;
    assert.ok(message.includes(excludedPath));
    assert.ok(message.includes(reason));
    assert.match(message, /may now be removed/);
    await assert.rejects(fs.access(path.join(output, excludedPath)), { code: 'ENOENT' });
});

test('links to an excluded page become plain text; siblings, images and code stay untouched', async (context) => {
    const { product, output } = await fixture(context);
    await put(product.src, excludedPath, '# Capability manifest\n\n<!-- TODO: implement -->\n');
    await put(product.src, 'backend/csharp/mcp/other.md', '# Other\n');
    await put(product.src, 'backend/csharp/mcp/index.md', [
        '# MCP',
        '',
        '| Declare | [Capability manifest](capability-manifest.md) |',
        'See [the contract](./capability-manifest.md#contract) and [full](../mcp/Capability-Manifest.md?view=full).',
        'Read [Other](other.md) and [elsewhere](../../../capability-manifest.md).',
        '![diagram](capability-manifest.md)',
        '`[inline](capability-manifest.md)`',
        '',
    ].join('\n'));

    await walk(product.src, output, product);

    const page = await fs.readFile(path.join(output, 'backend/csharp/mcp/index.md'), 'utf8');
    assert.match(page, /\| Declare \| Capability manifest \|/);
    assert.match(page, /See the contract and full\./);
    assert.match(page, /\[Other\]\(\/fixture\/backend\/csharp\/mcp\/other\/\)/);
    assert.match(page, /\[elsewhere\]\(/);
    assert.match(page, /!\[diagram\]\(/);
    assert.match(page, /`\[inline\]\(capability-manifest\.md\)`/);
});

for (const marker of ['TODO', 'FIXME', 'TBD']) {
    test(`an excluded page containing ${marker} does not warn`, async (context) => {
        const { product, output } = await fixture(context);
        await put(product.src, excludedPath, `# Manifest\n\n<!-- ${marker}: implement -->\n`);
        const warning = context.mock.method(console, 'warn', () => {});
        await walk(product.src, output, product);
        assert.equal(warning.mock.callCount(), 0);
    });
}
