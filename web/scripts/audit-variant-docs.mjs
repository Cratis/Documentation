// Audits every product configured in web/variant-docs.yml.
//
// A product's shared docs should stay variant-neutral. Variant-specific code
// belongs in variant-owned snippets expanded through the axis macro (for
// Chronicle's `client` axis, <ChronicleClientTabs />), or in the variant's own
// docs mounted under /<product>/<route>/<variant>/.
//
// The site's own pages under web/src/content/docs (configured by `sitePages`)
// are audited the same way, each against the axis its group names.

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadVariantDocsConfig, webRoot } from './variant-docs-config.mjs';
import { fenceRangesAndLanguages } from './variant-docs-fences.mjs';
import { auditSitePages, checkMacros, compareFenceBaseline as compareBaseline } from './variant-docs-site-audit.mjs';
import { GENERATED_CONTENT_ROUTES } from './sync-content.mjs';

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
        ...product.axes.flatMap((axis) => axis.variants
            .filter((variant) => variant.snippetRoot)
            .map((variant) => path.basename(variant.snippetRoot))),
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

async function collectAxisAudit(product, axis) {
    const directFences = new Map();
    const placeholders = [];
    const missingSnippets = [];
    const missingRoots = [];
    const skipDirs = skipDirsFor(product);
    const mountRoutes = mountRoutesFor(product);

    for (const variant of axis.variants) {
        if (variant.snippetRoot && !existsSync(variant.snippetRoot)) {
            missingRoots.push(`${variant.label} snippet root: ${variant.snippetRoot}`);
        }
        if (variant.publicDocs && !existsSync(variant.publicDocs.root)) {
            missingRoots.push(`${variant.label} docs root: ${variant.publicDocs.root}`);
        }
    }

    for await (const file of markdownFiles(product.sharedDocsRoot, skipDirs, mountRoutes)) {
        const body = await fs.readFile(file, 'utf8');
        const rel = path.relative(product.sharedDocsRoot, file).replace(/\\/g, '/');
        const { ranges, fences } = fenceRangesAndLanguages(body, file, axis.ratchetLanguageAliases);

        for (const fence of fences) {
            const fileEntry = directFences.get(rel) ?? {};
            fileEntry[fence.lang] = (fileEntry[fence.lang] ?? 0) + 1;
            directFences.set(rel, fileEntry);
        }

        const macros = await checkMacros(body, rel, ranges, axis);
        placeholders.push(...macros.placeholders);
        missingSnippets.push(...macros.missingSnippets);
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
    return {
        products: parsed.directVariantLanguageFences ?? {},
        sitePages: parsed.directSitePageFences ?? {},
    };
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
const siteBaselineOutput = {};
const baseline = baselinePath ? await readBaseline(baselinePath) : null;
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

        let baselinedFenceCount = 0;
        if (baseline) {
            const axisBaseline = baseline.products[product.key]?.[axis.key] ?? {};
            baselinedFenceCount = Object.values(axisBaseline)
                .reduce((total, languages) => total + Object.values(languages).reduce((s, n) => s + n, 0), 0);
            failures.push(...compareBaseline(current, axisBaseline).map((message) => `${scope}: ${message}`));
        }

        // Strict mode means "nothing above the recorded baseline", not "nothing at
        // all". An axis whose migration is finished records an empty baseline, so
        // any fence at all is an increase and still fails. An axis part-way
        // through records what it has left, which may then only go down — without
        // that, a product could never adopt the ratchet until it was already done.
        if (strict && directFenceCount > 0 && !baselinePath) {
            failures.push(`${scope}: strict mode failed: ${directFenceCount} direct variant-language fences remain in shared docs`);
        }
        if (strict && baselinePath && baselinedFenceCount > 0) {
            console.warn(`${MESSAGE_PREFIX} ${scope}: ${baselinedFenceCount} baselined fences still to migrate; this number may only go down`);
        }
    }
}

// Site-authored pages. Their absence from the manifest would leave them
// unaudited without a sound, so it is a failure rather than a skip.
if (!config.sitePages) {
    failures.push(`sitePages: not configured in ${path.relative(webRoot, config.manifestPath)}, so site-authored pages are unaudited`);
} else {
    const site = await auditSitePages({
        sitePages: config.sitePages,
        axes: config.axes,
        generatedRoutes: GENERATED_CONTENT_ROUTES,
    });
    Object.assign(siteBaselineOutput, site.current);

    console.log(
        `${MESSAGE_PREFIX} site pages: audited ${site.auditedPages} of ${site.pageCount} pages ` +
        `(${site.excludedPages} excluded, ${site.exemptedFences} exempted fences, ${site.placeholders.length} variant macros)`);
    for (const [scope, pages] of Object.entries(site.current)) {
        const count = totalFences(pages);
        console.log(`${MESSAGE_PREFIX} site pages/${scope}: found ${count} direct variant-language fences`);
        if (count > 0) printTopDirectFences(pages);
    }

    // Non-vacuity: a walk that found no site pages means the root is wrong.
    if (site.auditedPages === 0) {
        failures.push(`sitePages: audited no pages under ${path.relative(webRoot, config.sitePages.root)}`);
    }
    failures.push(...site.problems.map((message) => `site pages: ${message}`));

    if (baseline) {
        for (const [scope, pages] of Object.entries(site.current)) {
            failures.push(...compareBaseline(pages, baseline.sitePages[scope] ?? {})
                .map((message) => `site pages/${scope}: ${message}`));
        }
    } else if (strict) {
        const count = Object.values(site.current).reduce((total, pages) => total + totalFences(pages), 0);
        if (count > 0) failures.push(`site pages: strict mode failed: ${count} direct variant-language fences remain`);
    }
}

if (writeBaselinePath) {
    const absolute = path.resolve(webRoot, writeBaselinePath);
    const output = {
        version: 2,
        description: 'Known direct variant-language fences in shared product docs (per product and axis) and in site-authored pages (per ratchet axis). Lower counts are allowed; increases fail the audit.',
        directVariantLanguageFences: baselineOutput,
        directSitePageFences: siteBaselineOutput,
    };
    await fs.writeFile(absolute, JSON.stringify(output, null, 2) + '\n', 'utf8');
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
