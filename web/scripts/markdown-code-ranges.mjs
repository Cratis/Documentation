// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import path from 'node:path';
import { fromMarkdown } from 'mdast-util-from-markdown';
import { gfmFromMarkdown } from 'mdast-util-gfm';
import { mdxFromMarkdown } from 'mdast-util-mdx';
import { gfm } from 'micromark-extension-gfm';
import { mdxjs } from 'micromark-extension-mdxjs';

// The sync and audit use the same source grammar: Markdown/GFM for .md and
// MDX for .mdx. Include expressions in the exclusion ranges for macro checks.
export function parseMarkdownCode(body, srcPath, messagePrefix = 'sync', hasFrontmatter = false) {
    // The audit reads raw pages; sync has already stripped frontmatter. Mask it
    // before parsing MDX so YAML strings containing <T> cannot be read as JSX.
    // Preserve every newline and offset for fence lines and macro positions.
    // Find the closing delimiter the way splitFrontmatter in sync-content does,
    // so a delimiter with trailing whitespace is masked too.
    let source = body;
    if (hasFrontmatter && body.startsWith('---')) {
        const close = body.indexOf('\n---', 3);
        if (close !== -1) {
            const lineEnd = body.indexOf('\n', close + 4);
            const end = lineEnd === -1 ? body.length : lineEnd;
            source = body.slice(0, end).replace(/[^\r\n]/g, ' ') + body.slice(end);
        }
    }
    // Mask DocFX xrefs without changing offsets; the authored body is untouched.
    const parseBody = source.replace(/<xref:[^>]+>/g, token => ' '.repeat(token.length));
    const mdx = path.extname(srcPath).toLowerCase() === '.mdx';
    let tree;
    try {
        tree = fromMarkdown(parseBody, {
            extensions: [mdx ? mdxjs() : gfm()],
            mdastExtensions: [mdx ? mdxFromMarkdown() : gfmFromMarkdown()],
        });
    } catch (error) {
        throw new Error(`[${messagePrefix}] Failed to parse ${srcPath}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
    }

    const ranges = [];
    const codes = [];
    // Inline code spans are reported separately: link rewriting must skip them,
    // but variant-fence and macro checks only concern code blocks/expressions.
    const inlineRanges = [];
    const pending = [tree];
    while (pending.length) {
        const node = pending.pop();
        if (node.type === 'code') {
            ranges.push([node.position.start.offset, node.position.end.offset]);
            codes.push(node);
        } else if (node.type === 'inlineCode') {
            inlineRanges.push([node.position.start.offset, node.position.end.offset]);
        } else if (mdx && ['mdxFlowExpression', 'mdxTextExpression', 'mdxjsEsm'].includes(node.type)) {
            ranges.push([node.position.start.offset, node.position.end.offset]);
        } else if (node.children) {
            pending.push(...node.children);
        }
    }
    return { ranges, codes, inlineRanges };
}
