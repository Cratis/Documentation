// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { gfm } from 'micromark-extension-gfm';
import { mdxjs } from 'micromark-extension-mdxjs';

// Ignore directive admonitions, including nested directives, before parsing prose.
function withoutAdmonitions(body) {
    let depth = 0;
    return body.split('\n').map((line) => {
        if (/^\s*:::\S/.test(line)) {
            depth++;
            return '';
        }
        if (/^\s*:::\s*$/.test(line) && depth) {
            depth--;
            return '';
        }
        return depth ? '' : line;
    }).join('\n');
}

function proseText(node, includeLinks = true) {
    if (node.type === 'text' || node.type === 'inlineCode') return node.value;
    if (node.type === 'break') return ' ';
    // Link labels can appear in descriptions, but cannot qualify link-only
    // navigation or badges as prose. Images, JSX and expressions aren't prose.
    if (!includeLinks && ['link', 'linkReference'].includes(node.type)) return ' ';
    if (['paragraph', 'emphasis', 'strong', 'delete', 'link', 'linkReference'].includes(node.type)) {
        return (node.children ?? []).map((child) => proseText(child, includeLinks)).join('');
    }
    return '';
}

function wordLimitedGeneratedDescription(text) {
    if (Array.from(text).length <= 160) return text;
    const words = [];
    let length = 0;
    for (const word of text.split(' ')) {
        const nextLength = length + (words.length ? 1 : 0) + Array.from(word).length;
        if (nextLength > 159) break; // Leave room for the ellipsis.
        words.push(word);
        length = nextLength;
    }
    return words.join(' ').replace(/[.,:;]+$/, '') + '…';
}

/** Bound generator-owned descriptions without changing authored product metadata. */
export function generatedDescription(subject, suffix) {
    const description = wordLimitedGeneratedDescription(subject.replace(/\s+/g, ' ').trim());
    return Array.from(description).length >= 120
        ? description
        : wordLimitedGeneratedDescription(`${description} ${suffix}`);
}

const DIGEST_SECTION_HEADINGS = /^(?:added|changed|fixed|removed|security|deprecated|week in numbers|version movement|summary|releases?|release notes)$/i;
const DIGEST_DESCRIPTION_SUFFIX = 'Weekly changes across the Cratis repositories, with links to release notes and related pull requests.';
export const RELEASE_DIGEST_INDEX_DESCRIPTION = 'Weekly Cratis release digests grouped by date, with product changes, published versions and links to the original release notes and pull requests.';

function markdownText(node) {
    return node.value ?? (node.children ?? []).map(markdownText).join('');
}

export function loadPrivateRepositories(file) {
    try {
        // Match the digest renderer's comment and line-ending handling.
        return new Set(readFileSync(file, 'utf8').split(/\r?\n/)
            .map((line) => line.split('#', 1)[0].trim().toLowerCase()).filter(Boolean));
    } catch {
        // Unknown privacy status must never expose product names.
        return undefined;
    }
}

function releasedProducts(raw, privateRepositories) {
    if (!privateRepositories) return [];
    const tree = fromMarkdown(raw);
    const releases = new Set();
    function visit(node) {
        const match = node.type === 'link' && /^https:\/\/github\.com\/Cratis\/([^/]+)\/releases(?:\/|$)/i.exec(node.url);
        if (match) {
            try {
                releases.add(decodeURIComponent(match[1]));
            } catch {
                // An undecodable repository name has unknown privacy status.
            }
        }
        for (const child of node.children ?? []) visit(child);
    }
    visit(tree);

    // Existing digests group release bullets by change type; also support
    // product headings. Code samples and ordinary prose are not products.
    const headings = tree.children
        .filter((node) => node.type === 'heading' && node.depth > 1)
        .map(markdownText)
        .map((heading) => heading.replace(/\s+(?:[-–—:]\s*)?v?\d+\.\d+.*$/, '').trim())
        .filter((heading) => !DIGEST_SECTION_HEADINGS.test(heading));
    return [...new Set(releases.size ? releases : headings)]
        .filter((product) => product && !/jasperfx/i.test(product))
        .filter((product) => !product.toLowerCase().split(/[^a-z0-9_.-]+/).some((part) => privateRepositories.has(part)));
}

export function releaseDigestDescription(longRange, raw, privateRepositories) {
    const products = releasedProducts(raw, privateRepositories);
    const subject = products.length ? `Cratis releases for ${longRange}: ${products.join(', ')}.` : `Cratis release digest for ${longRange}.`;
    return generatedDescription(subject, DIGEST_DESCRIPTION_SUFFIX);
}

export function releaseDigestIndex(entries, route = 'release-digests') {
    return [
        '---',
        'title: Release digests',
        `description: ${JSON.stringify(RELEASE_DIGEST_INDEX_DESCRIPTION)}`,
        'editUrl: false',
        '---',
        '',
        'Weekly release notes across the Cratis repositories, newest first.',
        '',
        ...entries.map(({ slug, label }) => `- [${label}](/${route}/${slug}/)`),
        '',
    ].join('\n');
}

function apiIdentifier(name) {
    const neutralName = name.split('.').filter((segment) => !/jasperfx/i.test(segment)).join('.') || 'Cratis integration';
    if (neutralName === name && Array.from(name).length <= 64) return name;
    // Keep a recognizable tail plus a stable discriminator, even when distinct
    // namespaces share the same trailing type name. The entire identifier fits
    // before description padding/truncation, so the discriminator cannot be lost.
    const tail = Array.from(neutralName).slice(-48).join('');
    const discriminator = createHash('sha256').update(name).digest('hex').slice(0, 12);
    return `${tail} [${discriminator}]`;
}

export function apiPageDescription(encodedName) {
    const name = markdownText(fromMarkdown(encodedName));
    const subject = `API reference for ${apiIdentifier(name)}.`;
    return generatedDescription(subject, 'Types, members, signatures and related namespaces in the Cratis documentation, with reference details for integrating libraries into applications.');
}

export function shortenDescription(text) {
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 155) return normalized;
    const prefix = normalized.slice(0, 155);
    const boundary = prefix.lastIndexOf(' ');
    // A single overlong token cannot be cut at a word boundary.
    return (boundary > 0 ? prefix.slice(0, boundary).trimEnd() : '') + '…';
}

/** First meaningful top-level prose paragraph, never a heading, list or code block. */
export function deriveDescription(body, sourcePath = 'page.md') {
    const mdx = /\.mdx$/i.test(sourcePath);
    const tree = fromMarkdown(withoutAdmonitions(body), {
        extensions: [gfm(), ...(mdx ? [mdxjs()] : [])],
        mdastExtensions: [gfmFromMarkdown(), ...(mdx ? [mdxFromMarkdown()] : [])],
    });
    for (const node of tree.children) {
        if (node.type !== 'paragraph') continue;
        const text = proseText(node).replace(/\s+/g, ' ').trim();
        // List/table/code introductions do not explain the page on their own.
        if (text.endsWith(':') || /\bthe following\b/i.test(text)) continue;
        const nonLinkText = proseText(node, false).replace(/\s+/g, ' ').trim();
        const words = nonLinkText.match(/\p{L}[\p{L}\p{N}'’\-]*/gu) ?? [];
        if (nonLinkText.length >= 50 && words.length >= 8) return shortenDescription(text);
    }
    return undefined;
}

const sections = {
    chronicle: 'Chronicle', arc: 'Arc', components: 'Components',
    fundamentals: 'Fundamentals', cli: 'CLI', authproxy: 'AuthProxy', showrunner: 'Showrunner',
    screenplay: 'Screenplay', stage: 'Stage', prologue: 'Prologue', templates: 'Templates', direct: 'Direct', choreography: 'Choreography',
    'chronicle-mcp': 'Chronicle MCP', prompter: 'Prompter', ai: 'AI',
    architecture: 'Architecture', contributing: 'Contributing',
    'eventmodelers-ai': 'EventModelers.ai', 'release-digests': 'Release Digests',
};

export function pageSection(id) {
    return sections[id.split('/')[0].toLowerCase()] ?? 'Cratis Platform';
}

const genericTitle = /^(glossary|configuration|overview|introduction|getting[ -]started|index|events|projections|observers|concepts|commands|queries|reference)$/i;
const genericParent = /^(glossary|configuration|overview|introduction|getting[ -]started|index|concepts|reference|guides)$/i;

// Path segments that select one language of an otherwise identical page.
const languageSegments = {
    csharp: 'C#', dotnet: '.NET', typescript: 'TypeScript', kotlin: 'Kotlin',
    java: 'Java', elixir: 'Elixir', python: 'Python', rust: 'Rust', go: 'Go',
};

/** Display name of the language a variant page documents, taken from its route. */
export function pageLanguage(id) {
    for (const segment of id.split('/')) {
        const language = languageSegments[segment.toLowerCase()];
        if (language) return language;
    }
    return undefined;
}

// Hub pages and the home page get a descriptor instead of a bare "<Product> | Cratis".
const titleOverrides = new Map([
    ['', 'Cratis Platform: event sourcing and CQRS'],
    ['chronicle', 'Chronicle: event store with multi-language clients | Cratis'],
    ['arc', 'Arc: CQRS for ASP.NET Core and Spring Boot | Cratis'],
    ['components', 'Components: React UI for CQRS and event sourcing | Cratis'],
    ['cli', 'CLI: operate Chronicle from the command line | Cratis'],
    ['authproxy', 'AuthProxy: .NET gateway for auth and tenancy | Cratis'],
    ['showrunner', 'Showrunner: ready-made product parts for Cratis | Cratis'],
    ['chronicle-mcp', 'Chronicle MCP: connect AI agents to Chronicle | Cratis'],
    ['prompter', 'Prompter: Cratis docs assistant on Discord | Cratis'],
    ['templates', 'Templates: dotnet new templates for Cratis | Cratis'],
    ['direct', 'Direct: control plane for agentic engineering | Cratis'],
    ['choreography', 'Cratis Choreography: jobs, workflows and state machines'],
    ['screenplay', 'Cratis Screenplay modeling language | Cratis'],
    ['stage', 'Cratis Stage: run models and plan application source'],
    ['fundamentals', 'Fundamentals: .NET and TypeScript utilities | Cratis'],
    ['prologue', 'Prologue: event-model discovery | Cratis'],
    ['architecture', 'Architecture: .NET architectural analyzers | Cratis'],
    ['ai', 'Cratis AI: rules and skills for coding agents'],
]);

/** Full `<title>` for the home page and product hubs, or undefined for every other page. */
export function hubTitle(id) {
    return titleOverrides.get(id.replace(/^\/+|\/+$/g, '').toLowerCase());
}

/** Path of the Markdown mirror that emit-doc-artifacts.mjs writes for a canonical page URL. */
export function markdownMirrorHref(pageUrl) {
    const { origin, pathname } = new URL(pageUrl);
    const slug = pathname.replace(/^\/+|\/+$/g, '');
    return `${origin}/${slug || 'index'}.md`;
}

/** Parents are published ancestor page titles, ordered from the product down. */
export function contextualTitle(title, id, parents = [], isDuplicate = false) {
    const language = pageLanguage(id);
    if (!genericTitle.test(title.trim()) && !isDuplicate && !language) return undefined;
    const parent = parents.findLast((name) => !genericParent.test(name.trim())
        && name.trim().toLowerCase() !== title.trim().toLowerCase()
        && name.trim().toLowerCase() !== language?.toLowerCase());
    // Name the selected language even for unique titles and multi-language parents.
    const namedTitle = language ? `${title} (${language})` : title;
    const parts = [namedTitle, parent, pageSection(id)].filter(Boolean);
    const unique = parts.filter((part, index) => parts.findIndex((other) =>
        other.trim().toLowerCase() === part.trim().toLowerCase()) === index);
    return `${unique.join(' – ')} | Cratis`;
}

/** Collection and route entries share filePath even when their IDs are different slugs. */
export function normalizedPageKey(page) {
    return (page.filePath ?? page.id).replace(/\\/g, '/').toLowerCase()
        .replace(/\.(?:md|mdx|markdown|mdown|mkdn|mkd|mdwn|mdoc)$/, '')
        .replace(/^\/+|\/+$/g, '').replace(/(?:^|\/)index$/, '');
}

export function hasDuplicateTitle(entry, pages) {
    const key = normalizedPageKey(entry);
    const title = entry.data.title.trim().toLowerCase();
    return pages.some((page) => normalizedPageKey(page) !== key
        && page.data.title.trim().toLowerCase() === title);
}

export function pageDescription(data, body, sourcePath, id) {
    return data.description ?? deriveDescription(body ?? '', sourcePath)
        ?? `${data.title} in the ${pageSection(id)} documentation for Cratis.`;
}

// Product landing pages describe software; everything else is an article, hub or glossary.
const softwareProducts = new Set(['chronicle', 'arc', 'components', 'authproxy', 'showrunner', 'cli', 'chronicle-mcp', 'prompter', 'templates', 'direct', 'choreography', 'screenplay', 'stage']);

/**
 * Schema.org page kind: `glossary`, `software` (product landing), `collection` (a page that
 * has published child pages, or a splash landing) or `article`.
 */
export function pageKind(id, { hasChildren = false, splash = false } = {}) {
    const normalized = id.replace(/^\/+|\/+$/g, '').toLowerCase();
    if (normalized === 'glossary') return 'glossary';
    if (softwareProducts.has(normalized)) return 'software';
    return hasChildren || splash ? 'collection' : 'article';
}

export function hasPublishedChildren(id, pages) {
    const prefix = `${id.replace(/\/index$/, '')}/`;
    return !!id && pages.some((page) => page.id !== id && page.id.startsWith(prefix));
}

function plainText(markdown) {
    return markdown.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/\s+/g, ' ').trim();
}

function headingSlug(text) {
    return plainText(text).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').trim().replace(/\s/g, '-');
}

const tableCells = (line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map((cell) => cell.replace(/\\\|/g, '|').trim());

/**
 * Terms defined in the glossary's `| Term | Definition |` tables. A linked term points at its
 * own page; the others point at the heading of the section that defines them.
 */
export function glossaryTerms(body, pageUrl) {
    const terms = [];
    let section = '';
    for (const line of withoutAdmonitions(body).split('\n')) {
        const heading = /^#{2,6}\s+(.+?)\s*#*\s*$/.exec(line);
        if (heading) {
            section = headingSlug(heading[1]);
            continue;
        }
        if (!/^\s*\|/.test(line)) continue;
        const [term, definition] = tableCells(line);
        if (!term || !definition || /^:?-{3,}:?$/.test(term) || /^term$/i.test(term)) continue;
        const link = /\]\((\/[^)\s]*)\)/.exec(term)?.[1];
        const name = plainText(term);
        if (!name) continue;
        const anchor = section ? `#${section}` : '';
        terms.push({
            '@type': 'DefinedTerm', name, description: plainText(definition),
            url: link ? new URL(link, pageUrl).href : `${pageUrl.replace(/#.*$/, '')}${anchor}`,
            inDefinedTermSet: pageUrl,
        });
    }
    return terms;
}

function pageNode(kind, { title, description, url, dateModified, terms = [] }) {
    const common = { headline: title, description, url, inLanguage: 'en' };
    const dated = dateModified ? { dateModified } : {};
    switch (kind) {
        case 'glossary':
            return {
                '@type': 'DefinedTermSet', name: title, description, url, inLanguage: 'en', ...dated,
                ...(terms.length ? { hasDefinedTerm: terms } : {}),
            };
        case 'software':
            return {
                '@type': 'SoftwareApplication', name: title, description, url,
                applicationCategory: 'DeveloperApplication', inLanguage: 'en', ...dated,
            };
        case 'collection':
            return { '@type': 'CollectionPage', name: title, ...common, ...dated };
        default:
            return { '@type': 'TechArticle', ...common, ...dated };
    }
}

export function structuredData({ home, notFound = false, title, description, url, breadcrumbs, kind = 'article', dateModified, terms }) {
    if (notFound) return undefined;
    const organization = {
        '@type': 'Organization', '@id': 'https://cratis.no/#organization', name: 'Cratis', url: 'https://cratis.no',
        sameAs: ['https://www.linkedin.com/company/cratis-stack', 'https://www.youtube.com/@CratisStack'],
    };
    return {
        '@context': 'https://schema.org',
        '@graph': home ? [organization, {
            '@type': 'WebSite', '@id': 'https://www.cratis.io/#website',
            name: 'Cratis documentation', url: 'https://www.cratis.io/',
            description, inLanguage: 'en', publisher: { '@id': organization['@id'] },
        }] : [{
            ...pageNode(kind, { title, description, url, dateModified, terms }),
            publisher: organization,
        }, {
            '@type': 'BreadcrumbList', itemListElement: breadcrumbs.map(({ name, url: item }, index) => ({
                '@type': 'ListItem', position: index + 1, name, item,
            })),
        }],
    };
}

export function serializeStructuredData(data) {
    // Inline script data must not be able to close its enclosing script element.
    return JSON.stringify(data).replace(/</g, '\\u003c');
}
