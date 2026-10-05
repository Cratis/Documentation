// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { gfm } from 'micromark-extension-gfm';

/** Adapt Markdown comments for insertion into MDX, leaving code literals untouched. */
export function markdownCommentsForMdx(body) {
    const tree = fromMarkdown(body, { extensions: [gfm()], mdastExtensions: [gfmFromMarkdown()] });
    const replacements = [];
    const pending = [tree];
    while (pending.length) {
        const node = pending.pop();
        if (node.type === 'html') {
            const start = node.position.start.offset;
            const source = body.slice(start, node.position.end.offset);
            for (const match of source.matchAll(/<!--([\s\S]*?)-->/g)) {
                // A JavaScript comment terminator in the hidden text must not
                // terminate the generated MDX expression early.
                const content = match[1].replaceAll('*/', '* /');
                replacements.push({ start: start + match.index, end: start + match.index + match[0].length,
                    value: `{/*${content}*/}` });
            }
        } else if (node.children) {
            pending.push(...node.children);
        }
    }
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
        body = body.slice(0, replacement.start) + replacement.value + body.slice(replacement.end);
    }
    return body;
}
