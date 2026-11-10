// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, it } from 'node:test';
import { emitLlmIndexes } from './emit-llm-indexes.mjs';
import { PAGE_SEPARATOR } from './llm-bulk.mjs';

const scratch = path.resolve(import.meta.dirname, '../../.ai-work/llm-index-tests');
const products = [{ key: 'chronicle', label: 'Chronicle' }];
const sets = [{ label: 'Chronicle events', product: 'chronicle', area: 'events', paths: ['chronicle/events', 'chronicle/events/**'] }];
let dist;
let docsRoot;

function source(name, content) {
    file(path.join('docs', name), content);
}

function file(name, content) {
    const target = path.join(dist, name);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
}

beforeEach(() => {
    mkdirSync(scratch, { recursive: true });
    dist = mkdtempSync(path.join(scratch, 'case-'));
    docsRoot = path.join(dist, 'docs');
    file('llms.txt', '# Cratis\n\n## Documentation Sets\n');
    for (const name of ['cratis-stack', 'build-a-full-app', 'samples']) file(`${name}/index.html`, '<h1>Guide</h1>');
    file('_llms-txt/chronicle-events.txt', `# Events\n${'A working event example. '.repeat(10)}\n# Append an event\n${'Append the event. '.repeat(10)}`);
    source('chronicle/index.mdx', '---\ntitle: Chronicle\n---\nWelcome\n');
    file('chronicle.md', '---\ntitle: Chronicle\n---\nWelcome\n');
    file('chronicle/index.html', '<h1>Chronicle</h1>');
    source('chronicle/events/index.md', '---\ntitle: Events\n---\nEvents\n');
    file('chronicle/events.md', '---\ntitle: Events\n---\nEvents\n');
    file('chronicle/events/index.html', '<h1>Events</h1>');
    source('chronicle/events/append.md', '---\ntitle: Append an event\n---\nAppend\n');
    file('chronicle/events/append.md', '---\ntitle: Append an event\n---\nAppend\n');
    file('chronicle/events/append/index.html', '<h1>Append</h1>');
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

it('publishes product and area indexes with valid routes and rendered sets', async () => {
    assert.deepEqual(await emitLlmIndexes(dist, products, sets, docsRoot), { indexedPages: 3, products: 1, areas: 1 });
    assert.match(readFileSync(path.join(dist, 'llms.txt'), 'utf8'), /https:\/\/www\.cratis\.io\/chronicle\/llms\.txt/);
    assert.match(readFileSync(path.join(dist, 'chronicle/llms.txt'), 'utf8'), /https:\/\/www\.cratis\.io\/_llms-txt\/chronicle-events\.txt/);
    assert.match(readFileSync(path.join(dist, 'chronicle/events/llms.txt'), 'utf8'), /\[Append an event\]\(https:\/\/www\.cratis\.io\/chronicle\/events\/append\/\)/);
    const exports = ['llms-full.txt', 'chronicle/llms-full.txt', 'families/chronicle/llms-full.txt'];
    const first = exports.map(route => readFileSync(path.join(dist, route), 'utf8'));
    await emitLlmIndexes(dist, products, sets, docsRoot);
    assert.equal(readFileSync(path.join(dist, 'llms.txt'), 'utf8').match(/## Product documentation/g)?.length, 1);
    assert.deepEqual(exports.map(route => readFileSync(path.join(dist, route), 'utf8')), first);
});

it('indexes a nested product once, as its own product', async () => {
    source('chronicle/go/index.md', '---\ntitle: Chronicle for Go\n---\nGo\n');
    file('chronicle/go.md', '---\ntitle: Chronicle for Go\n---\nGo\n');
    file('chronicle/go/index.html', '<h1>Go</h1>');
    source('chronicle/go/getting-started.md', '---\ntitle: Getting started\n---\nStart\n');
    file('chronicle/go/getting-started.md', '---\ntitle: Getting started\n---\nStart\n');
    file('chronicle/go/getting-started/index.html', '<h1>Getting started</h1>');
    const nested = [...products, { key: 'chronicle/go', label: 'Chronicle.Go' }];
    assert.deepEqual(await emitLlmIndexes(dist, nested, sets, docsRoot), { indexedPages: 5, products: 2, areas: 1 });
    assert.doesNotMatch(readFileSync(path.join(dist, 'chronicle/llms.txt'), 'utf8'), /chronicle\/go\//);
    assert.doesNotMatch(readFileSync(path.join(dist, 'chronicle/llms-full.txt'), 'utf8'), /Chronicle for Go/);
    assert.match(readFileSync(path.join(dist, 'chronicle/go/llms-full.txt'), 'utf8'), /Chronicle for Go/);
    const family = readFileSync(path.join(dist, 'families/chronicle/llms-full.txt'), 'utf8');
    assert.equal(family.match(/# Chronicle for Go\n/g)?.length, 1);
    assert.ok(family.indexOf('# Append an event') < family.indexOf('# Chronicle for Go'));
    assert.match(readFileSync(path.join(dist, 'chronicle/go/llms.txt'), 'utf8'), /## Start here\n\n- \[Getting started\]\(https:\/\/www\.cratis\.io\/chronicle\/go\/getting-started\/\)/);
});

it('links a single-page area directly without an unnecessary index', async () => {
    source('chronicle/architecture.md', '---\ntitle: Runtime architecture\n---\nArchitecture\n');
    file('chronicle/architecture.md', '---\ntitle: Runtime architecture\n---\nArchitecture\n');
    file('chronicle/architecture/index.html', '<h1>Architecture</h1>');
    assert.deepEqual(await emitLlmIndexes(dist, products, sets, docsRoot), { indexedPages: 4, products: 1, areas: 1 });
    assert.match(readFileSync(path.join(dist, 'chronicle/llms.txt'), 'utf8'), /\[Runtime architecture\]\(https:\/\/www\.cratis\.io\/chronicle\/architecture\/\)/);
    assert.equal(existsSync(path.join(dist, 'chronicle/architecture/llms.txt')), false);
});

it('puts a published getting-started landing ahead of alphabetized topics', async () => {
    source('chronicle/get-started/index.md', '---\ntitle: Get started\n---\nStart here.\n');
    file('chronicle/get-started.md', '---\ntitle: Get started\n---\nStart here.\n');
    file('chronicle/get-started/index.html', '<h1>Get started</h1>');
    assert.deepEqual(await emitLlmIndexes(dist, products, sets, docsRoot), { indexedPages: 4, products: 1, areas: 1 });
    const index = readFileSync(path.join(dist, 'chronicle/llms.txt'), 'utf8');
    assert.match(index, /## Start here\n\n- \[Get started\]\(https:\/\/www\.cratis\.io\/chronicle\/get-started\/\)/);
    assert.ok(index.indexOf('## Start here') < index.indexOf('## Overview'));
});

it('refuses to advertise a page without a matching HTML route', async () => {
    rmSync(path.join(dist, 'chronicle/events/append/index.html'));
    await assert.rejects(emitLlmIndexes(dist, products, sets, docsRoot), /Missing HTML for chronicle\/events\/append\.md/);
    assert.equal(existsSync(path.join(dist, 'chronicle/llms.txt')), false);
});

it('does not index dotfiles excluded by the Astro docs loader', async () => {
    source('chronicle/.cursor/commands/private.md', '# Editor command');
    source('chronicle/.hidden.md', '# Hidden page');
    source('chronicle/_partial.md', '# Partial');
    assert.deepEqual(await emitLlmIndexes(dist, products, sets, docsRoot), { indexedPages: 3, products: 1, areas: 1 });
    assert.doesNotMatch(readFileSync(path.join(dist, 'chronicle/llms.txt'), 'utf8'), /cursor|hidden/);
});

it('rejects two sources that resolve to the same public route', async () => {
    source('chronicle/events/append.mdx', '---\ntitle: Duplicate\n---\n');
    await assert.rejects(emitLlmIndexes(dist, products, sets, docsRoot), /Duplicate published page route: \/chronicle\/events\/append\//);
});

it('fails when a rendered set is absent or oversized', async () => {
    rmSync(path.join(dist, '_llms-txt/chronicle-events.txt'));
    await assert.rejects(emitLlmIndexes(dist, products, sets, docsRoot), /Missing rendered documentation set/);
    file('_llms-txt/chronicle-events.txt', 'x'.repeat(600_001));
    await assert.rejects(emitLlmIndexes(dist, products, sets, docsRoot), /600001 bytes/);
});

it('rejects a full-text set with pages outside the index it cites', async () => {
    await assert.rejects(emitLlmIndexes(dist, products, [
        { ...sets[0], paths: ['chronicle/tutorial/**'] },
    ], docsRoot), /Documentation set spans pages outside its area index/);
});

it('drops per-tab snippet source links from rendered sets and bulk exports', async () => {
    const sourceLink = '[View Kotlin snippet source on GitHub](https://github.com/Cratis/Chronicle.Kotlin/blob/main/Documentation/client-snippets/events/append.md)\n';
    file('_llms-txt/chronicle-events.txt', `# Events\n${'A working event example. '.repeat(10)}\n${sourceLink}# Append an event\n${'Append the event. '.repeat(10)}\n`);
    file('llms-full.txt', `# Events\nText\n${sourceLink}`);
    await emitLlmIndexes(dist, products, sets, docsRoot);
    for (const exported of ['_llms-txt/chronicle-events.txt', 'llms-full.txt']) {
        assert.doesNotMatch(readFileSync(path.join(dist, exported), 'utf8'), /snippet source on GitHub/, exported);
    }
    assert.match(readFileSync(path.join(dist, '_llms-txt/chronicle-events.txt'), 'utf8'), /Source: https:\/\/www\.cratis\.io\/chronicle\/events\/append\//);
});

it('keeps snippet source links in product full text but drops them from family full text', async () => {
    const sourceLink = '[View Kotlin snippet source on GitHub](https://github.com/Cratis/Chronicle.Kotlin/blob/main/Documentation/client-snippets/events/append.md)';
    file('chronicle/events/append.md', `---\ntitle: Append an event\n---\nAppend\n\n${sourceLink}\n`);
    await emitLlmIndexes(dist, products, sets, docsRoot);
    assert.match(readFileSync(path.join(dist, 'chronicle/llms-full.txt'), 'utf8'), /snippet source on GitHub/);
    assert.doesNotMatch(readFileSync(path.join(dist, 'families/chronicle/llms-full.txt'), 'utf8'), /snippet source on GitHub/);
});

it('rejects a valid-sized set missing an expected page', async () => {
    file('_llms-txt/chronicle-events.txt', `# Events\n${'Content. '.repeat(30)}`);
    await assert.rejects(emitLlmIndexes(dist, products, sets, docsRoot), /Missing rendered pages in Chronicle events: Append an event/);
});

it('does not publish an empty required product', async () => {
    rmSync(path.join(docsRoot, 'chronicle'), { recursive: true, force: true });
    await assert.rejects(emitLlmIndexes(dist, products, sets, docsRoot), /Missing required product in build: chronicle/);
});


it('curates the small download but retains detailed pages in described product full-text sets', async () => {
    for (const [key, label] of [['arc', 'Arc'], ['components', 'Components'], ['fundamentals', 'Fundamentals'], ['cli', 'CLI']]) {
        const content = `---\ntitle: ${label}\n---\n${label} overview.\n`;
        source(`${key}/index.md`, content);
        file(`${key}.md`, content);
        file(`${key}/index.html`, `<h1>${label}</h1>`);
    }
    const allProducts = [...products, ...['arc', 'components', 'fundamentals', 'cli'].map(key => ({ key, label: key }))];
    await emitLlmIndexes(dist, allProducts, sets, docsRoot);
    const small = readFileSync(path.join(dist, 'llms-small.txt'), 'utf8');
    assert.match(small, /400,000 bytes/);
    assert.match(small, /\[Events\]/);
    assert.doesNotMatch(small, /Append an event/);
    assert.ok(Buffer.byteLength(small) <= 400_000);
    const root = readFileSync(path.join(dist, 'llms.txt'), 'utf8');
    for (const { key } of allProducts) {
        assert.ok(root.includes(`/${key}/llms-full.txt): Readable Markdown for`), key);
        assert.ok(existsSync(path.join(dist, key, 'llms-full.txt')), key);
    }
    for (const id of ['chronicle', 'arc', 'components', 'fundamentals', 'tooling']) {
        assert.ok(root.includes(`/families/${id}/llms-full.txt`), id);
        assert.ok(existsSync(path.join(dist, 'families', id, 'llms-full.txt')), id);
    }
    assert.doesNotMatch(root, /families\/screenplay-stage/);
    assert.equal(existsSync(path.join(dist, 'families/screenplay-stage/llms-full.txt')), false);
    const full = readFileSync(path.join(dist, 'chronicle/llms-full.txt'), 'utf8');
    assert.match(full, /# Append an event\n\nSource: https:\/\/www\.cratis\.io\/chronicle\/events\/append\//);
    assert.doesNotMatch(full, /title: Chronicle|---/);
    assert.doesNotMatch(root, /dapr|wolverine/i);
});


it('keeps root-only exclusions discoverable in product downloads and the root index', async () => {
    const pages = [
        ['chronicle/contributing/building', 'Building Chronicle'],
        ['chronicle/go/parity', 'Chronicle.Go parity'],
        ['chronicle/go/releases', 'Go releases'],
        ['chronicle/decisions/0001-contract', 'Contract decision'],
        ['chronicle/building-a-client/checklist', 'Client implementation checklist'],
        ['api/dotnet/type', 'Generated type'],
        ['release-digests/2026-10-20', 'Weekly digest'],
        ['ai/cratis-maintainers', 'Maintainer workflow'],
    ];
    source('samples.md', '---\ntitle: Samples\n---\nPlatform examples.\n');
    file('samples.md', '---\ntitle: Samples\n---\nPlatform examples.\n');
    source('index.md', '---\ntitle: Cratis platform\n---\nPlatform home.\n');
    file('index.md', '---\ntitle: Cratis platform\n---\nPlatform home.\n');
    for (const [slug, title] of pages) {
        const content = `---\ntitle: ${title}\n---\nDetailed evidence.\n`;
        source(`${slug}.md`, content);
        file(`${slug}.md`, content);
        file(`${slug}/index.html`, `<h1>${title}</h1>`);
    }
    file('llms-full.txt', ['# Events\n\nFeature guide.', ...pages.map(([, title]) => `# ${title}\n\nDetailed evidence.`)].join(PAGE_SEPARATOR));
    await emitLlmIndexes(dist, products, sets, docsRoot);
    const root = readFileSync(path.join(dist, 'llms-full.txt'), 'utf8');
    assert.match(root, /# Samples\n\nSource: https:\/\/www\.cratis\.io\/samples\//);
    assert.match(root, /Platform home/);
    assert.doesNotMatch(root, /Feature guide|# Events|# Append an event|# Chronicle\n/);
    assert.match(root, /\/families\/chronicle\/llms-full\.txt/);
    for (const [, title] of pages) assert.ok(!root.includes(title), title);
    const family = readFileSync(path.join(dist, 'families/chronicle/llms-full.txt'), 'utf8');
    assert.match(family, /# Append an event/);
    for (const [, title] of pages) assert.ok(!family.includes(title), title);
    assert.match(readFileSync(path.join(dist, 'llms.txt'), 'utf8'), /https:\/\/www\.cratis\.io\/chronicle\/llms-full\.txt/);
    for (const name of ['chronicle/llms.txt', 'chronicle/llms-full.txt']) {
        const content = readFileSync(path.join(dist, name), 'utf8');
        assert.match(content, /Building Chronicle/);
        assert.match(content, name.endsWith('llms-full.txt') ? /Chronicle.Go parity/ : /chronicle\/go\/llms\.txt/);
        assert.match(content, name.endsWith('llms-full.txt') ? /Go releases/ : /Go pages \(2\)/);
        assert.match(content, /Contract decision/);
        assert.match(content, /Client implementation checklist/);
        assert.doesNotMatch(content, /Generated type|Weekly digest/);
    }
    assert.ok(existsSync(path.join(dist, 'chronicle/go/parity.md')));
});

it('excludes logs and generated API references from curated and product downloads', async () => {
    for (const slug of ['chronicle/changelog', 'release-digests/2026-10-20', 'api/dotnet/type']) {
        const content = '---\ntitle: Excluded reference\n---\nNot starting-point context.\n';
        source(`${slug}.md`, content);
        file(`${slug}.md`, content);
        file(`${slug}/index.html`, '<h1>Excluded reference</h1>');
    }
    await emitLlmIndexes(dist, products, sets, docsRoot);
    for (const name of ['llms-small.txt', 'chronicle/llms-full.txt']) {
        assert.doesNotMatch(readFileSync(path.join(dist, name), 'utf8'), /Excluded reference|release-digests|api\/dotnet/);
    }
});
