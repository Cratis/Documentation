// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Audits the site-authored pages under web/src/content/docs.
//
// Product pages are audited in their own repositories' shared docs. The site's
// own pages (the Cratis Stack section, the scenarios, the capstone) are written
// here, so the product walk never sees them, and a direct single-language
// backend fence on one of them went unnoticed until someone read the page.
// This applies the same fence parser and ratchet to them, and checks their
// variant macros resolve the way the product audit does.

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { fenceRangesAndLanguages } from './variant-docs-fences.mjs';

const SKIP_DIRS = new Set(['.git', 'node_modules', '_includes', '_shared', '_snippets']);

export function isInRange(index, ranges) {
    return ranges.some((range) => index >= range.start && index <= range.end);
}

export function getAttr(attrs, name) {
    const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
    return match ? (match[2] ?? match[3] ?? '') : null;
}

export async function snippetExists(variant, snippet) {
    if (!variant.snippetRoot) return false;
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

/**
 * Finds every `<Macro snippet="..." />` of the axis outside code and MDX
 * expressions, and reports a macro with no snippet attribute or with a snippet
 * no variant of the axis provides.
 */
export async function checkMacros(body, rel, ranges, axis) {
    const placeholders = [];
    const missingSnippets = [];
    const componentRe = new RegExp(`^[ \\t]*<${axis.macro}\\s+([^>]*)\\/>[ \\t]*$`, 'gm');

    for (const match of body.matchAll(componentRe)) {
        if (isInRange(match.index ?? 0, ranges)) continue;

        const snippet = getAttr(match[1], 'snippet');
        if (!snippet) {
            missingSnippets.push(`${rel}: ${axis.macro} is missing snippet="..."`);
            continue;
        }

        const available = [];
        for (const variant of axis.variants) {
            if (await snippetExists(variant, snippet)) available.push(variant.key);
        }
        placeholders.push({ file: rel, snippet, variants: available });
        if (!available.length) {
            missingSnippets.push(`${rel}: no ${axis.key} has a snippet for "${snippet}"`);
        }
    }

    return { placeholders, missingSnippets };
}

/**
 * Lists the site-authored Markdown/MDX pages under `root`, relative and with
 * forward slashes. `generatedRoutes` are the folders the content sync
 * regenerates from product repositories; those are product pages, not site pages.
 */
export async function listSitePages(root, generatedRoutes) {
    const generated = new Set(generatedRoutes.map((route) => route.replace(/\\/g, '/').replace(/\/+$/, '')));
    const pages = [];

    async function walk(directory) {
        const entries = await fs.readdir(directory, { withFileTypes: true });
        for (const entry of entries) {
            const absolute = path.join(directory, entry.name);
            const rel = path.relative(root, absolute).split(path.sep).join('/');
            if (entry.isDirectory()) {
                if (SKIP_DIRS.has(entry.name) || generated.has(rel)) continue;
                await walk(absolute);
            } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
                pages.push(rel);
            }
        }
    }

    await walk(root);
    return pages.sort((a, b) => a.localeCompare(b));
}

/**
 * Compares per-file, per-language fence counts with a baseline. A count above
 * its baseline (a file or language missing from the baseline counts as 0) is a
 * regression; a lower count passes.
 */
export function compareFenceBaseline(current, baseline) {
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

function applyExemptions(page, fences, exemptions, problems) {
    const exempt = new Set();
    for (const exemption of exemptions) {
        const matches = fences.filter((fence) =>
            fence.lang === exemption.language && fence.value.includes(exemption.contains));
        if (matches.length === 0) {
            problems.push(
                `sitePages.exemptFences: ${page} has no counted ${exemption.language} fence containing ` +
                `"${exemption.contains}"; remove the stale exemption`);
        } else if (matches.length > 1) {
            problems.push(
                `sitePages.exemptFences: ${page} has ${matches.length} ${exemption.language} fences containing ` +
                `"${exemption.contains}"; make "contains" match exactly one fence`);
        } else {
            exempt.add(matches[0]);
        }
    }
    return fences.filter((fence) => !exempt.has(fence));
}

/**
 * Audits the site pages configured by `sitePages` in the manifest.
 *
 * Every page is either matched by a group (and ratcheted against that group's
 * axis) or excluded with a reason; a page that is neither fails, so a new page
 * cannot escape the audit by not being listed. Exclusions and exemptions that
 * no longer apply fail too, so the lists shrink instead of accumulating.
 *
 * @returns {{ current: Record<string, Record<string, Record<string, number>>>,
 *   problems: string[], placeholders: object[], pageCount: number,
 *   auditedPages: number, excludedPages: number, exemptedFences: number }}
 */
export async function auditSitePages({ sitePages, axes, generatedRoutes }) {
    const problems = [];
    const placeholders = [];
    const current = Object.fromEntries(sitePages.groups.map((group) => [group.scope, {}]));
    const pages = await listSitePages(sitePages.root, generatedRoutes);
    const pageSet = new Set(pages);
    const excluded = new Set(sitePages.exclude.map((entry) => entry.page));
    const exemptionsByPage = new Map();

    for (const entry of sitePages.exclude) {
        if (!pageSet.has(entry.page)) {
            problems.push(`sitePages.exclude: ${entry.page} does not exist; remove the stale exclusion`);
        }
    }
    for (const exemption of sitePages.exemptFences) {
        if (excluded.has(exemption.page)) {
            problems.push(`sitePages.exemptFences: ${exemption.page} is excluded, so its exemption is unnecessary`);
        } else if (!pageSet.has(exemption.page)) {
            problems.push(`sitePages.exemptFences: ${exemption.page} does not exist; remove the stale exemption`);
        }
        exemptionsByPage.set(exemption.page, [...(exemptionsByPage.get(exemption.page) ?? []), exemption]);
    }

    let auditedPages = 0;
    let exemptedFences = 0;
    for (const page of pages) {
        if (excluded.has(page)) continue;
        const group = sitePages.groups.find((candidate) => candidate.matchers.some((matcher) => matcher.test(page)));
        if (!group) {
            problems.push(`${page}: matched by no sitePages group and not excluded; audit it or exclude it with a reason`);
            continue;
        }
        auditedPages++;

        const absolute = path.join(sitePages.root, page);
        const body = await fs.readFile(absolute, 'utf8');
        const { ranges, fences } = fenceRangesAndLanguages(
            body, absolute, group.axis.ratchetLanguageAliases, { includeValue: true });
        const counted = applyExemptions(page, fences, exemptionsByPage.get(page) ?? [], problems);
        exemptedFences += fences.length - counted.length;

        const languages = {};
        for (const fence of counted) {
            languages[fence.lang] = (languages[fence.lang] ?? 0) + 1;
        }
        if (Object.keys(languages).length) {
            current[group.scope][page] = Object.fromEntries(
                Object.entries(languages).sort(([a], [b]) => a.localeCompare(b)));
        }

        // A site page may use any axis's macro, whichever axis ratchets its fences.
        for (const axis of axes) {
            const macros = await checkMacros(body, page, ranges, axis);
            placeholders.push(...macros.placeholders);
            problems.push(...macros.missingSnippets);
        }
    }

    return {
        current,
        problems,
        placeholders,
        pageCount: pages.length,
        auditedPages,
        excludedPages: pages.filter((page) => excluded.has(page)).length,
        exemptedFences,
    };
}
