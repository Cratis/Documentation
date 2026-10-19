// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { apiPageUrl, dateModifiedOf, noindexed, withCanonicalAndDescription } from './seo-postbuild.mjs';
import { abridgedExport, isLogPage, sizeWarnings, withoutExcludedPages, PAGE_MARKER } from './llm-bulk.mjs';
import { pageKind, structuredData } from './page-metadata.mjs';

describe('SEO post-build', () => {
    it('adds noindex once and respects an existing robots tag', () => {
        assert.match(noindexed('<head></head>'), /<meta name="robots" content="noindex"><\/head>/);
        const existing = '<head><meta name="robots" content="index"></head>';
        assert.equal(noindexed(existing), existing);
    });

    it('adds canonical and description to API pages without them, and skips redirects', () => {
        const html = '<html><head><title>Foo &amp; Bar | API</title></head></html>';
        const out = withCanonicalAndDescription(html, 'dotnet/Foo.html');
        assert.match(out, /rel="canonical" href="https:\/\/www.cratis.io\/api\/dotnet\/Foo.html"/);
        assert.match(out, /name="description" content="Foo &amp; Bar — API reference/);
        const redirect = '<head><meta http-equiv="refresh" content="0;url=x"></head>';
        assert.equal(withCanonicalAndDescription(redirect, 'a.html'), redirect);
        assert.equal(apiPageUrl('dotnet/index.html'), 'https://www.cratis.io/api/dotnet/');
    });

    it('reads dateModified from JSON-LD', () => {
        assert.equal(dateModifiedOf('{"dateModified":"2026-09-10"}'), '2026-09-10');
        assert.equal(dateModifiedOf('{}'), undefined);
    });
});

describe('LLM bulk exports', () => {
    it('recognises release logs and drops only their pages', () => {
        assert.ok(isLogPage('release-digests/2026-09-28'));
        assert.ok(!isLogPage('chronicle/events'));
        const content = `# Keep\n\nx\n${PAGE_MARKER}\n# Digest\n\ny\n`;
        const out = withoutExcludedPages(content, [{ title: 'Keep' }, { title: 'Digest', excluded: true }]);
        assert.ok(out.includes('# Keep') && !out.includes('# Digest'));
    });

    it('builds an abridged list and warns above thresholds', () => {
        assert.match(abridgedExport('T', [{ label: 'L', pages: [{ title: 'A [x]', url: 'u', description: 'd' }] }, { label: 'E', pages: [] }]), /- \[A \\\[x\\\]\]\(u\): d/);
        assert.equal(sizeWarnings(new Map([['/llms-small.txt', 1]])).length, 0);
        assert.equal(sizeWarnings(new Map([['/llms-small.txt', 10_000_000]])).length, 1);
    });
});

describe('page kinds', () => {
    it('classifies landing, glossary, hub and article pages', () => {
        assert.equal(pageKind('chronicle'), 'software');
        assert.equal(pageKind('screenplay'), 'software');
        assert.equal(pageKind('glossary'), 'glossary');
        assert.equal(pageKind('chronicle/events', { hasChildren: true }), 'collection');
        assert.equal(pageKind('chronicle/events/x'), 'article');
        const data = structuredData({ title: 'T', description: 'd', url: 'u', breadcrumbs: [], kind: 'article', dateModified: '2026-01-01' });
        assert.equal(data['@graph'][0]['@type'], 'TechArticle');
        assert.equal(data['@graph'][0].dateModified, '2026-01-01');
    });
});
