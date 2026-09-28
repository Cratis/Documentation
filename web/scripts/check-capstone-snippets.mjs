// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { samplesRootFor } from './repos-root.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(webRoot, 'src/content/docs/build-a-full-app.mdx');

// These are all the C# and TSX fences on the capstone page, in reading order.
// The four-language ArcBackendTabs excerpt belongs to its client repositories.
const snippets = [
    ['csharp', 'Program.cs', 'host'],
    ['csharp', 'Authors/AuthorId.cs', 'author-id'],
    ['csharp', 'Authors/RegisterAuthor.cs', 'register-author'],
    ['csharp', 'Authors/Author.cs', 'author-read-model'],
    ['tsx', 'Authors/AddAuthor.tsx', 'add-author'],
    ['tsx', 'Authors/Authors.tsx', 'authors-screen'],
];

function pageFences(page) {
    const fences = [];
    const pattern = /^([ \t]*)```(csharp|tsx)[ \t]*\n([\s\S]*?)^\1```[ \t]*$/gm;
    for (const match of page.matchAll(pattern)) {
        const [, indentation, language, body] = match;
        const lines = body.replaceAll('\r\n', '\n').split('\n');
        if (lines.at(-1) === '') lines.pop();
        if (lines.some(line => line && !line.startsWith(indentation))) {
            throw new Error(`Capstone ${language} fence has inconsistent indentation`);
        }
        fences.push([language, lines.map(line => line.slice(indentation.length)).join('\n')]);
    }
    return fences;
}

function sourceRegion(source, filename, name) {
    const marker = filename.endsWith('.cs') ? '#' : '// #';
    const lines = source.replaceAll('\r\n', '\n').split('\n');
    const start = `${marker}region docs:${name}`;
    const end = `${marker}endregion docs:${name}`;
    const starts = lines.flatMap((line, index) => line === start ? [index] : []);
    const ends = lines.flatMap((line, index) => line === end ? [index] : []);
    if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
        throw new Error(`Expected exactly one matching docs:${name} region in Capstone/${filename}`);
    }
    return lines.slice(starts[0] + 1, ends[0]).join('\n').trimEnd();
}

/** Fail if a displayed C#/TSX block is missing or differs from the built sample. */
export async function checkCapstoneSnippets({
    pageSource,
    samplesRoot = samplesRootFor(webRoot),
} = {}) {
    const page = pageSource ?? await readFile(pagePath, 'utf8');
    const fences = pageFences(page);
    if (fences.length !== snippets.length) {
        throw new Error(`Expected ${snippets.length} C#/TSX capstone fences; found ${fences.length}`);
    }

    for (const [index, [language, filename, name]] of snippets.entries()) {
        const [actualLanguage, shown] = fences[index];
        if (actualLanguage !== language) {
            throw new Error(`Capstone fence ${index + 1} must be ${language} (Capstone/${filename})`);
        }
        const source = await readFile(path.join(samplesRoot, 'Capstone', filename), 'utf8');
        const expected = sourceRegion(source, filename, name);
        if (shown.trimEnd() !== expected) {
            throw new Error(`Capstone fence ${index + 1} differs from Capstone/${filename} docs:${name}`);
        }
    }
}
