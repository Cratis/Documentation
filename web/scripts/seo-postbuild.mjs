// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Search-engine metadata that Astro cannot set on files it only copies or generates:
//  - Storybook is built outside this site and copied in; keep its pages out of the index.
//  - DocFX API reference pages get a canonical URL and a description when they have none.
//  - sitemap entries get <lastmod> from the page's JSON-LD dateModified.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { budgetResult, sizeWarnings } from './llm-bulk.mjs';

const site = 'https://www.cratis.io';
// The title text is already HTML-encoded; only quotes can end the attribute early.
const escapeAttribute = (text) => text.replace(/"/g, '&quot;');

async function* htmlFiles(directory) {
    let entries;
    try {
        entries = await fs.readdir(directory, { withFileTypes: true });
    } catch {
        return;
    }
    for (const entry of entries) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) yield* htmlFiles(file);
        else if (entry.isFile() && entry.name.endsWith('.html')) yield file;
    }
}

function insertIntoHead(html, tags) {
    return /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${tags.join('')}</head>`) : html;
}

export function noindexed(html) {
    if (/<meta[^>]+name=["']robots["']/i.test(html)) return html;
    return insertIntoHead(html, ['<meta name="robots" content="noindex">']);
}

export function apiPageUrl(relativePath) {
    const route = relativePath.replace(/\\/g, '/').replace(/(^|\/)index\.html$/, '$1');
    return `${site}/api/${route}`;
}

export function withCanonicalAndDescription(html, relativePath) {
    // Redirect stubs and pages that already declare themselves are left alone.
    if (/http-equiv=["']refresh["']/i.test(html)) return html;
    const tags = [];
    if (!/<link[^>]+rel=["']canonical["']/i.test(html)) {
        tags.push(`<link rel="canonical" href="${apiPageUrl(relativePath)}">`);
    }
    if (!/<meta[^>]+name=["']description["']/i.test(html)) {
        const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/\s+/g, ' ').trim();
        const name = title?.split(/\s+[|–-]\s+/)[0];
        if (name) tags.push(`<meta name="description" content="${escapeAttribute(`${name} — API reference in the Cratis documentation.`)}">`);
    }
    return tags.length ? insertIntoHead(html, tags) : html;
}

export function dateModifiedOf(html) {
    return /"dateModified":"(\d{4}-\d{2}-\d{2})/.exec(html)?.[1];
}

export async function addSitemapLastmod(dist) {
    let added = 0;
    for (const entry of await fs.readdir(dist)) {
        if (!/^sitemap-\d+\.xml$/.test(entry)) continue;
        const file = path.join(dist, entry);
        const xml = await fs.readFile(file, 'utf8');
        const pattern = /<url><loc>([^<]+)<\/loc>(?!<lastmod>)/g;
        const lastmods = new Map();
        for (const [, loc] of xml.matchAll(pattern)) {
            const route = new URL(loc).pathname.replace(/^\/|\/$/g, '');
            try {
                const date = dateModifiedOf(await fs.readFile(path.join(dist, route, 'index.html'), 'utf8'));
                if (date) lastmods.set(loc, date);
            } catch {
                // Pages without built HTML keep an entry without lastmod.
            }
        }
        if (!lastmods.size) continue;
        await fs.writeFile(file, xml.replace(pattern, (match, loc) => lastmods.has(loc) ? `${match}<lastmod>${lastmods.get(loc)}</lastmod>` : match));
        added += lastmods.size;
    }
    return added;
}

/** Check the bytes actually written by the LLM exporter, including its final newline. */
export async function checkLlmBudgets(dist, { enforce = process.env.LLM_BUDGET_ENFORCE === '1' } = {}) {
    const sizes = new Map();
    async function collect(directory) {
        let entries;
        try {
            entries = await fs.readdir(directory, { withFileTypes: true });
        } catch (error) {
            if (error.code === 'ENOENT') return;
            throw error;
        }
        // Sorted so the reported order does not depend on the file system.
        entries.sort((a, b) => a.name.localeCompare(b.name));
        for (const entry of entries) {
            const file = path.join(directory, entry.name);
            if (entry.isDirectory()) await collect(file);
            else if (entry.isFile() && /^llms-(small|full)\.txt$/.test(entry.name)) {
                sizes.set(`/${path.relative(dist, file).replace(/\\/g, '/')}`, (await fs.stat(file)).size);
            }
        }
    }
    await collect(dist);
    const result = budgetResult(sizes, enforce);
    // emit-llm-indexes.mjs already emits the warning; only add errors when enforcement is on.
    if (enforce) {
        for (const warning of sizeWarnings(sizes)) console.error(warning.replace('::warning ', '::error '));
    }
    return result;
}

export async function seoPostbuild(dist, options) {
    let noindex = 0;
    let api = 0;
    for (const entry of await fs.readdir(dist, { withFileTypes: true })) {
        if (entry.isDirectory() && /^storybook(-.+)?$/.test(entry.name)) {
            for await (const file of htmlFiles(path.join(dist, entry.name))) {
                const html = await fs.readFile(file, 'utf8');
                const updated = noindexed(html);
                if (updated !== html) {
                    await fs.writeFile(file, updated);
                    noindex++;
                }
            }
        }
    }
    const apiRoot = path.join(dist, 'api');
    for await (const file of htmlFiles(apiRoot)) {
        const html = await fs.readFile(file, 'utf8');
        const updated = withCanonicalAndDescription(html, path.relative(apiRoot, file));
        if (updated !== html) {
            await fs.writeFile(file, updated);
            api++;
        }
    }
    const lastmod = await addSitemapLastmod(dist);
    console.log(`[postbuild] noindex on ${noindex} Storybook pages; canonical/description on ${api} API pages; lastmod on ${lastmod} sitemap URLs`);
    const budgets = await checkLlmBudgets(dist, options);
    return { noindex, api, lastmod, budgets };
}

if (process.argv[1] && await fs.realpath(process.argv[1]) === await fs.realpath(fileURLToPath(import.meta.url))) {
    const result = await seoPostbuild(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist'));
    if (result.budgets.failed) process.exitCode = 1;
}
