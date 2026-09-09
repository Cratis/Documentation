// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { promises as fs } from 'node:fs';
import path from 'node:path';

// These are tooling/work directories, never public documentation. Check before
// slugification removes dots and makes a private path look like a public route.
const privateDirectories = new Set(['.ai-work', '.pi', '.agents', '.ai', '.claude', '.git', '.github', '.vscode']);

export function isPrivateDocPath(relativePath) {
    let decoded = relativePath;
    // Decode nested URL escapes too; invalid encodings remain literal paths.
    for (;;) {
        let next;
        try { next = decodeURIComponent(decoded); } catch { break; }
        if (next === decoded) break;
        decoded = next;
    }
    return decoded.split(/[\\/#?]/).some((segment) => privateDirectories.has(segment.toLowerCase()));
}

export function assertPublicDocPath(relativePath) {
    if (isPrivateDocPath(relativePath)) {
        throw new Error(`[docs] Refusing private documentation path: ${relativePath}`);
    }
}

// Resolve aliases as well as lexical paths. The explicit root is trusted: local
// fixtures may themselves live under .ai-work, but descendants and ../ escapes
// into work directories must never be read as documentation.
export async function assertPublicDocSource(file, root) {
    assertPublicDocPath(path.relative(root, file));
    const [realFile, realRoot] = await Promise.all([fs.realpath(file), fs.realpath(root)]);
    assertPublicDocPath(path.relative(realRoot, realFile));
}
