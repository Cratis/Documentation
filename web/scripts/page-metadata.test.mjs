// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contextualTitle, deriveDescription, pageDescription, serializeStructuredData, shortenDescription, structuredData } from './page-metadata.mjs';

describe('page descriptions', () => {
    it('uses the first prose paragraph and collapses whitespace', () => {
        assert.equal(deriveDescription('# Heading\n\nFirst line\nwith   spaces.\n\nSecond paragraph.'), 'First line with spaces.');
    });

    it('strips formatting, link destinations, images and HTML tags', () => {
        assert.equal(deriveDescription('**Chronicle** stores *events* with [Cratis](https://cratis.no). ![image](image.png) `code` <em>Prose</em>.'), 'Chronicle stores events with Cratis. code Prose.');
    });

    it('keeps inline code as plain text in Markdown and MDX descriptions', () => {
        for (const source of ['page.md', 'page.mdx']) {
            assert.equal(deriveDescription('A layout has a `direction` and a `gap` — both control arrangement.', source), 'A layout has a direction and a gap — both control arrangement.');
        }
    });

    it('ignores code blocks, headings, tables, lists, comments and blockquotes', () => {
        assert.equal(deriveDescription('<!-- Copyright -->\n\n# Title\n\n```cs\nNot prose\n```\n\n    Indented code\n\n> [!NOTE]\n> Not prose\n\n- Not prose\n\n| A | B |\n| - | - |\n| C | D |\n\nReal prose.'), 'Real prose.');
    });

    it('ignores nested directive admonitions', () => {
        assert.equal(deriveDescription(':::note\nNot prose.\n\n:::tip\nNested note.\n:::\n\nStill a note.\n:::\n\nReal prose.'), 'Real prose.');
    });

    it('ignores MDX imports, components, attributes and expressions', () => {
        const body = 'import { Card } from "example";\n\n{/* comment */}\n\n<Card title="Not prose">Not prose.</Card>\n\n{someExpression}\n\nReal **MDX** prose {value}.';
        assert.equal(deriveDescription(body, 'page.mdx'), 'Real MDX prose .');
    });

    it('skips image-only paragraphs and HTML blocks', () => {
        assert.equal(deriveDescription('![Logo](logo.svg)\n\n<div>Not prose.</div>\n\nReal prose.'), 'Real prose.');
    });

    it('decodes entities without exposing HTML', () => {
        assert.equal(deriveDescription('Commands &amp; queries use &lt;T&gt;.'), 'Commands & queries use <T>.');
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
        assert.equal(pageDescription({ title: 'Configuration' }, '', 'page.md', 'chronicle/configuration'), 'Configuration documentation for Chronicle.');
    });
});

describe('page metadata', () => {
    it('contextualizes generic titles without changing specific titles', () => {
        assert.equal(contextualTitle('Glossary', 'arc/glossary'), 'Glossary – Arc | Cratis');
        assert.equal(contextualTitle('Getting started', 'fundamentals/go/getting-started'), 'Getting started – Fundamentals | Cratis');
        assert.equal(contextualTitle('Overview', 'cli'), 'Overview – CLI | Cratis');
        assert.equal(contextualTitle('Glossary', 'glossary'), 'Glossary – Cratis Stack | Cratis');
        assert.equal(contextualTitle('Store events', 'chronicle/events'), undefined);
    });

    it('uses the nearest meaningful parent and retains product context', () => {
        assert.equal(contextualTitle('Configuration', 'chronicle/hosting/configuration', ['Chronicle', 'Kernel']), 'Configuration – Kernel – Chronicle | Cratis');
        assert.equal(contextualTitle('Events', 'chronicle/projections/events', ['Chronicle', 'Projections']), 'Events – Projections – Chronicle | Cratis');
        assert.equal(contextualTitle('Concepts', 'arc/backend/kotlin/concepts', ['Arc', 'Backend', 'Kotlin and Java', 'Overview']), 'Concepts – Kotlin and Java – Arc | Cratis');
    });

    it('falls back to the product when parents are generic or missing', () => {
        assert.equal(contextualTitle('Configuration', 'chronicle/configuration', ['Overview', 'Reference']), 'Configuration – Chronicle | Cratis');
        assert.equal(contextualTitle('Events', 'chronicle/events', ['Chronicle']), 'Events – Chronicle | Cratis');
    });

    it('contextualizes other repeated titles without repeating the current title', () => {
        assert.equal(contextualTitle('Identity', 'arc/backend/typescript/identity', ['Arc', 'TypeScript'], true), 'Identity – TypeScript – Arc | Cratis');
        assert.equal(contextualTitle('Chronicle', 'cli/chronicle', ['CLI'], true), 'Chronicle – CLI | Cratis');
        assert.equal(contextualTitle('Events', 'chronicle/events/overview', ['Chronicle', 'Events']), 'Events – Chronicle | Cratis');
    });

    it('publishes organization and website data on home', () => {
        const data = structuredData({ home: true, description: 'Docs.' });
        assert.deepEqual(data['@graph'].map(item => item['@type']), ['Organization', 'WebSite']);
        assert.equal(data['@graph'][1].publisher['@id'], data['@graph'][0]['@id']);
    });

    it('publishes article and ordered breadcrumbs on content pages', () => {
        const data = structuredData({ home: false, title: 'Glossary', description: 'Terms.', url: 'https://www.cratis.io/arc/glossary/', breadcrumbs: [
            { name: 'Home', url: 'https://www.cratis.io/' },
            { name: 'Glossary', url: 'https://www.cratis.io/arc/glossary/' },
        ] });
        assert.deepEqual(data['@graph'].map(item => item['@type']), ['TechArticle', 'BreadcrumbList']);
        assert.equal(data['@graph'][0].inLanguage, 'en');
        assert.equal(data['@graph'][0].publisher.name, 'Cratis');
        assert.deepEqual(data['@graph'][1].itemListElement.map(item => item.position), [1, 2]);
    });

    it('escapes script termination without changing JSON values', () => {
        const data = { headline: '</script><script>alert(1)</script>' };
        const serialized = serializeStructuredData(data);
        assert.ok(!serialized.includes('<'));
        assert.deepEqual(JSON.parse(serialized), data);
    });
});
