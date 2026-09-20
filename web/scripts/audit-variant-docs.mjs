// Audits every product configured in web/variant-docs.yml.
//
// A product's shared docs should stay variant-neutral. Variant-specific code
// belongs in variant-owned snippets expanded through the axis macro (for
// Chronicle's `client` axis, <ChronicleClientTabs />), or in the variant's own
// docs mounted under /<product>/<route>/<variant>/.

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadVariantDocsConfig, webRoot } from './variant-docs-config.mjs';

const MESSAGE_PREFIX = '[variant-docs]';

const config = await loadVariantDocsConfig();

const args = new Set(process.argv.slice(2));
const valueArg = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
};

const strict = args.has('--strict');
const baselinePath = valueArg('--baseline');
const writeBaselinePath = valueArg('--write-baseline');

const GENERIC_SKIP_DIRS = ['.git', 'bin', 'node_modules', 'obj', '_includes', '_shared', '_snippets'];

function skipDirsFor(product) {
    return new Set([
        ...GENERIC_SKIP_DIRS,
        // Variant-owned snippet folders are inputs to the macro, not shared pages.
        ...product.axes.flatMap((axis) => axis.variants.map((variant) => path.basename(variant.snippetRoot))),
    ]);
}

function mountRoutesFor(product) {
    return new Set(product.axes.map((axis) => axis.mount.route));
}

async function* markdownFiles(root, skipDirs, mountRoutes, current = root) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (skipDirs.has(entry.name)) continue;
            // The variant docs mounted at the root are audited as variant docs,
            // not as shared docs.
            if (path.resolve(current) === path.resolve(root) && mountRoutes.has(entry.name)) continue;
            yield* markdownFiles(root, skipDirs, mountRoutes, path.join(current, entry.name));
            continue;
        }

        if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
            yield path.join(current, entry.name);
        }
    }
}

function fenceRangesAndLanguages(body, languageAliases) {
    const ranges = [];
    const fences = [];
    const lines = body.split(/\r?\n/);
    let offset = 0;
    let current;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^([`~]{3,})\s*([A-Za-z0-9_+.-]*)/);
        if (match) {
            const marker = match[1];
            const markerChar = marker[0];
            const lang = languageAliases.get((match[2] ?? '').toLowerCase());

            if (!current) {
                current = { markerChar, markerLength: marker.length, start: offset, line: i + 1, lang };
                if (lang) {
                    fences.push({ line: i + 1, lang });
                }
            } else if (markerChar === current.markerChar && marker.length >= current.markerLength) {
                ranges.push({ start: current.start, end: offset + line.length });
                current = undefined;
            }
        }

        offset += line.length + 1;
    }

    if (current) {
        ranges.push({ start: current.start, end: body.length });
    }

    return { ranges, fences };
}

function isInRange(index, ranges) {
    return ranges.some((range) => index >= range.start && index <= range.end);
}

function getAttr(attrs, name) {
    const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
    return match ? (match[2] ?? match[3] ?? '') : null;
}

async function snippetExists(variant, snippet) {
    for (const ext of ['.mdx', '.md']) {
        try {
            await fs.access(path.join(variant.snippetRoot, snippet + ext));
            return true;
        } catch {
            // Try the next supported extension.
        }
    }
    return false;
}

async function collectAxisAudit(product, axis) {
    const directFences = new Map();
    const placeholders = [];
    const missingSnippets = [];
    const missingRoots = [];
    const skipDirs = skipDirsFor(product);
    const mountRoutes = mountRoutesFor(product);

    for (const variant of axis.variants) {
        if (!existsSync(variant.snippetRoot)) {
            missingRoots.push(`${variant.label} snippet root: ${variant.snippetRoot}`);
        }
        if (variant.publicDocs && !existsSync(variant.publicDocs.root)) {
            missingRoots.push(`${variant.label} docs root: ${variant.publicDocs.root}`);
        }
    }

    const componentSource = `^[ \\t]*<${axis.macro}\\s+([^>]*)\\/>[ \\t]*$`;

    for await (const file of markdownFiles(product.sharedDocsRoot, skipDirs, mountRoutes)) {
        const body = await fs.readFile(file, 'utf8');
        const rel = path.relative(product.sharedDocsRoot, file).replace(/\\/g, '/');
        const { ranges, fences } = fenceRangesAndLanguages(body, axis.ratchetLanguageAliases);

        for (const fence of fences) {
            const fileEntry = directFences.get(rel) ?? {};
            fileEntry[fence.lang] = (fileEntry[fence.lang] ?? 0) + 1;
            directFences.set(rel, fileEntry);
        }

        const componentRe = new RegExp(componentSource, 'gm');
        for (const match of body.matchAll(componentRe)) {
            const index = match.index ?? 0;
            if (isInRange(index, ranges)) continue;

            const attrs = match[1];
            const snippet = getAttr(attrs, 'snippet');
            if (!snippet) {
                missingSnippets.push(`${rel}: ${axis.macro} is missing snippet="..."`);
                continue;
            }

            const available = [];
            for (const variant of axis.variants) {
                if (await snippetExists(variant, snippet)) {
                    available.push(variant.key);
                }
            }

            placeholders.push({ file: rel, snippet, variants: available });

            if (!available.length) {
                missingSnippets.push(`${rel}: no ${axis.key} has a snippet for "${snippet}"`);
            }
        }
    }

    return { directFences, placeholders, missingSnippets, missingRoots };
}

function directFenceBaselineMap(directFences) {
    return Object.fromEntries(
        [...directFences.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([file, languages]) => [
                file,
                Object.fromEntries(
                    Object.entries(languages)
                        .filter(([, count]) => count > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                ),
            ])
    );
}

async function readBaseline(filePath) {
    const absolute = path.resolve(webRoot, filePath);
    const raw = await fs.readFile(absolute, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.directVariantLanguageFences ?? {};
}

function compareBaseline(current, baseline) {
    const regressions = [];
    for (const [file, languages] of Object.entries(current)) {
        for (const [language, count] of Object.entries(languages)) {
            const allowed = baseline[file]?.[language] ?? 0;
            if (count > allowed) {
                regressions.push(`${file}: ${language} fences increased from ${allowed} to ${count}`);
            }
        }
    }
    return regressions;
}

function totalFences(map) {
    return Object.values(map)
        .flatMap((languages) => Object.values(languages))
        .reduce((total, count) => total + count, 0);
}

function printTopDirectFences(current) {
    const rows = Object.entries(current)
        .map(([file, languages]) => ({
            file,
            count: Object.values(languages).reduce((total, count) => total + count, 0),
            languages,
        }))
        .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
        .slice(0, 20);

    for (const row of rows) {
        const summary = Object.entries(row.languages)
            .map(([language, count]) => `${language}:${count}`)
            .join(', ');
        console.warn(`  ${row.file} (${summary})`);
    }
}

const failures = [];
const baselineOutput = {};
let auditedAxes = 0;

for (const product of config.products) {
    for (const axis of product.axes) {
        auditedAxes++;
        const audit = await collectAxisAudit(product, axis);
        const current = directFenceBaselineMap(audit.directFences);
        baselineOutput[product.key] ??= {};
        baselineOutput[product.key][axis.key] = current;

        const directFenceCount = totalFences(current);
        const scope = `${product.key}/${axis.key}`;
        console.log(`${MESSAGE_PREFIX} ${scope}: checked ${axis.variants.length} variants`);
        console.log(`${MESSAGE_PREFIX} ${scope}: found ${audit.placeholders.length} ${axis.macro} placeholders`);
        console.log(`${MESSAGE_PREFIX} ${scope}: found ${directFenceCount} direct variant-language fences in shared docs`);

        if (directFenceCount > 0) {
            console.warn(`${MESSAGE_PREFIX} ${scope}: top shared-doc files still needing snippet migration:`);
            printTopDirectFences(current);
        }

        failures.push(...audit.missingRoots.map((message) => `${scope}: missing root: ${message}`));
        failures.push(...audit.missingSnippets.map((message) => `${scope}: ${message}`));

        if (baselinePath) {
            const baseline = await readBaseline(baselinePath);
            const axisBaseline = baseline[product.key]?.[axis.key] ?? {};
            failures.push(...compareBaseline(current, axisBaseline).map((message) => `${scope}: ${message}`));
        }

        if (strict && directFenceCount > 0) {
            failures.push(`${scope}: strict mode failed: ${directFenceCount} direct variant-language fences remain in shared docs`);
        }
    }
}

if (writeBaselinePath) {
    const absolute = path.resolve(webRoot, writeBaselinePath);
    const baseline = {
        version: 2,
        description: 'Known direct variant-language fences in shared product docs, per product and axis. Lower counts are allowed; increases fail the audit.',
        directVariantLanguageFences: baselineOutput,
    };
    await fs.writeFile(absolute, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
    console.log(`${MESSAGE_PREFIX} Wrote baseline: ${path.relative(webRoot, absolute)}`);
}

// Non-vacuity: an audit that walked nothing must not report success.
if (auditedAxes === 0) {
    console.error(`${MESSAGE_PREFIX} Audit failed: no products/axes configured in ${path.relative(webRoot, config.manifestPath)}`);
    process.exit(1);
}

if (failures.length) {
    console.error(`${MESSAGE_PREFIX} Audit failed:`);
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    process.exit(1);
}

console.log(`${MESSAGE_PREFIX} Audit passed (${auditedAxes} ${auditedAxes === 1 ? 'axis' : 'axes'})`);
