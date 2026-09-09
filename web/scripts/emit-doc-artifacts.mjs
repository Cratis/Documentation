// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Emits /path.md mirrors for page actions and static product documentation assets.
// Run after astro build: node scripts/emit-doc-artifacts.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPublicDocPath, assertPublicDocSource } from './private-doc-paths.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const STATIC_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.html', '.js', '.css', '.json']);

function slugifyPath(relativePath) {
    return relativePath
        .replace(/\\/g, '/')
        .split('/')
        .map((segment) => segment.toLowerCase().replace(/[^a-z0-9_-]+/g, ''))
        .filter(Boolean)
        .join('/');
}

async function* walk(root, directory = root) {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        const full = path.join(directory, entry.name);
        assertPublicDocPath(path.relative(root, full));
        if (entry.isSymbolicLink()) {
            await assertPublicDocSource(full, root);
            continue;
        }
        if (entry.isDirectory()) yield* walk(root, full);
        else if (entry.isFile()) yield full;
    }
}

export async function emitDocArtifacts(docsRoot, distRoot) {
    // Validate the entire input before copying anything. Old local sync output
    // may still contain work records; silently skipping them would leave a
    // publishable build containing Astro/LLM exports of those same records.
    const files = [];
    for await (const file of walk(docsRoot)) files.push(file);

    let markdownMirrors = 0;
    let staticFiles = 0;
    for (const file of files) {
        const relativeFile = path.relative(docsRoot, file);
        const extension = path.extname(file).toLowerCase();
        let output;
        if (extension === '.md' || extension === '.mdx') {
            const withoutExtension = relativeFile.replace(/\.(md|mdx)$/i, '');
            const slug = slugifyPath(withoutExtension.replace(/(^|\/)index$/i, '$1'));
            output = path.join(distRoot, slug ? `${slug}.md` : 'index.md');
            markdownMirrors++;
        } else if (STATIC_EXT.has(extension)) {
            const directory = slugifyPath(path.dirname(relativeFile));
            const name = path.basename(relativeFile).toLowerCase().replace(/[^a-z0-9._-]+/g, '');
            output = path.join(distRoot, directory, name);
            staticFiles++;
        } else {
            continue;
        }
        await fs.mkdir(path.dirname(output), { recursive: true });
        await fs.copyFile(file, output);
    }
    console.log(`[postbuild] emitted ${markdownMirrors} markdown mirrors and ${staticFiles} static doc assets`);
    return { markdownMirrors, staticFiles };
}

if (process.argv[1] && await fs.realpath(process.argv[1]) === await fs.realpath(fileURLToPath(import.meta.url))) {
    await emitDocArtifacts(path.join(webRoot, 'src', 'content', 'docs'), path.join(webRoot, 'dist'));
}
