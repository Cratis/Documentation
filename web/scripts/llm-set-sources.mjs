// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Per-tab "View <language> snippet source on GitHub" links trace code to its
// owning repository on pages and page mirrors. Bundled answer exports drop
// them: one per language tab, they add about a fifth to a set's size.
const snippetSourceLine = /^[ \t]*\[View [^\]\n]+ snippet source on GitHub\]\(https:\/\/github\.com\/Cratis\/[^)\s]+\)[ \t]*\n/gm;

export function withoutSnippetSourceLinks(content) {
    return content.replace(snippetSourceLine, '');
}

// Match rendered page H1s to the selected source pages. Ambiguity fails closed;
// a duplicate title needs a narrower set, not a guessed citation.
export function citeRenderedSet(content, pages, name) {
    if (!pages.length) throw new Error(`Empty expected page set: ${name}`);
    const expected = new Map();
    for (const page of pages) {
        if (expected.has(page.title)) throw new Error(`Ambiguous page title in ${name}: ${page.title}`);
        expected.set(page.title, page.url);
    }
    const seen = new Set();
    const output = [];
    let fence;
    let previousWasHeading = false;
    for (const line of content.split('\n')) {
        const marker = /^\s*(`{3,}|~{3,})/.exec(line)?.[1];
        if (marker && (!fence || (marker[0] === fence[0] && marker.length >= fence.length))) {
            fence = fence ? undefined : marker;
        }
        const title = !fence && /^# (.+)$/.exec(line)?.[1];
        if (title) {
            if (!expected.has(title)) throw new Error(`Unexpected page in ${name}: ${title}`);
            if (seen.has(title)) throw new Error(`Duplicate rendered page in ${name}: ${title}`);
            seen.add(title);
            output.push(line, `Source: ${expected.get(title)}`);
            previousWasHeading = true;
            continue;
        }
        if (previousWasHeading && line.startsWith('Source: ')) {
            previousWasHeading = false;
            continue;
        }
        previousWasHeading = false;
        output.push(line);
    }
    const missing = [...expected.keys()].filter(title => !seen.has(title));
    if (missing.length) throw new Error(`Missing rendered pages in ${name}: ${missing.join(', ')}`);
    return `${output.join('\n').trimEnd()}\n`;
}
