// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { parseMarkdownCode } from './markdown-code-ranges.mjs';

export function fenceRangesAndLanguages(body, srcPath, languageAliases) {
    const { ranges, codes } = parseMarkdownCode(body, srcPath, 'variant-docs', true);
    const fences = codes.sort((a, b) => a.position.start.offset - b.position.start.offset).flatMap((node) => {
        // Keep the leading language token, as the audit always has: ```csharp{1,3}
        // and ```cs,title still count as csharp.
        const token = node.lang?.match(/^[A-Za-z0-9_+.#-]*/)?.[0].toLowerCase();
        const lang = languageAliases.get(token);
        return lang ? [{ line: node.position.start.line, lang }] : [];
    });
    return { ranges: ranges.map(([start, end]) => ({ start, end })), fences };
}
