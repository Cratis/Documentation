// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// The site-wide bulk exports (llms-full.txt, llms-small.txt) must stay usable as
// context. Release digests and changelogs are time-ordered logs, not documentation
// to answer questions from, so they are left out; llms-small.txt is a compact
// page-by-page summary rather than a second copy of the full text.
import { deriveDescription, shortenDescription } from './page-metadata.mjs';

/** Separates pages inside the plugin's exports so they can be filtered afterwards. */
export const PAGE_MARKER = '<!--cratis-llms-page-->';
export const PAGE_SEPARATOR = `\n\n${PAGE_MARKER}\n\n`;

/**
 * Size above which the build warns. Both are warnings, never failures: pick a smaller
 * export deliberately rather than letting an area quietly grow past a model's context.
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

export function pageSummary(frontmatter, body, file) {
    const description = typeof frontmatter?.description === 'string' && frontmatter.description.trim()
        ? shortenDescription(frontmatter.description)
        : deriveDescription(body, file);
    return description;
}

const entry = ({ title, url, description }) =>
    `- [${title.replace(/\s+/g, ' ').replace(/[\\\[\]]/g, '\\$&')}](${url})${description ? `: ${description}` : ''}`;

/** `groups` is [{ label, pages: [{ title, url, description }] }]; empty groups are omitted. */
export function abridgedExport(heading, groups) {
    const lines = [`# ${heading}`, '', '> Titles and one-line summaries of the documentation pages. Open a page for the full text; HTML is canonical.', ''];
    for (const { label, pages } of groups) {
        if (!pages.length) continue;
        lines.push(`## ${label}`, '', ...pages.map(entry), '');
    }
    return lines.join('\n');
}

/** Warnings for exports over their documented threshold, as GitHub Actions annotations. */
export function sizeWarnings(sizes) {
    return SIZE_WARNINGS.filter(({ route, bytes }) => (sizes.get(route) ?? 0) > bytes)
        .map(({ route, bytes }) => `::warning title=LLM export size::${route} is ${sizes.get(route)} bytes, above the ${bytes} byte threshold; see web/README.md (LLM exports).`);
}
