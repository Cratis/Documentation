// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Search-result quality warning over the synced documentation: pages whose description is the
// generic fallback (no authored or derivable description). Repeated titles are deliberately
// not reported: the same topic legitimately appears per language and product, and Head.astro
// already adds the product context to <title>.
// This is a warning. seo-baseline.json holds today's count; a count above it is annotated so
// it shows on the pull request, and a count below it asks for the baseline to be lowered, so
// the number can only go down. Run with --update-baseline to rewrite it.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

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

/** @param {{ file: string, data: object }[]} pages */
export function analyse(pages) {
    const missingDescription = pages
        .filter(({ file, data }) => data.draft !== true && file !== '404.md'
            && (!data.description || fallbackDescription.test(String(data.description))))
        .map(({ file }) => file);
    return { missingDescription };
}

export function compare(counts, baseline) {
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
    const { missingDescription } = analyse(pages);
    const counts = { missingDescription: missingDescription.length };
    if (process.argv.includes('--update-baseline')) {
        await fs.writeFile(baselineFile, `${JSON.stringify(counts, null, 4)}\n`);
        console.log(`Wrote ${path.relative(process.cwd(), baselineFile)}: ${JSON.stringify(counts)}`);
        return;
    }
    for (const file of missingDescription) console.warn(`  [description] ${file}  no authored or derivable description`);
    const baseline = JSON.parse(await fs.readFile(baselineFile, 'utf8'));
    for (const { level, text } of compare(counts, baseline)) console.log(`::${level} title=SEO lint::${text}`);
    console.log(`
SEO lint: ${counts.missingDescription} page(s) without a real description (baseline ${baseline.missingDescription}); warnings only.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await main();
}
