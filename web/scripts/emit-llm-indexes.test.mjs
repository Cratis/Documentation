// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, it } from 'node:test';
import { emitLlmIndexes } from './emit-llm-indexes.mjs';

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
    await emitLlmIndexes(dist, products, sets, docsRoot);
    assert.equal(readFileSync(path.join(dist, 'llms.txt'), 'utf8').match(/## Product documentation/g)?.length, 1);
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

it('rejects a valid-sized set missing an expected page', async () => {
    file('_llms-txt/chronicle-events.txt', `# Events\n${'Content. '.repeat(30)}`);
    await assert.rejects(emitLlmIndexes(dist, products, sets, docsRoot), /Missing rendered pages in Chronicle events: Append an event/);
});

it('does not publish an empty required product', async () => {
    rmSync(path.join(docsRoot, 'chronicle'), { recursive: true, force: true });
    await assert.rejects(emitLlmIndexes(dist, products, sets, docsRoot), /Missing required product in build: chronicle/);
});
