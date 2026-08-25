// Emits approved static assets that Starlight does not create by itself.
// Raw Markdown mirrors remain disabled until an explicit Approved-claim allowlist
// controls which canonical pages may be exposed as machine-readable source.
//
// Run after astro build: node scripts/emit-doc-artifacts.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const docsRoot = path.join(webRoot, 'src', 'content', 'docs');
const distRoot = path.join(webRoot, 'dist');

const STATIC_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif']);

function slugifyPath(p) {
    return p
        .replace(/\\/g, '/')
        .split('/')
        .map((seg) => seg.toLowerCase().replace(/[^a-z0-9_-]+/g, ''))
        .filter(Boolean)
        .join('/');
}

async function* walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile()) yield full;
    }
}

function staticOutput(relFile) {
    const dir = slugifyPath(path.dirname(relFile));
    const file = path.basename(relFile).toLowerCase().replace(/[^a-z0-9._-]+/g, '');
    return path.join(distRoot, dir, file);
}

let staticFiles = 0;

for await (const file of walk(docsRoot)) {
    const rel = path.relative(docsRoot, file);
    const ext = path.extname(file).toLowerCase();

    if (ext === '.md' || ext === '.mdx') continue;
    if (!STATIC_EXT.has(ext)) continue;

    const outFile = staticOutput(rel);
    staticFiles++;

    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.copyFile(file, outFile);
}

console.log(`[postbuild] emitted ${staticFiles} approved static doc assets; Markdown mirrors disabled`);
