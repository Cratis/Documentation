// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// The `.md` mirrors are read by people and AI assistants as plain Markdown, so the
// MDX scaffolding around the prose (component imports and JSX tag lines) is noise.
// Only whole lines are removed, never text inside a code fence.

const fenceMarker = /^[\s>*+-]*(`{3,}|~{3,})/;
const importLine = /^\s*import\s+(?:[\w{}*\s,$]+\s+from\s+)?(['"]).+\1;?\s*$/;
const tabItem = /^\s*<TabItem\b[^>]*?\blabel=(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})[^>]*>\s*$/;
const jsxTagLine = /^\s*<\/?[A-Z][\w.]*(?:\s[^>]*)?\/?>\s*$/;
const jsxOpenStart = /^\s*<[A-Z][\w.]*(?:\s[^>]*)?$/;

const odd = (line, character) => line.split(character).length % 2 === 0;

export function stripMdxSyntax(source) {
    const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(source)?.[0] ?? '';
    const lines = source.slice(frontmatter.length).split(/\r?\n/);
    const output = [];
    let fence;
    let openTag = false;
    let changed = false;
    // `{/* ... */}` comments and `export` template literals are literal text, not JSX scaffolding.
    let literal;
    for (const line of lines) {
        if (literal) {
            output.push(line);
            if (literal === 'comment' ? line.includes('*/}') : odd(line, '`')) literal = undefined;
            continue;
        }
        const marker = fenceMarker.exec(line)?.[1];
        if (marker && (!fence || (marker[0] === fence[0] && marker.length >= fence.length))) {
            fence = fence ? undefined : marker;
            output.push(line);
            continue;
        }
        if (fence) {
            output.push(line);
            continue;
        }
        if (openTag) {
            // Remaining attribute lines of a multi-line component tag.
            if (/>\s*$/.test(line)) openTag = false;
            changed = true;
            continue;
        }
        if (/^\s*\{\/\*/.test(line) && !line.includes('*/}')) literal = 'comment';
        else if (/^export\s/.test(line) && odd(line, '`')) literal = 'template';
        if (literal) {
            output.push(line);
            continue;
        }
        const label = tabItem.exec(line);
        if (label) {
            output.push(`**${label[1] ?? label[2] ?? label[3]}**`, '');
            changed = true;
            continue;
        }
        if (importLine.test(line) || jsxTagLine.test(line)) {
            changed = true;
            continue;
        }
        if (jsxOpenStart.test(line)) {
            openTag = true;
            changed = true;
            continue;
        }
        output.push(line);
    }
    // Untouched pages stay byte-identical to the source.
    if (!changed) return source;
    const body = output.join('\n').replace(/\n{3,}/g, '\n\n').replace(/^\n+/, '').trimEnd();
    return `${frontmatter}${frontmatter ? '\n' : ''}${body}\n`;
}
