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
//     6. Suspicious framework-API patterns INSIDE code fences — the high-confidence
//        fabrication classes that repeated snippet audits keep finding (a regression guard).
//        Advisory so a deliberate anti-pattern example never breaks the build; verify each
//        snippet against real product source on main (see the snippet-correctness audit history).
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

// --- Suspicious framework-API patterns (checked INSIDE code fences) ---
// Each entry is a definitely-wrong shape verified against real Cratis source. These are the
// recurring fabrication classes from the snippet audits; flagging them keeps a fixed bug from
// silently coming back. Advisory (warning) — promote to error if false positives stay at zero.
const API_ANTIPATTERNS = [
    { re: /\[EventType\(\s*\d/, label: 'EventType positional int', hint: 'use [EventType(generation: N)] or [EventType("Name", N)] — a bare int binds to the string id param' },
    { re: /\bICommandHandler<|\bIQueryHandler</, label: 'fabricated handler interface', hint: 'commands/queries are model-bound: [Command]/[ReadModel] with Handle()/static query — ICommandHandler<T>/IQueryHandler<T> do not exist' },
    { re: /\bArcApplicationBuilder\.CreateBuilder/, label: 'wrong bootstrap type', hint: 'use ArcApplication.CreateBuilder(args)' },
    // `unless` exempts a legitimate match (here: a real markdown link `](…index.md)`
    // shown inside a code fence, e.g. a docs-about-docs example).
    { re: /index\.md[);]/, unless: /\]\(/, label: 'stray index.md in code', hint: 'converter artifact appended to a regex/comment/expression — remove the index.md suffix' },
];

let errors = 0;
let warnings = 0;
let apiWarnings = 0;
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
        const at = `${rel}:${i + 1}`;
        if (inCodeFence) {
            // Regression guard: catch known-fabricated API shapes in code examples.
            for (const { re, unless, label, hint } of API_ANTIPATTERNS) {
                if (re.test(line) && !(unless && unless.test(line))) {
                    console.warn(`  [api: ${label}] ${at}  ${line.trim()}  — ${hint}`);
                    warnings++;
                    apiWarnings++;
                }
            }
            continue;
        }

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
    if (apiWarnings > 0) {
        console.warn(`\n⚠ ${apiWarnings} suspicious framework-API pattern(s) [api] in code examples — verify each against real product source on main before shipping.`);
    }
    if (errors > 0) {
        console.error(`\n${errors} error(s), ${warnings} warning(s).`);
        process.exit(1); // errors gate the build; warnings do not
    }
    console.log(`\n0 error(s), ${warnings} warning(s).`);
}

await main();
