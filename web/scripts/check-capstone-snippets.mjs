// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveRepoCandidate, samplesCatalogFor } from './repos-root.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(webRoot, 'src/content/docs/build-a-full-app.mdx');

// C# snippets are owned by Arc; their fenced contents must match the built sample.
const backend = [
    ['host', 'Program.cs', 'host'],
    ['author-id', 'Authors/AuthorId.cs', 'author-id'],
    ['register-author', 'Authors/RegisterAuthor.cs', 'register-author'],
    ['author-read-model', 'Authors/Author.cs', 'author-read-model'],
];
// Kotlin, Java and TypeScript snippets are compiled by their owning repositories; here they must
// exist with exactly one fence each, so a missing file fails instead of silently dropping a tab.
const otherBackends = [
    ['Arc.Kotlin', 'client-snippets', 'kotlin'],
    ['Arc.Kotlin', 'client-snippets-java', 'java'],
    ['Arc.TypeScript', 'client-snippets', 'typescript'],
];
const frontend = [
    ['Authors/AddAuthor.tsx', 'add-author'],
    ['Authors/Authors.tsx', 'authors-screen'],
    ['App.tsx', 'authors-route'],
];

function pageFences(page) {
    const fences = [];
    const pattern = /^([ \t]*)```(csharp|cs|c#|tsx)[ \t]*\n([\s\S]*?)^\1```[ \t]*$/gm;
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

/** Return the body of the snippet's only fence, or throw if it has another shape or language. */
function singleFence(snippet, language, label) {
    const lines = snippet.replaceAll('\r\n', '\n').trimEnd().split('\n');
    const fences = lines.flatMap((line, index) => line.startsWith('```') ? [index] : []);
    if (fences.length !== 2 || fences[0] !== 0 || fences[1] !== lines.length - 1
        || lines[0] !== `\`\`\`${language}` || lines.at(-1) !== '```') {
        throw new Error(`${label} must contain exactly one ${language} fence`);
    }
    return lines.slice(1, -1).join('\n');
}

async function readSnippet(file, label) {
    try {
        return await readFile(file, 'utf8');
    } catch (error) {
        if (error.code === 'ENOENT') throw new Error(`${label} is missing: ${file} (ENOENT)`);
        throw error;
    }
}

function sourceRegion(source, filename, name) {
    const marker = filename.endsWith('.cs') ? '#' : '// #';
    const lines = source.replaceAll('\r\n', '\n').split('\n');
    const jsxMarker = filename === 'App.tsx';
    const start = jsxMarker ? `{/* #region docs:${name} */}` : `${marker}region docs:${name}`;
    const end = jsxMarker ? `{/* #endregion docs:${name} */}` : `${marker}endregion docs:${name}`;
    const starts = lines.flatMap((line, index) => line.trim() === start ? [index] : []);
    const ends = lines.flatMap((line, index) => line.trim() === end ? [index] : []);
    if (starts.length !== 1 || ends.length !== 1 || ends[0] <= starts[0]) {
        throw new Error(`Expected exactly one matching docs:${name} region in Capstone/${filename}`);
    }
    const region = lines.slice(starts[0] + 1, ends[0]);
    const indentation = Math.min(...region.filter(line => line.trim()).map(line => line.match(/^\s*/)[0].length));
    return region.map(line => line.slice(indentation)).join('\n').trimEnd();
}

/** Fail if the page loses a backend step, or displayed code drifts from the built sample. */
export async function checkCapstoneSnippets({
    pageSource,
    samplesRoot,
    arcRoot,
    arcKotlinRoot,
    arcTypeScriptRoot,
} = {}) {
    const root = samplesRoot ?? path.dirname(await samplesCatalogFor(webRoot));
    const arc = arcRoot ?? resolveRepoCandidate(webRoot, '../../Arc');
    const repositories = {
        'Arc.Kotlin': arcKotlinRoot ?? resolveRepoCandidate(webRoot, '../../Arc.Kotlin'),
        'Arc.TypeScript': arcTypeScriptRoot ?? resolveRepoCandidate(webRoot, '../../Arc.TypeScript'),
    };
    const page = pageSource ?? await readFile(pagePath, 'utf8');
    const tabs = [...page.matchAll(/^<ArcBackendTabs snippet="capstone\/([^"]+)" \/>$/gm)].map(match => match[1]);
    const expectedTabs = backend.map(([name]) => name);
    if (tabs.length !== backend.length || tabs.some((tab, index) => tab !== expectedTabs[index])) {
        throw new Error(`Expected ordered capstone backend tabs: ${expectedTabs.join(', ')}; found: ${tabs.join(', ')}`);
    }

    const fences = pageFences(page);
    if (fences.length !== frontend.length || fences.some(([language]) => language !== 'tsx')) {
        throw new Error(`Expected ${frontend.length} TSX capstone fences and no C# fences; found ${fences.length} C#/TSX fences`);
    }

    for (const [index, [filename, name]] of frontend.entries()) {
        const source = await readFile(path.join(root, 'Capstone', filename), 'utf8');
        if (fences[index][1].trimEnd() !== sourceRegion(source, filename, name)) {
            throw new Error(`Capstone fence ${index + 1} differs from Capstone/${filename} docs:${name}`);
        }
    }

    for (const [name, filename, region] of backend) {
        const label = `Arc capstone/${name}`;
        const snippet = await readSnippet(path.join(arc, 'Documentation/client-snippets/capstone', `${name}.md`), label);
        const body = singleFence(snippet, 'csharp', label);
        const source = await readFile(path.join(root, 'Capstone', filename), 'utf8');
        if (body.trimEnd() !== sourceRegion(source, filename, region)) {
            throw new Error(`${label} differs from Capstone/${filename} docs:${region}`);
        }

        for (const [repository, folder, language] of otherBackends) {
            const otherLabel = `${repository} ${folder}/capstone/${name}`;
            const file = path.join(repositories[repository], 'Documentation', folder, 'capstone', `${name}.md`);
            singleFence(await readSnippet(file, otherLabel), language, otherLabel);
        }
    }
}
