// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
    fundamentals: 'Fundamentals', cli: 'CLI', authproxy: 'AuthProxy',
    screenplay: 'Screenplay', prologue: 'Prologue', templates: 'Templates',
    'chronicle-mcp': 'Chronicle MCP', prompter: 'Prompter', ai: 'AI',
    architecture: 'Architecture', contributing: 'Contributing',
    'eventmodelers-ai': 'EventModelers.ai', 'release-digests': 'Release Digests',
};

export function pageSection(id) {
    return sections[id.split('/')[0].toLowerCase()] ?? 'Cratis Stack';
}

const genericTitle = /^(glossary|configuration|overview|introduction|getting[ -]started|index|events|concepts|commands|queries|reference)$/i;
const genericParent = /^(glossary|configuration|overview|introduction|getting[ -]started|index|concepts|reference|guides)$/i;

/** Parents are published ancestor page titles, ordered from the product down. */
export function contextualTitle(title, id, parents = [], isDuplicate = false) {
    if (!genericTitle.test(title.trim()) && !isDuplicate) return undefined;
    const parent = parents.findLast((name) => !genericParent.test(name.trim())
        && name.trim().toLowerCase() !== title.trim().toLowerCase());
    const parts = [title, parent, pageSection(id)].filter(Boolean);
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

export function structuredData({ home, notFound = false, title, description, url, breadcrumbs }) {
    if (notFound) return undefined;
    const organization = { '@type': 'Organization', '@id': 'https://cratis.no/#organization', name: 'Cratis', url: 'https://cratis.no' };
    return {
        '@context': 'https://schema.org',
        '@graph': home ? [organization, {
            '@type': 'WebSite', '@id': 'https://www.cratis.io/#website',
            name: 'Cratis documentation', url: 'https://www.cratis.io/',
            description, inLanguage: 'en', publisher: { '@id': organization['@id'] },
        }] : [{
            '@type': 'TechArticle', headline: title, description, url,
            inLanguage: 'en', publisher: organization,
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
