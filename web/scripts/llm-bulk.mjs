// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// The site-wide bulk exports (llms-full.txt, llms-small.txt) must stay usable as
// context. Release digests and changelogs are time-ordered logs, not documentation
// to answer questions from, so they are left out; llms-small.txt is a compact
// curated starting-point summary rather than a second copy of the full text. The full export is also
// compacted (see compactFullText) so it stays under its size budget.
import { deriveDescription, shortenDescription } from './page-metadata.mjs';

/** Separates pages inside the plugin's exports so they can be filtered afterwards. */
export const PAGE_MARKER = '<!--cratis-llms-page-->';
export const PAGE_SEPARATOR = `\n\n${PAGE_MARKER}\n\n`;

/**
 * Size above which the build warns, or fails when budget enforcement is explicitly enabled.
 * Pick a smaller export deliberately rather than letting an area quietly grow past a model's context.
 */
export const SIZE_WARNINGS = [
    { route: '/llms-small.txt', bytes: 400_000 },
    { route: '/llms-full.txt', bytes: 17_000_000 },
];

// Only the weekly release digests and pages literally named changelog; docs about the release
// process (`releases`, `consuming-pre-releases`) are ordinary documentation.
const logPage = /^release-digests(\/|$)|(^|\/)changelogs?$/i;

/** Slugs (lowercase, no extension) of pages that are logs rather than documentation. */
export const isLogPage = (slug) => logPage.test(slug);

/** Segments of an export that start with `# Title`, dropped when the title only names excluded pages. */
export function withoutExcludedPages(content, pages) {
    const keptTitles = new Set(pages.filter(page => !page.excluded).map(page => page.title));
    const dropped = new Set(pages.filter(page => page.excluded && !keptTitles.has(page.title)).map(page => page.title));
    if (!dropped.size) return content;
    return content.split(PAGE_MARKER).filter((segment) => {
        const title = /^\s*# (.+)$/m.exec(segment)?.[1];
        return !(title && dropped.has(title) && /^\s*# /.test(segment));
    }).join(PAGE_MARKER);
}

/** The marker only exists to filter the plugin's output; published files do not carry it. */
export const withoutPageMarkers = (content) => content.replaceAll(PAGE_SEPARATOR, '\n\n').replaceAll(PAGE_MARKER, '');

const sectionTitleLine = /^\[Section titled [“"].*[”"]\]\(#[^)]*\)$/;
const fenceLine = /^ {0,3}(`{3,}|~{3,})/;
const tableDelimiterRow = /^\|(?:\s*:?-+:?\s*\|)+\s*$/;

/** Collapses only the padding next to unescaped cell pipes, so cell content stays intact. */
const compactTableRow = (line) => tableDelimiterRow.test(line)
    ? line.replace(/ +/g, ' ').replace(/-{4,}/g, '---')
    : line.replace(/ {2,}(?=\|)/g, ' ').replace(/(?<!\\)\| {2,}/g, '| ');

/**
 * Lossless size trimming for the full export only, outside fenced code: drops the plugin's
 * "Section titled" anchor lines (every heading repeats its own title) and collapses the
 * column padding of Markdown tables, which pads each cell to the widest value in its column.
 */
export function compactFullText(content) {
    const out = [];
    let fence = null;
    let dropBlank = false;
    for (const line of content.split('\n')) {
        const marker = fenceLine.exec(line)?.[1];
        if (fence) {
            if (marker && marker[0] === fence[0] && marker.length >= fence.length && !line.trim().slice(marker.length)) fence = null;
        } else if (marker) {
            fence = marker;
        } else if (sectionTitleLine.test(line)) {
            dropBlank = true;
            continue;
        } else if (line.startsWith('|')) {
            out.push(compactTableRow(line));
            dropBlank = false;
            continue;
        }
        if (dropBlank && !line.trim()) { dropBlank = false; continue; }
        dropBlank = false;
        out.push(line);
    }
    return out.join('\n');
}

export function pageSummary(frontmatter, body, file) {
    const description = typeof frontmatter?.description === 'string' && frontmatter.description.trim()
        ? shortenDescription(frontmatter.description)
        : deriveDescription(body, file);
    return description;
}

// Select overviews, first steps and core concepts, not the complete page inventory.
const startingPoint = /^(?:get-started|getting-started|tutorial|concepts|core-concepts)(?:\/[^/]+)?$/;
const coreOverviews = new Set([
    'overview', 'introduction', 'why-arc', 'why-event-sourcing', 'cqrs-without-event-sourcing',
    'events', 'read-models', 'projections', 'reactors', 'reducers', 'commands', 'queries',
    'concepts', 'serialization', 'dependency-injection', 'type-discovery', 'context',
    'backend/csharp/commands', 'backend/csharp/queries',
]);
const stackStartingPoints = new Set([
    'cratis-stack', 'build-a-full-app', 'samples', 'learning-paths', 'glossary',
    'concepts/event-store', 'concepts/cqrs', 'event-sourcing', 'cqrs',
]);

export function isCuratedPage(slug, productKey) {
    if (!productKey) return stackStartingPoints.has(slug);
    if (slug === productKey) return true;
    const relative = slug.slice(productKey.length + 1);
    return startingPoint.test(relative) || coreOverviews.has(relative);
}

const entry = ({ title, url, description }) =>
    `- [${title.replace(/\s+/g, ' ').replace(/[\\\[\]]/g, '\\$&')}](${url})${description ? `: ${description}` : ''}`;

/** `groups` is [{ label, pages: [{ title, url, description }] }]; empty groups are omitted. */
export function abridgedExport(heading, groups) {
    const lines = [`# ${heading}`, '', '> Curated overviews, getting-started guides and core concepts. Open a page for the full text; HTML is canonical. Budget: 400,000 bytes (400 KB).', ''];
    for (const { label, pages } of groups) {
        if (!pages.length) continue;
        lines.push(`## ${label}`, '', ...pages.map(entry), '');
    }
    return lines.join('\n');
}

/** Product downloads use the same explicit budgets as the corresponding site-wide export. */
export function llmBudget(route) {
    const name = /^\/(?:[a-z0-9_-]+\/)*llms-(small|full)\.txt$/.exec(route)?.[1];
    return name ? SIZE_WARNINGS.find(item => item.route === `/llms-${name}.txt`).bytes : undefined;
}

/** Structured budget verdict; enforcement must be explicitly enabled by the caller. */
export function budgetResult(sizes, enforce = false) {
    const exceeded = [...sizes].flatMap(([route, bytes]) => {
        const budgetBytes = llmBudget(route);
        return budgetBytes !== undefined && bytes > budgetBytes ? [{ route, bytes, budgetBytes }] : [];
    });
    return { exceeded, failed: enforce && exceeded.length > 0 };
}

/** Warnings for exports over their documented threshold, as GitHub Actions annotations. */
export function sizeWarnings(sizes) {
    return budgetResult(sizes).exceeded
        .map(({ route, bytes, budgetBytes }) => `::warning title=LLM export size::${route} is ${bytes} bytes, above the ${budgetBytes} byte threshold; see web/README.md (LLM exports).`);
}
