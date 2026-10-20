// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Search-result quality checks over the synced documentation. Missing descriptions remain
// warnings; duplicate browser titles within a top-level route section fail above the baseline.
// Run with --update-baseline to record the current counts in seo-baseline.json.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { contextualTitle, hasDuplicateTitle, hubTitle, normalizedPageKey } from './page-metadata.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(here, '../src/content/docs');
const baselineFile = path.join(here, 'seo-baseline.json');
// Matches pageDescription() when a page has no description and no usable first paragraph.
const fallbackDescription = /^.+ in the .+ documentation for Cratis\.$/;

async function* markdownFiles(directory) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || entry.name.startsWith('_')) continue;
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) yield* markdownFiles(file);
        else if (entry.isFile() && /\.mdx?$/.test(entry.name)) yield file;
    }
}

export function frontmatterOf(content) {
    const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(content);
    return (match && yaml.load(match[1])) || {};
}

// Match Head.astro: hub override, contextual title using published ancestors, then Starlight's title.
export function duplicateBrowserTitles(pages) {
    const published = pages.filter(({ data }) => data.draft !== true)
        .map((page) => ({ ...page, id: normalizedPageKey({ id: page.data.slug ?? page.file }), filePath: page.file }));
    const byId = new Map(published.map((page) => [page.id, page]));
    const groups = new Map();
    for (const page of published) {
        if (page.id === '404') continue;
        const segments = page.id.split('/');
        const parents = [];
        for (let length = 1; length < segments.length; length++) {
            const ancestor = byId.get(segments.slice(0, length).join('/'));
            if (ancestor) parents.push(ancestor.data.title);
        }
        const title = hubTitle(page.id)
            ?? contextualTitle(page.data.title, page.id, parents, hasDuplicateTitle(page, published))
            ?? `${page.data.title} | Cratis`;
        const section = segments[0];
        const key = JSON.stringify([section, title]);
        if (!groups.has(key)) groups.set(key, { section, title, files: [] });
        groups.get(key).files.push(page.file);
    }
    return [...groups.values()].filter(({ files }) => files.length > 1);
}

/** @param {{ file: string, data: object }[]} pages */
export function analyse(pages) {
    const missingDescription = pages
        .filter(({ file, data }) => data.draft !== true && file !== '404.md'
            && (!data.description || fallbackDescription.test(String(data.description))))
        .map(({ file }) => file);
    return { missingDescription, duplicateTitle: duplicateBrowserTitles(pages) };
}

function compareDuplicateTitles(count, baseline) {
    if (typeof baseline !== 'number') return [];
    const text = `${count} pages with duplicate browser titles within a section`;
    if (count > baseline) {
        return [{ level: 'error', text: `${text}, above the baseline of ${baseline}. Disambiguate the titles instead of raising the baseline.` }];
    }
    if (count < baseline) {
        return [{ level: 'warning', text: `${text}, below the baseline of ${baseline}. Lower duplicateTitle in web/scripts/seo-baseline.json to lock in the gain (npm run lint:seo -- --update-baseline).` }];
    }
    return count > 0 ? [{ level: 'warning', text: `${text}, at the baseline of ${baseline}.` }] : [];
}

export function compare(counts, baseline) {
    return [...compareDescriptions(counts, baseline), ...compareDuplicateTitles(counts.duplicateTitle, baseline.duplicateTitle)];
}

function compareDescriptions(counts, baseline) {
    const baselineCount = baseline.missingDescription;
    if (typeof baselineCount !== 'number') return [];
    if (counts.missingDescription > baselineCount) {
        return [{ level: 'warning', text: `${counts.missingDescription} pages without a real description, above the baseline of ${baselineCount}. Add a description to the page instead of raising the baseline.` }];
    }
    if (counts.missingDescription < baselineCount) {
        return [{ level: 'notice', text: `${counts.missingDescription} pages without a real description, below the baseline of ${baselineCount}. Lower missingDescription in web/scripts/seo-baseline.json to lock in the gain (npm run lint:seo -- --update-baseline).` }];
    }
    return [];
}

async function main() {
    const pages = [];
    for await (const file of markdownFiles(docsRoot)) {
        pages.push({ file: path.relative(docsRoot, file).replace(/\\/g, '/'), data: frontmatterOf(await fs.readFile(file, 'utf8')) });
    }
    const { missingDescription, duplicateTitle } = analyse(pages);
    const counts = { missingDescription: missingDescription.length, duplicateTitle: duplicateTitle.reduce((count, { files }) => count + files.length, 0) };
    if (process.argv.includes('--update-baseline')) {
        await fs.writeFile(baselineFile, `${JSON.stringify(counts, null, 4)}\n`);
        console.log(`Wrote ${path.relative(process.cwd(), baselineFile)}: ${JSON.stringify(counts)}`);
        return;
    }
    for (const file of missingDescription) console.warn(`  [description] ${file}  no authored or derivable description`);
    for (const { section, title, files } of duplicateTitle) console.warn(`  [title] ${section}: ${title}  ${files.join(', ')}`);
    const baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8'));
    const messages = compare(counts, baseline);
    for (const { level, text } of messages) console.log(`::${level} title=SEO lint::${text}`);
    if (messages.some(({ level }) => level === 'error')) process.exitCode = 1;
    console.log(`
SEO lint: ${counts.missingDescription} page(s) without a real description (baseline ${baseline.missingDescription}); warnings only.`);
    console.log(`SEO lint: ${counts.duplicateTitle} page(s) with duplicate browser titles within a section (baseline ${baseline.duplicateTitle}).`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
