// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { LLM_FAMILIES } from './llm-families.mjs';
import { familyFullText, fullTextExports, isBundledExport, pageSection, platformFullText } from './llm-family-exports.mjs';

it('treats the site-wide and family files as bundled exports, not product downloads', () => {
    assert.ok(isBundledExport('/llms-full.txt'));
    assert.ok(isBundledExport('/families/chronicle/llms-full.txt'));
    assert.equal(isBundledExport('/chronicle/llms-full.txt'), false);
});

const chronicle = LLM_FAMILIES.find(family => family.id === 'chronicle');
const page = (slug, title = slug) => ({ slug, title, url: `https://www.cratis.io/${slug}/`, section: `# ${title}\n\nBody for ${slug}.\n` });

it('shares the product title, canonical source and body formatter', () => {
    assert.equal(pageSection(page('chronicle/events', 'Events'), '  Event body.\n'), '# Events\n\nSource: https://www.cratis.io/chronicle/events/\n\nEvent body.\n');
});

it('includes only family products in product-then-slug order', () => {
    const pages = new Map([
        ['chronicle/go', [page('chronicle/go/z'), page('chronicle/go/a')]],
        ['arc', [page('arc/events')]],
        ['chronicle', [page('chronicle/events')]],
    ]);
    const text = familyFullText(chronicle, pages);
    assert.ok(text.indexOf('# chronicle/go/a') < text.indexOf('# chronicle/go/z'));
    assert.ok(text.indexOf('# chronicle/go/z') < text.indexOf('# chronicle/events'));
    assert.doesNotMatch(text, /arc\/events/);
});

it('applies root exclusions to family pages without hiding feature guides', () => {
    const pages = ['chronicle/events', 'chronicle/go/parity', 'chronicle/go/releases', 'chronicle/contributing/building', 'chronicle/decisions/0001', 'chronicle/changelog'];
    const text = familyFullText(chronicle, new Map([['chronicle', pages.map(slug => page(slug))]]));
    assert.match(text, /# chronicle\/events/);
    for (const slug of pages.slice(1)) assert.ok(!text.includes(slug), slug);
});

it('builds the platform export with family links and no excluded platform pages', () => {
    const text = platformFullText([page('samples', 'Samples'), page('ai/cratis-maintainers', 'Maintainer workflow'), page('whats-new', 'Release history')], ['- [Chronicle family full text](/families/chronicle/llms-full.txt)']);
    assert.match(text, /# Samples/);
    assert.match(text, /## Product family downloads/);
    assert.match(text, /\/families\/chronicle\/llms-full\.txt/);
    assert.doesNotMatch(text, /Maintainer workflow|Release history/);
});

it('preserves the product download format and reads each mirror only once', async () => {
    const current = page('chronicle/events', 'Events');
    const groups = [{ key: 'chronicle', label: 'Chronicle', pages: [current, current] }];
    let reads = 0;
    const { files } = await fullTextExports(groups, page => {
        reads++;
        return pageSection(page, 'Event body.');
    }, (label, route) => `- [${label}](${route})`);
    assert.equal(reads, 1);
    const section = '# Events\n\nSource: https://www.cratis.io/chronicle/events/\n\nEvent body.\n';
    assert.equal(files.get('/chronicle/llms-full.txt'), `# Chronicle documentation\n\n> Readable Markdown; HTML page URLs are canonical.\n\n${section}\n${section}`);
});

it('omits files and links for families with no emitted pages', async () => {
    assert.equal(familyFullText(chronicle, new Map()), undefined);
    assert.equal(familyFullText(chronicle, new Map([['chronicle', [page('chronicle/go/parity')]]])), undefined);
    const groups = [{ key: '', label: 'Cratis stack', pages: [page('samples')] }, { key: 'arc', label: 'Arc', pages: [page('arc/events')] }];
    const { files, families } = await fullTextExports(groups, current => pageSection(current, 'Body.'), (label, route) => `- [${label}](${route})`);
    assert.deepEqual(families.map(family => family.id), ['arc']);
    assert.ok(!files.has('/families/chronicle/llms-full.txt'));
    assert.match(files.get('/families/arc/llms-full.txt'), /# arc\/events\n\nSource: https:\/\/www\.cratis\.io\/arc\/events\//);
    assert.doesNotMatch(files.get('/llms-full.txt'), /# arc\/events|families\/chronicle/);
    assert.match(files.get('/llms-full.txt'), /# samples/);
});
