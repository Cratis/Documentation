// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Emits /path.md mirrors for page actions and static product documentation assets.
// Astro's build-completion hook calls emitDocArtifacts; running this script directly
// also generates AI indexes after the build.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertPublicDocPath, assertPublicDocSource } from './private-doc-paths.mjs';
import { emitLlmIndexes } from './emit-llm-indexes.mjs';
import { expandVariantTabs, splitFrontmatter } from './sync-content.mjs';
import { loadVariantDocsConfig } from './variant-docs-config.mjs';

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

export async function emitDocArtifacts(docsRoot, distRoot, options = {}) {
    // Validate the entire input before copying anything. Old local sync output
    // may still contain work records; silently skipping them would leave a
    // publishable build containing Astro/LLM exports of those same records.
    const files = [];
    for await (const file of walk(docsRoot)) files.push(file);

    let markdownMirrors = 0;
    let staticFiles = 0;
    const axes = options.axes ?? (await loadVariantDocsConfig()).axes;
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
        if (extension === '.mdx') {
            const source = await fs.readFile(file, 'utf8');
            if (axes.some(axis => source.includes(`<${axis.macro}`))) {
                // Site-owned MDX is expanded at render time; synchronized product
                // MDX already contains these tabs. Preserve the same tab markup in
                // both Markdown mirrors without changing either authored source.
                const { body } = splitFrontmatter(source);
                const expanded = await expandVariantTabs(body, {
                    srcPath: file,
                    product: { key: 'site' },
                    variantAxes: axes,
                    reposRoot: options.reposRoot,
                    docRepoRoot: options.docRepoRoot,
                });
                // Keep the authored frontmatter and its separator verbatim; the
                // generated Starlight import belongs in the MDX body, not above ---.
                await fs.writeFile(output, source.slice(0, source.length - body.length) + expanded.body);
            } else {
                await fs.copyFile(file, output);
            }
        } else {
            await fs.copyFile(file, output);
        }
    }
    console.log(`[build] emitted ${markdownMirrors} markdown mirrors and ${staticFiles} static doc assets`);
    return { markdownMirrors, staticFiles };
}

if (process.argv[1] && await fs.realpath(process.argv[1]) === await fs.realpath(fileURLToPath(import.meta.url))) {
    const dist = path.join(webRoot, 'dist');
    await emitDocArtifacts(path.join(webRoot, 'src', 'content', 'docs'), dist);
    await emitLlmIndexes(dist);
}
