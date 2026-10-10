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

function proseText(node) {
    if (node.type === 'text') return node.value;
    if (node.type === 'break') return ' ';
    // Formatting and link labels are prose; code, images, JSX attributes and
    // expressions aren't. HTML tags disappear but surrounding text remains.
    if (['paragraph', 'emphasis', 'strong', 'delete', 'link', 'linkReference'].includes(node.type)) {
        return (node.children ?? []).map(proseText).join('');
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
        if (text && /[\p{L}\p{N}]/u.test(text)) return shortenDescription(text);
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

export function contextualTitle(title, id) {
    return /^(glossary|configuration|overview|introduction|getting[ -]started|index)$/i.test(title.trim())
        ? `${title} – ${pageSection(id)} | Cratis`
        : undefined;
}

export function pageDescription(data, body, sourcePath, id) {
    return data.description ?? deriveDescription(body ?? '', sourcePath)
        ?? `${data.title} documentation for ${pageSection(id)}.`;
}

export function structuredData({ home, title, description, url, breadcrumbs }) {
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
