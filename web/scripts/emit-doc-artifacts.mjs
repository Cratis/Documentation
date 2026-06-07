// Emits static artifacts that Starlight does not create by itself:
// - /path.md mirrors for starlight-page-actions' "View in Markdown" and copy action.
// - Static files synced from product docs, such as Chronicle statistics HTML/JS.
//
// Run after astro build: node scripts/emit-doc-artifacts.mjs

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const docsRoot = path.join(webRoot, 'src', 'content', 'docs');
const distRoot = path.join(webRoot, 'dist');

const STATIC_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.html', '.js', '.css', '.json']);

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

function pageMarkdownOutput(relFile) {
    const withoutExt = relFile.replace(/\.(md|mdx)$/i, '');
    const slug = slugifyPath(withoutExt.replace(/(^|\/)index$/i, '$1'));
    return path.join(distRoot, slug ? `${slug}.md` : 'index.md');
}

function staticOutput(relFile) {
    const dir = slugifyPath(path.dirname(relFile));
    const file = path.basename(relFile).toLowerCase().replace(/[^a-z0-9._-]+/g, '');
    return path.join(distRoot, dir, file);
}

let markdownMirrors = 0;
let staticFiles = 0;

for await (const file of walk(docsRoot)) {
    const rel = path.relative(docsRoot, file);
    const ext = path.extname(file).toLowerCase();

    let outFile;
    if (ext === '.md' || ext === '.mdx') {
        outFile = pageMarkdownOutput(rel);
        markdownMirrors++;
    } else if (STATIC_EXT.has(ext)) {
        outFile = staticOutput(rel);
        staticFiles++;
    } else {
        continue;
    }

    await fs.mkdir(path.dirname(outFile), { recursive: true });
    await fs.copyFile(file, outFile);
}

console.log(`[postbuild] emitted ${markdownMirrors} markdown mirrors and ${staticFiles} static doc assets`);
