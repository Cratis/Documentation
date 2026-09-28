// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { parseMarkdownCode } from './markdown-code-ranges.mjs';

export function fenceRangesAndLanguages(body, srcPath, languageAliases) {
    const { ranges, codes } = parseMarkdownCode(body, srcPath, 'variant-docs', true);
    const fences = codes.sort((a, b) => a.position.start.offset - b.position.start.offset).flatMap((node) => {
        const lang = languageAliases.get(node.lang?.toLowerCase());
        return lang ? [{ line: node.position.start.line, lang }] : [];
    });
    return { ranges: ranges.map(([start, end]) => ({ start, end })), fences };
}
