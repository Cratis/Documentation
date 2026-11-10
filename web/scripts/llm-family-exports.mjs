// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isRootFullTextExcluded } from './llm-bulk.mjs';
import { LLM_FAMILIES, familyRoute } from './llm-families.mjs';

/** The site-wide and family files bundle many products, so they drop per-tab snippet source links as the root export did. */
export const isBundledExport = (route) => route === '/llms-full.txt' || route.startsWith('/families/');

export const pageSection = (page, body) => `# ${page.title}\n\nSource: ${page.url}\n\n${body.trim()}\n`;

const fullText = (label, pages) => [`# ${label} documentation`, '', '> Readable Markdown; HTML page URLs are canonical.', '', ...pages.map(page => page.section)].join('\n');
const includedPages = (pages) => pages.filter(page => !isRootFullTextExcluded(page.slug));

/** Map insertion order is the emitted PRODUCTS order; each product's pages are sorted by slug. */
export function familyFullText(family, pagesByProduct) {
    const pages = [...pagesByProduct].filter(([key]) => family.products.includes(key))
        .flatMap(([, pages]) => includedPages(pages).sort((a, b) => a.slug.localeCompare(b.slug)));
    return pages.length ? fullText(`${family.label} family`, pages) : undefined;
}

/** Pages are the productless group, not a selection of product starting points. */
export function platformFullText(pages, familyLinks) {
    return [
        '# Cratis platform documentation', '',
        '> Platform pages only. Product family downloads are the bulk archives; HTML page URLs are canonical.', '',
        '## Product family downloads', '', ...familyLinks, '',
        ...includedPages(pages).map(page => page.section),
    ].join('\n');
}

async function sectionsByProduct(groups, readSection) {
    const cache = new Map();
    const pagesByProduct = new Map();
    for (const { key, pages } of groups) {
        const sections = [];
        for (const page of pages) {
            if (!cache.has(page.slug)) cache.set(page.slug, await readSection(page));
            sections.push({ ...page, section: cache.get(page.slug) });
        }
        pagesByProduct.set(key, sections);
    }
    return pagesByProduct;
}

/** Assemble existing product downloads and new family/platform exports without reading mirrors twice. */
export async function fullTextExports(groups, readSection, link) {
    const pagesByProduct = await sectionsByProduct(groups, readSection);
    const files = new Map(groups.filter(group => group.key)
        .map(({ key, label }) => [`/${key}/llms-full.txt`, fullText(label, pagesByProduct.get(key))]));
    const families = [];
    for (const family of LLM_FAMILIES) {
        const content = familyFullText(family, pagesByProduct);
        if (content === undefined) continue;
        files.set(familyRoute(family.id), content);
        families.push(family);
    }
    const links = families.map(family => link(`${family.label} family full text`, familyRoute(family.id)));
    files.set('/llms-full.txt', platformFullText(pagesByProduct.get('') ?? [], links));
    return { files, families, links };
}
