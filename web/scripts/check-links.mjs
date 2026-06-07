// Verifies that every rendered local link resolves to a real built file.
// Run after a build: node scripts/check-links.mjs
//
// Ground truth is dist/, because Starlight serves pages from trailing-slash
// routes and MDX components can emit links that never appear as Markdown syntax.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const distRoot = path.join(webRoot, 'dist');

async function* walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile() && entry.name.endsWith('.html')) yield full;
    }
}

async function existsFile(file) {
    try {
        const stat = await fs.stat(file);
        return stat.isFile();
    } catch {
        return false;
    }
}

async function existsDirectoryIndex(dir) {
    try {
        const stat = await fs.stat(dir);
        return stat.isDirectory() && await existsFile(path.join(dir, 'index.html'));
    } catch {
        return false;
    }
}

async function existsUrlPath(pathname) {
    let decoded;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        decoded = pathname;
    }

    const target = path.join(distRoot, decoded.replace(/^\/+/, ''));
    return (
        await existsFile(target) ||
        await existsDirectoryIndex(target) ||
        (!path.extname(target) && await existsDirectoryIndex(target))
    );
}

function normalizeLocalTarget(fromFile, rawTarget) {
    let target = rawTarget.trim().replace(/&amp;/g, '&');
    if (!target || target.startsWith('#')) return null;
    if (target.includes('${')) return null;
    if (/^(?:https?:|mailto:|tel:|javascript:|data:|blob:|ftp:)/i.test(target)) return null;
    if (target.startsWith('//')) return null;

    target = target.split('#')[0].split('?')[0];
    if (!target) return null;

    if (target.startsWith('/')) return target;

    const fromDir = path.dirname('/' + path.relative(distRoot, fromFile).replace(/\\/g, '/'));
    return path.posix.normalize(path.posix.join(fromDir, target));
}

function renderedPage(file) {
    return '/' + path.relative(distRoot, file).replace(/\\/g, '/');
}

let htmlCount = 0;
let checked = 0;
let broken = 0;

for await (const file of walk(distRoot)) {
    htmlCount++;
    const html = await fs.readFile(file, 'utf8');
    const page = renderedPage(file);

    const attrs = [...html.matchAll(/(?:href|src|action|poster)=["']([^"']+)["']/gi)].map((m) => m[1]);
    const srcsets = [...html.matchAll(/srcset=["']([^"']+)["']/gi)]
        .flatMap((m) => m[1].split(',').map((part) => part.trim().split(/\s+/)[0]));

    for (const rawTarget of attrs.concat(srcsets)) {
        const target = normalizeLocalTarget(file, rawTarget);
        if (!target) continue;

        checked++;
        if (!await existsUrlPath(target)) {
            broken++;
            console.log(`  BROKEN ${page}  ->  ${rawTarget}  (resolved: ${target})`);
        }
    }
}

console.log(`\nChecked ${checked} rendered local links across ${htmlCount} HTML files — ${broken} broken.`);
if (broken > 0) process.exit(1);
