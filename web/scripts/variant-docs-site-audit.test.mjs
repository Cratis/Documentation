// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { globToRegExp, loadVariantDocsConfig } from './variant-docs-config.mjs';
import { auditSitePages, compareFenceBaseline } from './variant-docs-site-audit.mjs';

const config = await loadVariantDocsConfig();
const arcBackend = config.getAxis('arc', 'backend');

const csharp = (code = 'var value = 1;') => `\`\`\`csharp\n${code}\n\`\`\`\n`;
const tsx = '```tsx\nexport const Page = () => <div />;\n```\n';

async function fixture(context, pages, snippets = {}) {
    const root = await mkdtemp(path.join(tmpdir(), 'site-audit-'));
    context.after(() => rm(root, { recursive: true, force: true }));
    const write = async (file, body) => {
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, body);
    };
    for (const [page, body] of Object.entries(pages)) await write(path.join(root, 'docs', page), body);
    for (const [snippet, body] of Object.entries(snippets)) await write(path.join(root, 'snippets', `${snippet}.mdx`), body);
    return root;
}

// The real Arc backend ratchet, with a snippet root the test owns.
function testAxis(root) {
    return {
        ...arcBackend,
        variants: [{ key: 'csharp', label: 'C#', snippetRoot: path.join(root, 'snippets') }],
    };
}

function sitePages(root, { exclude = [], exemptFences = [], include = ['**'] } = {}) {
    return {
        root: path.join(root, 'docs'),
        groups: [{ label: 'site', scope: 'arc/backend', axis: testAxis(root), include, matchers: include.map(globToRegExp) }],
        exclude,
        exemptFences,
    };
}

const audit = (root, options, generatedRoutes = []) =>
    auditSitePages({ sitePages: sitePages(root, options), axes: [testAxis(root)], generatedRoutes });

test('the manifest audits site pages against the Arc backend axis, whose ratchet leaves TypeScript alone', () => {
    assert.ok(config.sitePages, 'variant-docs.yml must configure sitePages');
    assert.ok(config.sitePages.groups.length > 0);
    assert.ok(config.sitePages.groups.every((group) => group.scope === 'arc/backend'));
    assert.deepEqual(arcBackend.ratchetLanguages.map((language) => language.name).sort(), ['csharp', 'java', 'kotlin']);
    assert.ok(config.sitePages.exemptFences.every((entry) => entry.reason));
    assert.ok(config.sitePages.exclude.every((entry) => entry.reason));
});

test('a new direct csharp fence on a site page fails against the baseline', async (context) => {
    const root = await fixture(context, { 'guide.mdx': `# Guide\n\n${csharp()}` });
    const result = await audit(root);
    assert.deepEqual(result.problems, []);
    assert.deepEqual(result.current['arc/backend'], { 'guide.mdx': { csharp: 1 } });
    assert.deepEqual(compareFenceBaseline(result.current['arc/backend'], {}),
        ['guide.mdx: csharp fences increased from 0 to 1']);
});

test('a rising count fails and a falling count passes', async (context) => {
    const root = await fixture(context, { 'guide.mdx': `${csharp()}\n${csharp('var other = 2;')}` });
    const current = (await audit(root)).current['arc/backend'];
    assert.equal(compareFenceBaseline(current, { 'guide.mdx': { csharp: 1 } }).length, 1);
    assert.deepEqual(compareFenceBaseline(current, { 'guide.mdx': { csharp: 2 } }), []);
    assert.deepEqual(compareFenceBaseline(current, { 'guide.mdx': { csharp: 5 } }), []);
});

test('frontend TSX is not counted on the Arc backend axis', async (context) => {
    const root = await fixture(context, { 'guide.mdx': `${tsx}\n\`\`\`ts\nconst a = 1;\n\`\`\`\n` });
    const result = await audit(root);
    assert.deepEqual(result.current['arc/backend'], {});
    assert.equal(result.auditedPages, 1);
});

test('an excluded page does not count, and a stale exclusion fails', async (context) => {
    const root = await fixture(context, { 'dotnet.mdx': csharp(), 'other.mdx': 'Text.\n' });
    const exclude = [
        { page: 'dotnet.mdx', reason: '.NET by design' },
        { page: 'gone.mdx', reason: 'removed' },
    ];
    const result = await audit(root, { exclude });
    assert.deepEqual(result.current['arc/backend'], {});
    assert.equal(result.excludedPages, 1);
    assert.deepEqual(result.problems, ['sitePages.exclude: gone.mdx does not exist; remove the stale exclusion']);
});

test('an exempted fence does not count, but the rest of the page still does', async (context) => {
    const root = await fixture(context, {
        'stack.mdx': `${csharp('var builder = DistributedApplication.CreateBuilder(args);')}\n${csharp()}`,
    });
    const exemptFences = [{ page: 'stack.mdx', language: 'csharp', contains: 'DistributedApplication.CreateBuilder', reason: 'Aspire' }];
    const result = await audit(root, { exemptFences });
    assert.deepEqual(result.problems, []);
    assert.equal(result.exemptedFences, 1);
    assert.deepEqual(result.current['arc/backend'], { 'stack.mdx': { csharp: 1 } });
});

test('an exemption that matches no fence, or several, fails', async (context) => {
    const root = await fixture(context, { 'stack.mdx': `${csharp('Aspire.A();')}\n${csharp('Aspire.B();')}` });
    const stale = await audit(root, { exemptFences: [{ page: 'stack.mdx', language: 'csharp', contains: 'Nothing', reason: 'r' }] });
    assert.match(stale.problems.join('\n'), /no counted csharp fence containing "Nothing"/);
    const ambiguous = await audit(root, { exemptFences: [{ page: 'stack.mdx', language: 'csharp', contains: 'Aspire', reason: 'r' }] });
    assert.match(ambiguous.problems.join('\n'), /has 2 csharp fences containing "Aspire"/);
    assert.deepEqual(ambiguous.current['arc/backend'], { 'stack.mdx': { csharp: 2 } });
});

test('a page matched by no group and not excluded fails', async (context) => {
    const root = await fixture(context, { 'scenarios/a.md': csharp(), 'new-page.mdx': csharp() });
    const result = await audit(root, { include: ['scenarios/**'] });
    assert.deepEqual(result.problems,
        ['new-page.mdx: matched by no sitePages group and not excluded; audit it or exclude it with a reason']);
    assert.deepEqual(result.current['arc/backend'], { 'scenarios/a.md': { csharp: 1 } });
});

test('folders the content sync regenerates are product pages, not site pages', async (context) => {
    const root = await fixture(context, {
        'arc/commands.md': csharp(),
        'eventmodelers-ai/csharp/index.md': csharp(),
        'eventmodelers-ai.mdx': 'Site page.\n',
    });
    const result = await audit(root, {}, ['arc', 'eventmodelers-ai/csharp']);
    assert.equal(result.pageCount, 1);
    assert.deepEqual(result.current['arc/backend'], {});
});

test('a site-page macro must name a snippet some variant provides', async (context) => {
    const root = await fixture(context, {
        'guide.mdx': [
            '<ArcBackendTabs snippet="present" />',
            '',
            '<ArcBackendTabs snippet="missing" />',
            '',
            '```mdx',
            '<ArcBackendTabs snippet="inside-code" />',
            '```',
            '',
        ].join('\n'),
    }, { present: '```csharp\nvar a = 1;\n```\n' });
    const result = await audit(root);
    assert.deepEqual(result.problems, ['guide.mdx: no backend has a snippet for "missing"']);
    assert.deepEqual(result.placeholders.map((entry) => [entry.snippet, entry.variants]),
        [['present', ['csharp']], ['missing', []]]);
});

test('an excluded page still has its tab macros checked', async (context) => {
    const root = await fixture(context, { 'dotnet.mdx': csharp() + '\n<ArcBackendTabs snippet="missing" />\n' });
    const result = await audit(root, { exclude: [{ page: 'dotnet.mdx', reason: '.NET by design' }] });
    assert.deepEqual(result.current['arc/backend'], {});
    assert.deepEqual(result.problems, ['dotnet.mdx: no backend has a snippet for "missing"']);
});

test('every Markdown extension Starlight renders is a site page', async (context) => {
    const root = await fixture(context, { 'legacy.markdown': csharp() });
    const result = await audit(root);
    assert.deepEqual(result.current['arc/backend'], { 'legacy.markdown': { csharp: 1 } });
});
