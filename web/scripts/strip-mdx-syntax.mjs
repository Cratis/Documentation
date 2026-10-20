// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Edit only MDX syntax ranges. Markdown (especially fenced and inline code) stays
// authored, while component wrappers become readable labels rather than raw JSX.
import { fromMarkdown } from 'mdast-util-from-markdown';
import { mdxjs } from 'micromark-extension-mdxjs';
import { mdxFromMarkdown } from 'mdast-util-mdx';

function attribute(node, name) {
    return node.attributes?.find(item => item.type === 'mdxJsxAttribute' && item.name === name)?.value;
}

function staticText(expression) {
    if (expression?.type === 'Literal' && typeof expression.value === 'string') return expression.value;
    if (expression?.type === 'TemplateLiteral' && expression.expressions.length === 0) return expression.quasis[0].value.cooked;
    return '';
}

function labelOf(node) {
    for (const name of ['label', 'title', 'text']) {
        const value = attribute(node, name);
        if (typeof value === 'string') return value;
        // A static string expression is also a label, not executable content.
        const expression = value?.data?.estree?.body?.[0]?.expression;
        const text = staticText(expression);
        if (text) return text;
    }
    return '';
}

// Attribute expressions and quoted values may themselves contain > characters.
function openingTagEnd(source, start) {
    let quote;
    let braces = 0;
    for (let index = start; index < source.length; index++) {
        const character = source[index];
        if (quote) {
            if (character === '\\') index++;
            else if (character === quote) quote = undefined;
        } else if ('"\'`'.includes(character)) quote = character;
        else if (character === '{') braces++;
        else if (character === '}') braces--;
        else if (character === '>' && braces === 0) return index + 1;
    }
    return source.length;
}

function collapseBlankLines(source) {
    let fence;
    const result = [];
    for (const line of source.split('\n')) {
        const marker = /^[\s>*+-]*(`{3,}|~{3,})/.exec(line)?.[1];
        if (marker && (!fence || (marker[0] === fence[0] && marker.length >= fence.length))) fence = fence ? undefined : marker;
        else if (!fence && !line.trim() && result.length && !result.at(-1).trim()) continue;
        result.push(line);
    }
    return result.join('\n').trim();
}

export function stripMdxSyntax(source) {
    const frontmatter = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/.exec(source)?.[0] ?? '';
    const body = source.slice(frontmatter.length);
    const tree = fromMarkdown(body, { extensions: [mdxjs()], mdastExtensions: [mdxFromMarkdown()] });
    const edits = [];
    const replace = (start, end, text = '') => edits.push({ start, end, text });
    function visit(node) {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        if (['mdxjsEsm', 'mdxFlowExpression', 'mdxTextExpression'].includes(node.type)) {
            replace(start, end, staticText(node.data?.estree?.body?.[0]?.expression));
            return;
        }
        if (['mdxJsxFlowElement', 'mdxJsxTextElement'].includes(node.type) && (!node.name || /^[A-Z]/.test(node.name))) {
            const tagEnd = openingTagEnd(body, start);
            const label = labelOf(node);
            const href = attribute(node, 'href');
            const title = label && (typeof href === 'string' ? `[${label}](${href})` : `**${label}**`);
            const isFlow = node.type === 'mdxJsxFlowElement';
            replace(start, tagEnd, title ? `${title}${isFlow ? '\n\n' : ''}` : '');
            if (tagEnd < end) replace(body.lastIndexOf('</', end - 1), end);
        }
        for (const child of node.children ?? []) visit(child);
    }
    visit(tree);
    if (!edits.length) return source;
    let result = body;
    for (const { start, end, text } of edits.sort((a, b) => b.start - a.start)) {
        result = result.slice(0, start) + text + result.slice(end);
    }
    const cleaned = collapseBlankLines(result);
    return `${frontmatter}${frontmatter && cleaned ? '\n' : ''}${cleaned}${cleaned ? '\n' : ''}`;
}
