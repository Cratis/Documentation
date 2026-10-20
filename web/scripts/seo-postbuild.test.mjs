// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { copyFile, mkdir, mkdtemp, rm, symlink, truncate, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apiPageUrl, checkLlmBudgets, dateModifiedOf, noindexed, withCanonicalAndDescription } from './seo-postbuild.mjs';
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

    it('checks disk bytes and makes the CLI fail only with explicit budget enforcement', async t => {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const scratch = path.resolve(here, '../../.ai-work/seo');
        await mkdir(scratch, { recursive: true });
        const root = await mkdtemp(path.join(scratch, 'seo-postbuild-'));
        t.after(() => rm(root, { recursive: true, force: true }));
        const scripts = path.join(root, 'scripts');
        const dist = path.join(root, 'dist');
        await mkdir(scripts);
        await mkdir(dist);
        await copyFile(path.join(here, 'seo-postbuild.mjs'), path.join(scripts, 'seo-postbuild.mjs'));
        await symlink(path.join(here, 'llm-bulk.mjs'), path.join(scripts, 'llm-bulk.mjs'));
        const small = path.join(dist, 'llms-small.txt');
        const full = path.join(dist, 'llms-full.txt');
        await writeFile(small, '');
        await writeFile(full, '');
        // Sparse files exercise byte thresholds without generating documentation content.
        await truncate(small, 400_001);
        await truncate(full, 17_000_001);
        // Expected failures must not become GitHub Actions error annotations.
        const errors = t.mock.method(console, 'error', () => {});
        const result = await checkLlmBudgets(dist, { enforce: true });
        assert.equal(result.failed, true);
        assert.deepEqual(result.exceeded.map(item => item.bytes), [400_001, 17_000_001]);
        // Non-boundary sizes prove reporting is the disk size, not a budget+1 sentinel.
        await truncate(small, 410_739);
        await truncate(full, 17_123_456);
        const measured = await checkLlmBudgets(dist, { enforce: true });
        assert.deepEqual(measured.exceeded.map(item => item.bytes), [410_739, 17_123_456]);
        assert.equal(errors.mock.calls.length, 4);
        errors.mock.restore();
        const run = (enforce) => {
            const env = { ...process.env };
            delete env.LLM_BUDGET_ENFORCE;
            if (enforce !== undefined) env.LLM_BUDGET_ENFORCE = enforce;
            return spawnSync(process.execPath, [path.join(scripts, 'seo-postbuild.mjs')], { env, encoding: 'utf8', timeout: 10_000 });
        };
        for (const enforce of [undefined, '', '0']) {
            const warning = run(enforce);
            assert.equal(warning.status, 0, warning.stderr);
            // The exporter retains its warning; postbuild must not emit a duplicate.
            assert.doesNotMatch(warning.stderr, /::error|LLM export size/);
        }
        const enforced = run('1');
        assert.equal(enforced.status, 1, enforced.stderr);
        assert.match(enforced.stderr, /::error title=LLM export size::/);
        assert.match(enforced.stderr, /llms-small\.txt is 410739 bytes/);
        assert.match(enforced.stderr, /llms-full\.txt is 17123456 bytes/);
        await truncate(small, 400_000);
        await truncate(full, 17_000_000);
        const atBudget = run('1');
        assert.equal(atBudget.status, 0, atBudget.stderr);
        assert.doesNotMatch(atBudget.stderr, /LLM export size/);
        await truncate(small, 1);
        await truncate(full, 1);
        assert.equal(run('1').status, 0);
        const productDirectory = path.join(dist, 'fundamentals', 'go');
        await mkdir(productDirectory, { recursive: true });
        const productSmall = path.join(productDirectory, 'llms-small.txt');
        await writeFile(productSmall, '');
        await truncate(productSmall, 400_001);
        const productEnforced = run('1');
        assert.equal(productEnforced.status, 1, productEnforced.stderr);
        assert.match(productEnforced.stderr, /fundamentals\/go\/llms-small\.txt/);
        assert.equal(run('0').status, 0);
        await truncate(productSmall, 400_000);
        assert.equal(run('1').status, 0);
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
