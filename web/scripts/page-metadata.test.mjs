// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { RELEASE_DIGEST_INDEX_DESCRIPTION, apiPageDescription, contextualTitle, deriveDescription, glossaryTerms, hubTitle, markdownMirrorHref, pageLanguage, hasDuplicateTitle, normalizedPageKey, pageDescription, releaseDigestDescription, releaseDigestIndex, serializeStructuredData, shortenDescription, structuredData } from './page-metadata.mjs';

const prose = 'Chronicle stores events and builds read models for your application.';

function assertDescriptionLength(description) {
    const length = Array.from(description).length;
    assert.ok(length >= 120 && length <= 160, `Description length: ${length}`);
}

describe('generated release digest descriptions', () => {
    it('includes product headings and the full date range', () => {
        const range = 'December 28, 2026 - January 4, 2027';
        const raw = '# Release digest\n\n## **Chronicle** v19.0.0\n\n### Added\n\n## Arc\n\n## Arc\n\n### Fixed\n';
        const description = releaseDigestDescription(range, raw);
        assert.ok(description.startsWith(`Cratis releases for ${range}: Chronicle, Arc.`));
        assertDescriptionLength(description);
    });

    it('identifies released repositories, not incidental mentions or code examples', () => {
        const raw = `## Added

- **Chronicle** ([Release v19](https://github.com/Cratis/Chronicle/releases/tag/v19)): Added observers.
- **Chronicle** ([Release v20](https://github.com/Cratis/Chronicle/releases/tag/v20)): Fixed observers.
- **Arc** ([Release v22](https://github.com/Cratis/Arc/releases/tag/v22)): Updated commands.
- [Unreleased](https://github.com/Cratis/Unreleased/issues/1)

\`\`\`md
## Example
[Sample](https://github.com/Cratis/Sample/releases/tag/v1)
\`\`\`
`;
        const description = releaseDigestDescription('May 18 - 25, 2026', raw);
        assert.match(description, /: Chronicle, Arc\./);
        assert.doesNotMatch(description, /Unreleased|Example|Sample|Added/);
    });

    it('pads short inputs and respects inclusive length boundaries', () => {
        const range = 'May 18 - 25, 2026';
        const prefix = `Cratis releases for ${range}: `;
        for (const length of [119, 120, 159, 160, 161]) {
            const product = 'X'.repeat(length - prefix.length - 1);
            const description = releaseDigestDescription(range, `## ${product}`);
            assertDescriptionLength(description);
            if (length >= 120 && length <= 160) {
                assert.equal(description, `${prefix}${product}.`);
                assert.doesNotMatch(description, /Weekly changes/);
            } else {
                assert.match(description, /Weekly changes/);
            }
            if (length === 161) assert.doesNotMatch(description, /X/); // Never cut a product mid-word.
        }
    });

    it('handles empty and very short content without invented products', () => {
        for (const raw of ['', '## Added\n\nNothing released.', '## A', '## JasperFX\n\n## JasperFX.Tools']) {
            const description = releaseDigestDescription('May 18 - 25, 2026', raw);
            assertDescriptionLength(description);
            assert.match(description, /Weekly changes/);
            assert.doesNotMatch(description, /Added|Nothing|JasperFX|Learn how to|This page/i);
            assert.equal(description, releaseDigestDescription('May 18 - 25, 2026', raw));
        }
    });

    it('truncates long inputs at word boundaries and counts Unicode characters', () => {
        const product = `Chronicle ${'extended '.repeat(40).trim()}`;
        const description = releaseDigestDescription('May 18 - 25, 2026', `## ${product}`);
        assertDescriptionLength(description);
        assert.match(description, /Chronicle(?: extended)+…$/);
        assert.doesNotMatch(description, /Weekly changes/);

        const range = 'May 18 - 25, 2026';
        const prefix = `Cratis releases for ${range}: `;
        const unicodeProduct = '𐐀'.repeat(159 - prefix.length - 1);
        assert.equal(releaseDigestDescription(range, `## ${unicodeProduct}`), `${prefix}${unicodeProduct}.`);
    });

    it('gives the generated index its own description and preserves the supplied week order', () => {
        const index = releaseDigestIndex([
            { slug: '2026-05-25-to-2026-06-01', label: 'May 25 - June 1, 2026 · Week 22' },
            { slug: '2026-05-18-to-2026-05-25', label: 'May 18 - 25, 2026 · Week 21' },
        ]);
        assert.ok(index.startsWith(`---\ntitle: Release digests\ndescription: ${JSON.stringify(RELEASE_DIGEST_INDEX_DESCRIPTION)}\n`));
        assert.match(index, /\[May 25 - June 1, 2026 · Week 22\]\(\/release-digests\/2026-05-25-to-2026-06-01\/\)/);
        assert.ok(index.indexOf('Week 22') < index.indexOf('Week 21'));
        assert.ok(index.endsWith('\n'));
    });

    it('stays unique across weeks, years and the index even with identical long content', () => {
        const ranges = ['May 18 - 25, 2026', 'May 25 - June 1, 2026', 'May 18 - 25, 2027'];
        const raw = `## Chronicle ${'extended '.repeat(40)}`;
        const descriptions = ranges.map((range) => releaseDigestDescription(range, raw));
        assert.equal(new Set(descriptions).size, ranges.length);
        ranges.forEach((range, index) => assert.ok(descriptions[index].includes(range)));
        assertDescriptionLength(RELEASE_DIGEST_INDEX_DESCRIPTION);
        assert.ok(!descriptions.includes(RELEASE_DIGEST_INDEX_DESCRIPTION));
    });
});

describe('generated API descriptions', () => {
    it('bounds short, long, empty and Unicode names without splitting words', () => {
        for (const name of ['', 'A', 'Chronicle.EventStore', '𐐀'.repeat(200), 'Long '.repeat(80)]) {
            const description = apiPageDescription(name);
            assertDescriptionLength(description);
            assert.doesNotMatch(description, /Learn how to|This page/i);
            assert.equal(description, apiPageDescription(name));
        }
        assert.match(apiPageDescription('Long '.repeat(80)), /(?:Long )+Long…$/);
        assert.doesNotMatch(apiPageDescription('𐐀'.repeat(200)), /𐐀/);
    });

    it('keeps distinct type names and decodes HTML entities before measuring', () => {
        const descriptions = ['Foo', 'Bar', 'Foo&lt;T&gt; &amp; Bar'].map(apiPageDescription);
        descriptions.forEach(assertDescriptionLength);
        assert.equal(new Set(descriptions).size, descriptions.length);
        assert.match(descriptions[2], /^API reference for Foo<T> & Bar\./);
        assert.doesNotMatch(apiPageDescription('JasperFX.Logging'), /jasperfx/i);
    });
});

describe('page descriptions', () => {
    it('uses the first prose paragraph and collapses whitespace', () => {
        assert.equal(deriveDescription('# Heading\n\nChronicle stores events\nand   builds read models for your application.\n\nSecond paragraph.'), prose);
    });

    it('strips formatting, link destinations, images and HTML tags', () => {
        assert.equal(deriveDescription('**Chronicle** stores *events* with [Cratis](https://cratis.no) and builds read models for your application. ![image](image.png) `code` <em>Prose</em>.'), 'Chronicle stores events with Cratis and builds read models for your application. code Prose.');
    });

    it('keeps inline code as plain text in Markdown and MDX descriptions', () => {
        for (const source of ['page.md', 'page.mdx']) {
            assert.equal(deriveDescription('A layout has a `direction` and a `gap` — both control arrangement.', source), 'A layout has a direction and a gap — both control arrangement.');
        }
    });

    it('ignores code blocks, headings, tables, lists, comments and blockquotes', () => {
        assert.equal(deriveDescription('<!-- Copyright -->\n\n# Title\n\n```cs\nNot prose\n```\n\n    Indented code\n\n> [!NOTE]\n> Not prose\n\n- Not prose\n\n| A | B |\n| - | - |\n| C | D |\n\n' + prose), prose);
    });

    it('ignores nested directive admonitions', () => {
        assert.equal(deriveDescription(':::note\nNot prose.\n\n:::tip\nNested note.\n:::\n\nStill a note.\n:::\n\n' + prose), prose);
    });

    it('ignores MDX imports, components, attributes and expressions', () => {
        const body = 'import { Card } from "example";\n\n{/* comment */}\n\n<Card title="Not prose">Not prose.</Card>\n\n{someExpression}\n\nReal **MDX** prose explains how Chronicle stores events for your application {value}.';
        assert.equal(deriveDescription(body, 'page.mdx'), 'Real MDX prose explains how Chronicle stores events for your application .');
    });

    it('skips image-only paragraphs and HTML blocks', () => {
        assert.equal(deriveDescription('![Logo](logo.svg)\n\n<div>Not prose.</div>\n\n' + prose), prose);
    });

    it('decodes entities without exposing HTML', () => {
        assert.equal(deriveDescription('Commands &amp; queries use &lt;T&gt; to represent data flowing through your application.'), 'Commands & queries use <T> to represent data flowing through your application.');
    });

    it('skips lead-ins to lists, tables and code even when long enough', () => {
        for (const leadIn of [
            'You can configure Chronicle using these settings for your application:',
            'The following settings control how Chronicle stores events for your application.',
            'This example demonstrates the following configuration options for your application.',
        ]) {
            for (const block of ['- Option one\n- Option two', '| Key | Value |\n| --- | --- |\n| a | b |', '```cs\nvar value = 1;\n```']) {
                assert.equal(deriveDescription(`${leadIn}\n\n${block}\n\n${prose}`), prose);
                assert.equal(deriveDescription(`${leadIn}\n\n${block}`), undefined);
            }
        }
    });

    it('requires substantial prose instead of labels, badges, versions or navigation', () => {
        for (const fragment of [
            'Note', 'Tip', 'TODO', 'Chronicle', 'v1.2.3', 'Version 1.2.3',
            '![Chronicle stores events and builds read models for your application](image.png)',
            '[![Build status](badge.svg)](https://example.com/build)',
            '[Chronicle stores events and builds read models for your application](https://example.com)',
            '[Chronicle stores events and builds read models for your application][docs]\n\n[docs]: https://example.com',
            'See [Chronicle stores events and builds read models for your application](https://example.com).',
            'Architecture configuration synchronization serialization implementation.',
            'This is a very short prose sentence.',
        ]) {
            assert.equal(deriveDescription(fragment), undefined, fragment);
            assert.equal(deriveDescription(`${fragment}\n\n${prose}`), prose, fragment);
            assert.equal(pageDescription({ title: 'Overview' }, fragment, 'page.md', 'arc'), 'Overview in the Arc documentation for Cratis.');
        }
    });

    it('accepts prose at the minimum word and character boundaries', () => {
        const text = 'Chronicle stores events and supports your application architecture.';
        assert.equal(text.split(' ').length, 8);
        assert.equal(deriveDescription(text), text);
        assert.equal(deriveDescription('Some app can use new data for all.'), undefined);
    });

    it('truncates at a word boundary with an ellipsis within 155 characters', () => {
        const body = 'Chronicle stores events and builds read models. '.repeat(6);
        const description = deriveDescription(body);
        assert.ok(description.length <= 155);
        assert.ok(description.endsWith('…'));
        assert.ok(body.startsWith(description.slice(0, -1)));
        assert.equal(body[description.length - 1], ' ');
        assert.equal(shortenDescription('a'.repeat(156)), '…');
        assert.equal(shortenDescription('a'.repeat(155)), 'a'.repeat(155));
    });

    it('preserves explicit descriptions, including long descriptions', () => {
        const description = 'Explicit description. '.repeat(12);
        assert.equal(pageDescription({ title: 'Overview', description }, 'Derived prose.', 'page.md', 'arc'), description);
        assert.equal(pageDescription({ title: 'Overview', description: '' }, 'Derived prose.', 'page.md', 'arc'), '');
    });

    it('provides a title and section fallback for pages without prose', () => {
        assert.equal(deriveDescription('# Title\n\n```cs\ncode\n```'), undefined);
        assert.equal(pageDescription({ title: 'Configuration' }, '', 'page.md', 'chronicle/configuration'), 'Configuration in the Chronicle documentation for Cratis.');
    });
});

describe('page metadata', () => {
    it('contextualizes generic titles without changing specific titles', () => {
        assert.equal(contextualTitle('Glossary', 'arc/glossary'), 'Glossary – Arc | Cratis');
        assert.equal(contextualTitle('Getting started', 'fundamentals/go/getting-started'), 'Getting started (Go) – Fundamentals | Cratis');
        assert.equal(contextualTitle('Overview', 'cli'), 'Overview – CLI | Cratis');
        assert.equal(contextualTitle('Glossary', 'glossary'), 'Glossary – Cratis Platform | Cratis');
        assert.equal(contextualTitle('Store events', 'chronicle/events'), undefined);
        assert.equal(contextualTitle('Projections', 'chronicle/projections'), 'Projections – Chronicle | Cratis');
        assert.equal(contextualTitle('Observers', 'arc/observers'), 'Observers – Arc | Cratis');
    });

    it('names the language so variant pages do not share a title', () => {
        const parents = ['Arc', 'Backend', 'Commands'];
        const csharp = contextualTitle('Command pipeline', 'arc/backend/csharp/commands/command-pipeline', parents, true);
        const typescript = contextualTitle('Command pipeline', 'arc/backend/typescript/commands/command-pipeline', parents, true);
        assert.equal(csharp, 'Command pipeline (C#) – Commands – Arc | Cratis');
        assert.equal(typescript, 'Command pipeline (TypeScript) – Commands – Arc | Cratis');
        assert.equal(contextualTitle('Backend', 'arc/backend/csharp', ['Arc', 'Backend'], true), 'Backend (C#) – Arc | Cratis');
        assert.equal(contextualTitle('Backend', 'arc/backend', ['Arc'], true), 'Backend – Arc | Cratis');
        assert.equal(pageLanguage('chronicle/events'), undefined);
        assert.equal(pageLanguage('fundamentals/go/concepts'), 'Go');
        assert.equal(contextualTitle('Run a command', 'arc/backend/typescript/run', parents), 'Run a command (TypeScript) – Commands – Arc | Cratis');
        assert.equal(contextualTitle('Overview', 'arc/backend/java/overview', ['Arc', 'Kotlin and Java']), 'Overview (Java) – Kotlin and Java – Arc | Cratis');
    });

    it('gives the home page and product hubs descriptive titles', () => {
        assert.equal(hubTitle(''), 'Cratis Platform: event sourcing and CQRS');
        assert.equal(hubTitle('/chronicle/'), 'Chronicle: event store with multi-language clients | Cratis');
        assert.equal(contextualTitle('Overview', 'cli'), 'Overview – CLI | Cratis');
        assert.match(hubTitle('screenplay'), /^Cratis Screenplay /);
        assert.match(hubTitle('stage'), /^Cratis Stage: /);
        assert.equal(hubTitle('chronicle/events'), undefined);
    });

    it('keeps every hub title within 60 characters', () => {
        for (const id of ['chronicle', 'arc', 'components', 'cli', 'authproxy', 'chronicle-mcp', 'prompter', 'templates', 'direct', 'choreography', 'screenplay', 'stage', 'fundamentals', 'prologue', 'architecture', 'ai', '']) {
            assert.ok(hubTitle(id).length <= 60, hubTitle(id));
        }
    });

    it('links the Markdown mirror path that emitDocArtifacts writes', async () => {
        const { mkdtemp, mkdir, writeFile, access, rm } = await import('node:fs/promises');
        const { tmpdir } = await import('node:os');
        const path = await import('node:path');
        const { emitDocArtifacts } = await import('./emit-doc-artifacts.mjs');
        const docs = await mkdtemp(path.join(tmpdir(), 'docs-'));
        const dist = await mkdtemp(path.join(tmpdir(), 'dist-'));
        await mkdir(path.join(docs, 'arc', 'guide'), { recursive: true });
        await writeFile(path.join(docs, 'index.md'), '---\ntitle: Home\n---\nHome\n');
        await writeFile(path.join(docs, 'arc', 'index.md'), '---\ntitle: Arc\n---\nArc\n');
        await writeFile(path.join(docs, 'arc', 'guide', 'page.md'), '---\ntitle: P\n---\nP\n');
        await emitDocArtifacts(docs, dist, { axes: [] });
        try {
            for (const route of ['/', '/arc/', '/arc/guide/page/']) {
                const href = markdownMirrorHref(`https://www.cratis.io${route}`);
                await access(path.join(dist, new URL(href).pathname));
            }
        } finally {
            await rm(docs, { recursive: true, force: true });
            await rm(dist, { recursive: true, force: true });
        }
        assert.equal(markdownMirrorHref('https://www.cratis.io/arc/guide/page/'), 'https://www.cratis.io/arc/guide/page.md');
    });

    it('emits glossary entries as DefinedTerm members', () => {
        const body = '## Event sourcing\n\n| Term | Definition |\n| --- | --- |\n| [Event](/chronicle/concepts/event/) | A **fact** that happened. |\n| **Tenant** | An isolated set of data. |\n\n## CQRS & more\n\n| **Query** | Reads state. |\n';
        const terms = glossaryTerms(body, 'https://www.cratis.io/glossary/');
        assert.deepEqual(terms.map((term) => term.name), ['Event', 'Tenant', 'Query']);
        assert.equal(terms[0].url, 'https://www.cratis.io/chronicle/concepts/event/');
        assert.equal(terms[0].description, 'A fact that happened.');
        assert.equal(terms[1].url, 'https://www.cratis.io/glossary/#event-sourcing');
        assert.equal(terms[2].url, 'https://www.cratis.io/glossary/#cqrs--more');
        assert.equal(terms[1].inDefinedTermSet, 'https://www.cratis.io/glossary/');
        const data = structuredData({ title: 'Glossary', description: 'd', url: 'https://www.cratis.io/glossary/', breadcrumbs: [], kind: 'glossary', terms });
        assert.equal(data['@graph'][0].hasDefinedTerm.length, 3);
    });

    it('uses the nearest meaningful parent and retains product context', () => {
        assert.equal(contextualTitle('Configuration', 'chronicle/hosting/configuration', ['Chronicle', 'Kernel']), 'Configuration – Kernel – Chronicle | Cratis');
        assert.equal(contextualTitle('Events', 'chronicle/projections/events', ['Chronicle', 'Projections']), 'Events – Projections – Chronicle | Cratis');
        assert.equal(contextualTitle('Concepts', 'arc/backend/kotlin/concepts', ['Arc', 'Backend', 'Kotlin and Java', 'Overview']), 'Concepts (Kotlin) – Kotlin and Java – Arc | Cratis');
    });

    it('falls back to the product when parents are generic or missing', () => {
        assert.equal(contextualTitle('Configuration', 'chronicle/configuration', ['Overview', 'Reference']), 'Configuration – Chronicle | Cratis');
        assert.equal(contextualTitle('Events', 'chronicle/events', ['Chronicle']), 'Events – Chronicle | Cratis');
    });

    it('contextualizes other repeated titles without repeating the current title', () => {
        assert.equal(contextualTitle('Identity', 'arc/backend/typescript/identity', ['Arc', 'TypeScript'], true), 'Identity (TypeScript) – Arc | Cratis');
        assert.equal(contextualTitle('Chronicle', 'cli/chronicle', ['CLI'], true), 'Chronicle – CLI | Cratis');
        assert.equal(contextualTitle('Events', 'chronicle/events/overview', ['Chronicle', 'Events']), 'Events – Chronicle | Cratis');
    });

    it('normalizes extension, case and index differences for page identity', () => {
        assert.equal(normalizedPageKey({ id: 'Chronicle/Configuration.MDX' }), normalizedPageKey({ id: 'chronicle/configuration' }));
        assert.equal(normalizedPageKey({ id: 'Arc/Index.md' }), normalizedPageKey({ id: 'arc/' }));
        assert.equal(normalizedPageKey({ id: 'index' }), normalizedPageKey({ id: '' }));
    });

    it('does not mistake a different route ID or slug for another page', () => {
        const page = { id: 'Arc/Read Models.md', filePath: 'src/content/docs/Arc/Read Models.md', data: { title: 'Read Models' } };
        const route = { ...page, id: 'arc/read-models', filePath: 'src/content/docs/arc/read models.MD' };
        assert.equal(hasDuplicateTitle(route, [page]), false);
        assert.equal(contextualTitle(route.data.title, route.id, [], hasDuplicateTitle(route, [page])), undefined);
        assert.equal(hasDuplicateTitle({ id: '', data: { title: 'Welcome' } }, [{ id: 'index', data: { title: 'Welcome' } }]), false);
    });

    it('detects true duplicates using identical normalized keys', () => {
        const page = { id: 'Arc/Configuration.MD', data: { title: 'Configuration' } };
        const route = { ...page, id: 'arc/configuration' };
        assert.equal(hasDuplicateTitle(route, [page]), false);
        const pages = [page, { id: 'chronicle/configuration', data: { title: ' configuration ' } }];
        assert.equal(hasDuplicateTitle(route, pages), true);
        assert.equal(contextualTitle('Configuration', route.id, [], hasDuplicateTitle(route, pages)), 'Configuration – Arc | Cratis');
        assert.equal(hasDuplicateTitle(route, [page, { id: 'arc/other', data: { title: 'Other' } }]), false);
    });

    it('publishes organization and website data on home', () => {
        const data = structuredData({ home: true, description: 'Docs.' });
        assert.deepEqual(data['@graph'].map(item => item['@type']), ['Organization', 'WebSite']);
        assert.equal(data['@graph'][1].publisher['@id'], data['@graph'][0]['@id']);
        assert.deepEqual(data['@graph'][0].sameAs, [
            'https://www.linkedin.com/company/cratis-stack',
            'https://www.youtube.com/@CratisStack',
        ]);
    });

    it('publishes article and ordered breadcrumbs on content pages', () => {
        const data = structuredData({ home: false, title: 'Glossary', description: 'Terms.', url: 'https://www.cratis.io/arc/glossary/', breadcrumbs: [
            { name: 'Home', url: 'https://www.cratis.io/' },
            { name: 'Glossary', url: 'https://www.cratis.io/arc/glossary/' },
        ] });
        assert.deepEqual(data['@graph'].map(item => item['@type']), ['TechArticle', 'BreadcrumbList']);
        assert.equal(data['@graph'][0].inLanguage, 'en');
        assert.equal(data['@graph'][0].publisher.name, 'Cratis');
        assert.deepEqual(data['@graph'][0].publisher.sameAs, [
            'https://www.linkedin.com/company/cratis-stack',
            'https://www.youtube.com/@CratisStack',
        ]);
        assert.deepEqual(data['@graph'][1].itemListElement.map(item => item.position), [1, 2]);
    });

    it('does not publish structured data on the 404 page', () => {
        assert.equal(structuredData({ home: false, notFound: true, title: '404' }), undefined);
    });

    it('escapes script termination without changing JSON values', () => {
        const data = { headline: '</script><script>alert(1)</script>' };
        const serialized = serializeStructuredData(data);
        assert.ok(!serialized.includes('<'));
        assert.deepEqual(JSON.parse(serialized), data);
    });
});
