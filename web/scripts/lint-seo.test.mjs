// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyse, compare, duplicateBrowserTitles } from './lint-seo.mjs';

describe('SEO lint', () => {
    const pages = [
        { file: 'a.md', data: { title: 'Events', description: 'Real description of the events page.' } },
        { file: 'b/index.md', data: { title: 'Events', description: 'Events in the Chronicle documentation for Cratis.' } },
        { file: 'd.md', data: { title: 'No description' } },
        { file: 'c.md', data: { title: 'Draft', draft: true } },
        { file: '404.md', data: { title: '404' } },
    ];

    it('finds fallback and missing descriptions, skipping drafts and 404', () => {
        assert.deepEqual(analyse(pages).missingDescription, ['b/index.md', 'd.md']);
    });

    it('warns above the description baseline, asks to lower it below, and is quiet at the baseline', () => {
        assert.deepEqual(compare({ missingDescription: 3 }, { missingDescription: 2 }).map(m => m.level), ['warning']);
        assert.deepEqual(compare({ missingDescription: 3 }, { missingDescription: 5 }).map(m => m.level), ['notice']);
        assert.deepEqual(compare({ missingDescription: 3 }, { missingDescription: 3 }), []);
    });

    const page = (file, title = 'Shared topic', extra = {}) => ({ file, data: { title, ...extra } });

    it('accepts 120 and 160 characters and reports both outside boundaries', () => {
        const result = analyse([119, 120, 160, 161].map(length => page(`chronicle/${length}.md`, `Length ${length}`, { description: 'a'.repeat(length) })));
        assert.deepEqual(result.invalidDescriptionLength, [{ file: 'chronicle/119.md', length: 119 }, { file: 'chronicle/161.md', length: 161 }]);
        assert.deepEqual(result.descriptionSummary, { chronicle: { pages: 4, short: 1, long: 1, duplicates: 0 } });
    });

    it('checks derived published descriptions and counts Unicode characters, not UTF-16 units', () => {
        const result = analyse([
            { ...page('arc/derived.md', 'Derived'), body: 'A complete paragraph that describes the page and its purpose without relying on authored frontmatter, so readers can understand the result.' },
            page('arc/unicode.md', 'Unicode', { description: '🙂'.repeat(120) }),
        ]);
        assert.deepEqual(result.invalidDescriptionLength, []);
        assert.equal(result.descriptionSummary.arc.pages, 2);
    });

    it('reports duplicate descriptions across products, skipping drafts and 404 routes', () => {
        const description = 'A'.repeat(120);
        const result = analyse([
            page('arc/index.md', 'Arc', { description }),
            page('chronicle/a.md', 'Chronicle', { description: ` ${description} ` }),
            page('arc/draft.md', 'Draft', { description, draft: true }),
            page('404.mdx', '404', { description }),
            page('arc/not-found.md', 'Not found', { description, slug: '404' }),
            page('other.md', 'Other', { description: 'B'.repeat(160) }),
        ]);
        assert.deepEqual(result.duplicateDescription, [{ description, files: ['arc/index.md', 'chronicle/a.md'] }]);
        assert.deepEqual(result.descriptionSummary, {
            arc: { pages: 1, short: 0, long: 0, duplicates: 1 },
            chronicle: { pages: 1, short: 0, long: 0, duplicates: 1 },
            site: { pages: 1, short: 0, long: 0, duplicates: 0 },
        });
    });

    it('warns about description quality by default and errors only when description strictness is enabled', () => {
        const counts = { invalidDescriptionLength: 2, duplicateDescription: 3 };
        assert.deepEqual(compare(counts, {}, true, false).map(m => m.level), ['warning', 'warning']);
        assert.deepEqual(compare(counts, {}, false, true).map(m => m.level), ['error', 'error']);
        assert.deepEqual(compare({ invalidDescriptionLength: 0, duplicateDescription: 0 }, {}, false, true), []);
    });

    it('reports identical computed browser titles within a section, including every offending file', () => {
        assert.deepEqual(duplicateBrowserTitles([page('chronicle/a.md'), page('chronicle/b.mdx')]), [{
            section: 'chronicle', title: 'Shared topic – Chronicle | Cratis', files: ['chronicle/a.md', 'chronicle/b.mdx'],
        }]);
    });

    it('allows identical computed titles in different top-level sections', () => {
        assert.deepEqual(duplicateBrowserTitles([page('guides/a.md'), page('tutorials/a.md')]), []);
    });

    it('allows language variants disambiguated by contextualTitle', () => {
        assert.deepEqual(duplicateBrowserTitles([
            page('chronicle/csharp/commands.md', 'Commands'),
            page('chronicle/typescript/commands.md', 'Commands'),
            page('chronicle/go/commands.md', 'Commands'),
            page('chronicle/kotlin/index.md', 'Kotlin and Java'),
            page('chronicle/java/index.md', 'Kotlin and Java'),
            page('chronicle/kotlin/commands.md', 'Commands'),
            page('chronicle/java/commands.md', 'Commands'),
        ]), []);
    });

    it('reports variants whose languages contextualTitle cannot disambiguate', () => {
        const groups = duplicateBrowserTitles([
            page('chronicle/swift/commands.md', 'Commands'),
            page('chronicle/ruby/commands.md', 'Commands'),
        ]);
        assert.equal(groups.length, 1);
        assert.equal(groups[0].title, 'Commands – Chronicle | Cratis');
        assert.equal(groups[0].files.length, 2);
    });

    it('uses published ancestor titles and hub overrides as Head.astro does', () => {
        assert.deepEqual(duplicateBrowserTitles([
            page('chronicle/index.md', 'Chronicle'),
            page('chronicle/reads/index.md', 'Reading data'),
            page('chronicle/writes/index.md', 'Writing data'),
            page('chronicle/reads/a.md', 'Overview'),
            page('chronicle/writes/a.md', 'Overview'),
            page('chronicle/a.md', 'Chronicle'),
        ]), []);
    });

    it('skips drafts and 404, and uses custom slugs for section boundaries', () => {
        assert.deepEqual(duplicateBrowserTitles([
            page('chronicle/a.md'), page('chronicle/b.md', 'Shared topic', { draft: true }),
            page('404.md'), page('chronicle/c.md', 'Shared topic', { slug: 'arc/c' }),
        ]), []);
    });

    it('errors above the title baseline, warns below or at it, and is quiet at zero', () => {
        for (const [count, baseline, expected] of [[3, 2, 'error'], [2, 3, 'warning'], [2, 2, 'warning']]) {
            assert.deepEqual(compare({ duplicateTitle: count }, { duplicateTitle: baseline }, true).map(m => m.level), [expected]);
        }
        for (const [count, baseline, expected] of [[3, 2, 'warning'], [2, 3, 'warning'], [2, 2, 'warning']]) {
            assert.deepEqual(compare({ duplicateTitle: count }, { duplicateTitle: baseline }, false).map(m => m.level), [expected]);
        }
        assert.deepEqual(compare({ duplicateTitle: 0 }, { duplicateTitle: 0 }), []);
    });

    it('fails only when enforced above the title baseline, and updates both baseline counts on request', async t => {
        const here = path.dirname(fileURLToPath(import.meta.url));
        const scratch = path.resolve(here, '../../.ai-work/seo');
        await mkdir(scratch, { recursive: true });
        const root = await mkdtemp(path.join(scratch, 'seo-lint-'));
        t.after(() => rm(root, { recursive: true, force: true }));
        const scripts = path.join(root, 'scripts');
        const docs = path.join(root, 'src/content/docs/chronicle');
        await mkdir(scripts);
        await mkdir(docs, { recursive: true });
        await copyFile(path.join(here, 'lint-seo.mjs'), path.join(scripts, 'lint-seo.mjs'));
        await symlink(path.join(here, 'page-metadata.mjs'), path.join(scripts, 'page-metadata.mjs'));
        await symlink(path.resolve(here, '../node_modules'), path.join(root, 'node_modules'));
        for (const file of ['a.md', 'b.mdx']) await writeFile(path.join(docs, file), '---\ntitle: Shared topic\n---\n');
        const baseline = path.join(scripts, 'seo-baseline.json');
        await writeFile(baseline, JSON.stringify({ missingDescription: 0, duplicateTitle: 0 }));
        const run = (...args) => spawnSync(process.execPath, [path.join(scripts, 'lint-seo.mjs'), ...args], { encoding: 'utf8', timeout: 10_000, env: { ...process.env, SEO_LINT_ENFORCE: '1', SEO_STRICT_DESCRIPTIONS: '' } });
        const warnedOnly = spawnSync(process.execPath, [path.join(scripts, 'lint-seo.mjs')], { encoding: 'utf8', timeout: 10_000, env: { ...process.env, SEO_LINT_ENFORCE: '', SEO_STRICT_DESCRIPTIONS: '' } });
        assert.equal(warnedOnly.status, 0, warnedOnly.stderr);
        const failed = run();
        assert.equal(failed.status, 1, failed.stderr);
        assert.match(failed.stdout, /::error title=SEO lint::2 pages with duplicate browser titles/);
        assert.equal(run('--update-baseline').status, 0);
        assert.deepEqual(JSON.parse(await readFile(baseline, 'utf8')), { missingDescription: 2, duplicateTitle: 2 });
        const atBaseline = run();
        assert.equal(atBaseline.status, 0, atBaseline.stderr);
        assert.match(atBaseline.stdout, /::warning title=SEO lint::2 pages with duplicate browser titles/);
        await writeFile(baseline, JSON.stringify({ missingDescription: 0, duplicateTitle: 3 }));
        const belowBaseline = run();
        assert.equal(belowBaseline.status, 0, belowBaseline.stderr);
        assert.match(belowBaseline.stdout, /Lower duplicateTitle/);
        assert.match(belowBaseline.stdout, /SEO descriptions: chronicle: pages=2 short=2 long=0 duplicates=2/);
        const strictDescriptions = spawnSync(process.execPath, [path.join(scripts, 'lint-seo.mjs')], {
            encoding: 'utf8', timeout: 10_000, env: { ...process.env, SEO_LINT_ENFORCE: '', SEO_STRICT_DESCRIPTIONS: '1' },
        });
        assert.equal(strictDescriptions.status, 1, strictDescriptions.stderr);
        assert.match(strictDescriptions.stdout, /::error title=SEO lint::2 published pages have descriptions outside 120-160 characters/);
        assert.match(strictDescriptions.stdout, /::error title=SEO lint::2 published pages share a description/);
    });
});
