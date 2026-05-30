// Lints the converted documentation for the defects called out in
// .ai/rules/documentation.md: non-descriptive link text and leftover
// DocFX-isms that should have been converted.
//
// Run after a sync:  node scripts/lint-docs.mjs   (or `npm run lint:docs`)
// Exits non-zero if any ERROR-level issue is found.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(here, '..', 'src', 'content', 'docs');

// Non-descriptive link text (the whole link label is one of these) — a defect.
const BAD_LINK_TEXT = /\[\s*(see documentation|click here|here|read more|this|this page|link|see here|learn more|docs|documentation)\s*\]\(/i;

// Leftover DocFX-isms that the converter should have handled.
const LEFTOVERS = [
    { re: /<xref:/, msg: 'unconverted <xref:>' },
    { re: /\[!INCLUDE/, msg: 'unconverted [!INCLUDE]' },
    { re: /\{\{\s*snippet\s*:/i, msg: 'unresolved {{snippet:}} placeholder' },
    { re: /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/, msg: 'unconverted DocFX alert' },
];

let errors = 0;
let warnings = 0;

async function walk(dir) {
    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
            await walk(full);
        } else if (e.name.endsWith('.md') || e.name.endsWith('.mdx')) {
            await lintFile(full);
        }
    }
}

async function lintFile(file) {
    const rel = path.relative(docsRoot, file);
    const lines = (await fs.readFile(file, 'utf8')).split('\n');
    let inFence = false;
    lines.forEach((line, i) => {
        if (/^```/.test(line.trim())) inFence = !inFence;
        if (inFence) return;
        for (const { re, msg } of LEFTOVERS) {
            if (re.test(line)) {
                console.log(`  ERROR ${rel}:${i + 1}  ${msg}`);
                errors++;
            }
        }
        if (BAD_LINK_TEXT.test(line)) {
            console.log(`  WARN  ${rel}:${i + 1}  non-descriptive link text`);
            warnings++;
        }
    });
}

console.log('Linting converted docs in src/content/docs ...');
await walk(docsRoot);
console.log(`\n${errors} error(s), ${warnings} warning(s).`);
if (errors > 0) {
    console.error('Documentation lint failed (errors must be fixed).');
    process.exit(1);
}
