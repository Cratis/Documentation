// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Build product and area indexes over published HTML routes. Full-text sets
// are rendered by starlight-llms-txt from the same Astro content collection.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { PRODUCTS } from './sync-content.mjs';
import { LLM_SETS, llmSetSlug } from './llm-sets.mjs';
import { citeRenderedSet } from './llm-set-sources.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = 'https://www.cratis.io';
const maxSetBytes = 600_000; // Roughly 150k tokens; point larger areas at individual pages.

async function exists(file) {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}

async function* markdownFiles(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) yield* markdownFiles(file);
        else if (entry.isFile() && /\.mdx?$/.test(file)) yield file;
    }
}

function mirrorSlug(docsRoot, file) {
    return path.relative(docsRoot, file).replace(/\\/g, '/')
        .replace(/\.mdx?$/, '')
        .replace(/(^|\/)index$/i, '$1')
        .split('/')
        .map(segment => segment.toLowerCase().replace(/[^a-z0-9_-]+/g, ''))
        .filter(Boolean).join('/');
}

function titleOf(content, fallback) {
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content);
    const metadata = frontmatter && yaml.load(frontmatter[1]);
    const title = metadata?.hero?.title || metadata?.title;
    return typeof title === 'string' && title.trim() ? title.trim() : fallback;
}

function link(label, route) {
    return `- [${label.replace(/\s+/g, ' ').replace(/[\\\[\]]/g, '\\$&')}](${site}${route})`;
}

export async function emitLlmIndexes(dist, products = PRODUCTS, sets = LLM_SETS, docsRoot = path.resolve(here, '../src/content/docs')) {
    const fullSets = new Map();
    for (const set of sets) {
        const prefix = `${set.product}/${set.area}`;
        if (set.paths?.length !== 2 || !set.paths.includes(prefix) || !set.paths.includes(`${prefix}/**`)) {
            throw new Error(`Documentation set spans pages outside its area index: ${set.label}`);
        }
        const route = `/_llms-txt/${llmSetSlug(set.label)}.txt`;
        const file = path.join(dist, route.slice(1));
        if (!await exists(file)) throw new Error(`Missing rendered documentation set: ${route}`);
        const size = (await fs.stat(file)).size;
        if (size < 200 || size > maxSetBytes) throw new Error(`Documentation set ${route} has ${size} bytes (expected 200–${maxSetBytes})`);
        fullSets.set(`${set.product}/${set.area}`, route);
    }

    const output = new Map();
    const selectedPages = new Map(sets.map(set => [set, []]));
    const productLinks = [];
    let indexedPages = 0;
    const seenRoutes = new Set();
    for (const { key, label, src } of products) {
        const directory = path.join(docsRoot, key);
        if ((src && !await exists(src)) || !await exists(directory)) {
            if (['chronicle', 'arc', 'components'].includes(key)) throw new Error(`Missing required product in build: ${key}`);
            console.warn(`[postbuild] skipping ${key}: source or synchronized pages unavailable`);
            continue; // Never advertise an optional product left stale by a partial sync.
        }
        const pages = [];
        for await (const file of markdownFiles(directory)) pages.push(file);
        if (!pages.length) throw new Error(`Empty product documentation: ${key}`);
        const areas = new Map();
        for (const file of pages) {
            const relative = path.relative(docsRoot, file).replace(/\\/g, '/');
            const slug = mirrorSlug(docsRoot, file);
            const route = `/${slug}/`;
            if (seenRoutes.has(route)) throw new Error(`Duplicate published page route: ${route}`);
            seenRoutes.add(route);
            if (!await exists(path.join(dist, `${slug}.md`))) throw new Error(`Missing Markdown mirror for ${relative}: ${route}`);
            if (!await exists(path.join(dist, slug, 'index.html'))) throw new Error(`Missing HTML for ${relative}: ${route}`);
            const area = slug.slice(key.length).replace(/^\//, '').split('/')[0] || '';
            const fallback = slug.split('/').at(-1).replace(/-/g, ' ');
            const page = { title: titleOf(await fs.readFile(file, 'utf8'), fallback), route };
            for (const set of sets) {
                const prefix = `${set.product}/${set.area}`;
                if (slug === prefix || slug.startsWith(`${prefix}/`)) {
                    selectedPages.get(set).push({ title: page.title, url: `${site}${route}` });
                }
            }
            if (!areas.has(area)) areas.set(area, []);
            areas.get(area).push(page);
            indexedPages++;
        }
        const productRoute = `/${key}/llms.txt`;
        const overview = [`# ${label} documentation`, '', `> Choose a focused area or a page. HTML is canonical; the linked full-text sets contain rendered Markdown.`, ''];
        const roots = areas.get('') ?? [];
        if (roots.length) overview.push('## Overview', '', ...roots.sort((a, b) => a.route.localeCompare(b.route)).map(page => link(page.title, page.route)), '');
        for (const [area, pages] of [...areas].filter(([name]) => name).sort(([a], [b]) => a.localeCompare(b))) {
            const areaRoute = `/${key}/${area}/llms.txt`;
            const setRoute = fullSets.get(`${key}/${area}`);
            if (pages.length === 1 && !setRoute) {
                overview.push(link(pages[0].title, pages[0].route), '');
                continue;
            }
            const heading = area.replace(/-/g, ' ').replace(/^./, character => character.toUpperCase());
            overview.push(`## ${heading}`, '', `${link(`${heading} pages (${pages.length})`, areaRoute)}${setRoute ? `\n${link(`${heading} rendered full text`, setRoute)}` : ''}`, '');
            const areaIndex = [`# ${label}: ${heading}`, '', `> Pages in this area; open only those needed for your task.`, ''];
            if (setRoute) areaIndex.push(link('Rendered full text for this area', setRoute), '');
            areaIndex.push(...pages.sort((a, b) => a.route.localeCompare(b.route)).map(page => link(page.title, page.route)), '');
            output.set(areaRoute, areaIndex.join('\n'));
        }
        output.set(productRoute, overview.join('\n'));
        productLinks.push(link(`${label} documentation`, productRoute));
    }
    if (!productLinks.length || !indexedPages) throw new Error('No product pages indexed');
    for (const set of sets) {
        if (!output.has(`/${set.product}/${set.area}/llms.txt`)) throw new Error(`Set without a published area index: ${set.label}`);
        const route = fullSets.get(`${set.product}/${set.area}`);
        const content = await fs.readFile(path.join(dist, route.slice(1)), 'utf8');
        output.set(route, citeRenderedSet(content, selectedPages.get(set), set.label));
    }
    const root = path.join(dist, 'llms.txt');
    if (!await exists(root)) throw new Error('Missing site-wide llms.txt');
    const original = (await fs.readFile(root, 'utf8'))
        .replace(/\n## Product documentation\n[\s\S]*?(?=\n## Documentation Sets\n)/, '');
    if (!original.includes('## Documentation Sets\n')) throw new Error('Missing documentation sets in site-wide llms.txt');
    const introduction = [
        '## Product documentation',
        '',
        'Choose a product and then a task area. The full-site downloads below are bulk archives, not the best default context for one question.',
        '',
        ...productLinks,
        '',
        '## Cross-product starting points',
        '',
        link('Cratis stack', '/cratis-stack/'),
        link('Build a full-stack feature', '/build-a-full-app/'),
        link('Samples', '/samples/'),
    ].join('\n');
    for (const route of ['/cratis-stack/', '/build-a-full-app/', '/samples/']) {
        if (!await exists(path.join(dist, route.slice(1), 'index.html'))) throw new Error(`Missing cross-product guide: ${route}`);
    }
    const rootIndex = original.replace('## Documentation Sets\n', `${introduction}\n\n## Documentation Sets\n`);
    for (const [route, content] of output) {
        const file = path.join(dist, route.slice(1));
        await fs.mkdir(path.dirname(file), { recursive: true });
        await fs.writeFile(file, `${content.trimEnd()}\n`);
    }
    await fs.writeFile(root, rootIndex);
    console.log(`[postbuild] indexed ${indexedPages} product pages in ${productLinks.length} products and ${output.size - productLinks.length - sets.length} areas; ${sets.length} bounded rendered sets`);
    return { indexedPages, products: productLinks.length, areas: output.size - productLinks.length - sets.length };
}

if (process.argv[1] && await fs.realpath(process.argv[1]) === await fs.realpath(fileURLToPath(import.meta.url))) {
    await emitLlmIndexes(path.resolve(here, '../dist'));
}
