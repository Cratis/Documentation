// Verifies that every internal Markdown link resolves to a real built page.
// Starlight does not fail the build on broken internal links, so this closes
// that gap. Run after a build: node scripts/check-links.mjs
//
// Ground truth for "what exists" is the built dist/ output; link targets in the
// source content are resolved (relative or root-relative) and checked against it.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const distRoot = path.join(webRoot, 'dist');
const docsRoot = path.join(webRoot, 'src', 'content', 'docs');

const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.ico', '.txt', '.json', '.zip', '.pdf']);

function norm(u) {
    return ('/' + u.replace(/^\/+|\/+$/g, '')).toLowerCase();
}

// Collect the URL path of every built page (dir containing index.html).
async function collectBuiltPages(dir, set) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) await collectBuiltPages(full, set);
        else if (e.name === 'index.html') set.add(norm('/' + path.relative(distRoot, dir)));
    }
}

// The page URL a source file maps to (mirrors Astro's lowercase slug rule).
function pageUrl(relFile) {
    let p = relFile.replace(/\.(md|mdx)$/, '').replace(/\\/g, '/');
    p = p.replace(/(^|\/)index$/, '');
    return norm('/' + p
        .split('/')
        .map((s) => s.toLowerCase().replace(/[^a-z0-9_-]+/g, ''))
        .filter(Boolean)
        .join('/'));
}

async function* walk(dir) {
    for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) yield* walk(full);
        else if (/\.(md|mdx)$/.test(e.name)) yield full;
    }
}

const built = new Set();
await collectBuiltPages(distRoot, built);

let checked = 0;
let broken = 0;
const linkRe = /\]\(([^)]+)\)/g;

for await (const file of walk(docsRoot)) {
    const rel = path.relative(docsRoot, file);
    const fromUrl = pageUrl(rel);
    // An index page is served at its own dir (/a/b/), so relative links resolve
    // against /a/b. A leaf page (/a/b/c) resolves relative links against /a/b.
    const isIndex = /(^|[/\\])index\.(md|mdx)$/.test(rel);
    const fromDir = isIndex ? fromUrl : (fromUrl.replace(/\/[^/]*$/, '') || '/');
    const content = await fs.readFile(file, 'utf8');
    let m;
    while ((m = linkRe.exec(content))) {
        let target = m[1].trim().split(/\s+/)[0]; // drop optional "title"
        if (/^(https?:|mailto:|tel:|#|data:)/.test(target) || target === '') continue;
        target = target.split('#')[0].split('?')[0];
        if (!target) continue;
        if (ASSET_EXT.has(path.extname(target).toLowerCase())) continue;
        let resolved;
        if (target.startsWith('/')) resolved = target;
        else resolved = path.posix.normalize(path.posix.join(fromDir, target));
        resolved = norm(resolved);
        checked++;
        if (!built.has(resolved)) {
            broken++;
            console.log(`  BROKEN ${rel}  ->  ${m[1]}  (resolved: ${resolved})`);
        }
    }
}

console.log(`\nChecked ${checked} internal links across ${built.size} built pages — ${broken} broken.`);
if (broken > 0) process.exit(1);
