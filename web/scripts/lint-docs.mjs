// Lints converted docs for quality issues the Markdown build itself won't catch.
//
// Two severities:
//   ERRORS (fail the build) — defects we never want shipped:
//     1. Non-descriptive link text ("here", "click here", "see documentation").
//     2. Leftover DocFX-isms the converter should have handled (xref:, [!INCLUDE], raw alerts).
//     3. Leftover authoring markers (TODO/FIXME/TBD, "lorem ipsum").
//   WARNINGS (reported, don't fail) — style-guide nudges from the Google and Microsoft
//     developer writing style guides, applied to prose only (code fences are skipped):
//     4. Weasel / filler words that add no information ("simply", "just", "obviously", "easily").
//     5. End punctuation on a heading.
//
// Runs over the generated content in src/content/docs (after `npm run sync`).
// Exits non-zero only on ERRORS so it can gate CI without style nits blocking a build.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const docsRoot = path.resolve(here, '..', 'src', 'content', 'docs');

// --- Error-level patterns ---
const NONDESCRIPTIVE = [/\[\s*here\s*\]/i, /\[\s*click here\s*\]/i, /\[\s*see documentation\s*\]/i, /\[\s*link\s*\]/i];
const DOCFX_LEFTOVERS = [/xref:/, /\[!INCLUDE/, /^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/m];
const AUTHORING_MARKERS = [/\bTODO\b/, /\bFIXME\b/, /\bTBD\b/, /lorem ipsum/i];

// --- Warning-level patterns (style guide; prose only) ---
// Filler/weasel words: they promise ease but tell the reader nothing, and they sting
// when the reader finds the step hard. (Google & Microsoft style guides both flag these.)
const WEASEL_WORDS = /\b(simply|just|obviously|easily|of course|clearly|trivially)\b/i;
// Headings should not end in a period or other terminal punctuation.
const HEADING_END_PUNCT = /^#{1,6}\s+.*[.!,;:]\s*$/;

let errors = 0;
let warnings = 0;
let filesChecked = 0;

async function walk(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            await walk(full);
            continue;
        }
        if (!/\.mdx?$/.test(entry.name)) continue;
        filesChecked++;
        const raw = await fs.readFile(full, 'utf8');
        checkFile(full, raw);
    }
}

function checkFile(file, raw) {
    const rel = path.relative(docsRoot, file);
    const lines = raw.split('\n');
    let inCodeFence = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (/^\s*```/.test(line)) {
            inCodeFence = !inCodeFence;
            continue;
        }
        if (inCodeFence) continue;
        const at = `${rel}:${i + 1}`;

        // Errors
        for (const re of NONDESCRIPTIVE) {
            if (re.test(line)) { console.error(`  [link-text] ${at}  ${line.trim()}`); errors++; }
        }
        for (const re of DOCFX_LEFTOVERS) {
            if (re.test(line)) { console.error(`  [docfx] ${at}  ${line.trim()}`); errors++; }
        }
        for (const re of AUTHORING_MARKERS) {
            if (re.test(line)) { console.error(`  [marker] ${at}  ${line.trim()}`); errors++; }
        }

        // Warnings (style guide) — skip inline-code spans so `simply` in `code` is ignored.
        const prose = line.replace(/`[^`]*`/g, '');
        // Heading end-punctuation: check the original line (entities decoded), NOT the
        // code-stripped `prose`. A heading like `## Convenience: `[EventLog]`` ends in a
        // code span, not punctuation — stripping the code first would leave a phantom
        // trailing colon. Decoding entities also exempts `### IEnumerable<T>` (authored
        // `&lt;T&gt;`), whose ';' is only from the entity, not real punctuation.
        const headingText = line
            .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
            .replace(/&quot;/g, '"').replace(/&#3[49];/g, "'");
        if (HEADING_END_PUNCT.test(headingText)) {
            console.warn(`  [heading-punct] ${at}  ${line.trim()}`);
            warnings++;
        }
        const weasel = prose.match(WEASEL_WORDS);
        if (weasel) {
            console.warn(`  [weasel: ${weasel[1]}] ${at}  ${line.trim()}`);
            warnings++;
        }
    }
}

async function main() {
    console.log(`Linting converted docs in ${path.relative(process.cwd(), docsRoot)} ...`);
    await walk(docsRoot);
    if (errors > 0) {
        console.error(`\n${errors} error(s), ${warnings} warning(s).`);
        process.exit(1); // errors gate the build; warnings do not
    }
    console.log(`\n0 error(s), ${warnings} warning(s).`);
}

await main();
