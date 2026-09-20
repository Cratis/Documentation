// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Writes permanent redirect stubs for moved content routes.
// Run after astro build: node scripts/content-redirects.mjs
//
// GitHub Pages has no rule engine, so a moved page 404s forever unless a stub
// page stands where it used to be. Each stub carries the canonical target and a
// deferred client-side shim that replays the visitor's query string and
// fragment onto it — the same shape `api-redirects.mjs` uses for /api/**.
//
// The manifest is hand-authored in web/content-redirects.yml. Every guard below
// throws: a redirect that points nowhere is worse than a missing redirect,
// because it looks handled.

import { existsSync, mkdirSync, promises as fsp, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

export const redirectScript = `// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
const destination = new URL(document.querySelector('link[rel="canonical"]').href);
destination.search = window.location.search;
destination.hash = window.location.hash;
window.location.replace(destination.href);
`;

export const SCRIPT_FILENAME = 'content-redirect.js';
export const AUDIT_FILENAME = 'content-redirects.json';

function escapeHtml(value) {
    return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function assertRoute(route, field, label) {
    if (typeof route !== 'string' || route.length === 0) throw new Error(`Content redirect ${label} has a missing or non-string "${field}"`);
    if (route.trim() !== route || /\s/.test(route)) throw new Error(`Content redirect ${label} has whitespace in "${field}": ${JSON.stringify(route)}`);
    if (/^[a-z][a-z0-9+.-]*:/i.test(route) || route.startsWith('//')) throw new Error(`Content redirect ${label} "${field}" must stay on this site, not an externally hosted URL: ${route}`);
    if (!route.startsWith('/')) throw new Error(`Content redirect ${label} "${field}" must be a site-absolute route starting with "/": ${route}`);
    if (route.includes('\\') || route.split('/').some((segment) => segment === '..' || segment === '.')) throw new Error(`Content redirect ${label} "${field}" must not contain relative segments: ${route}`);
    return route;
}

function inside(directory, route) {
    const relative = route.replace(/^\/+/, '');
    const resolved = path.resolve(directory, relative);
    if (resolved !== path.resolve(directory) && !resolved.startsWith(path.resolve(directory) + path.sep)) throw new Error(`Unsafe content route: ${route}`);
    return resolved;
}

function isFile(filename) {
    return existsSync(filename) && statSync(filename).isFile();
}

/** Parses and fully validates the manifest. Returns normalized `{ from, to }` entries. */
export function parseRedirects(source, origin = 'content-redirects.yml') {
    const loaded = yaml.load(source);
    if (loaded === null || loaded === undefined) return [];
    if (!Array.isArray(loaded)) throw new Error(`${origin} must contain a top-level list of { from, to } entries`);

    const entries = [];
    const destinations = new Map();
    for (const [index, entry] of loaded.entries()) {
        const label = `#${index + 1}`;
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error(`Content redirect ${label} must be a { from, to } mapping`);
        const unknown = Object.keys(entry).filter((key) => key !== 'from' && key !== 'to');
        if (unknown.length) throw new Error(`Content redirect ${label} has unsupported key(s): ${unknown.join(', ')}`);
        const from = assertRoute(entry.from, 'from', label);
        const to = assertRoute(entry.to, 'to', label);
        if (!from.endsWith('/')) throw new Error(`Content redirect ${label} "from" must be a directory route ending with "/": ${from}`);
        if (from === to) throw new Error(`Content redirect ${label} redirects ${from} to itself`);
        if (destinations.has(from)) throw new Error(`Duplicate content redirect "from": ${from}`);
        destinations.set(from, to);
        entries.push({ from, to });
    }

    // A target that is itself a redirect source would stub over a stub: the
    // visitor lands on a page that never existed, or loops forever.
    for (const { from } of entries) {
        const visited = [from];
        let current = destinations.get(from);
        while (destinations.has(current)) {
            if (visited.includes(current)) throw new Error(`Content redirect cycle: ${[...visited, current].join(' -> ')}`);
            visited.push(current);
            current = destinations.get(current);
        }
        if (visited.length > 1) throw new Error(`Content redirect chain: ${[...visited, current].join(' -> ')} — point every "from" straight at the final page`);
    }
    return entries;
}

/** Writes a redirect stub per entry into a built `dist`, after proving every target is real. */
export function writeContentRedirects(directory, entries) {
    // Validate everything before writing anything, so a bad manifest never
    // leaves a half-redirected build behind.
    for (const { from, to } of entries) {
        const destination = inside(directory, to);
        if (!isFile(destination) && !isFile(path.join(destination, 'index.html'))) {
            throw new Error(`Missing canonical page for content redirect ${from} -> ${to}`);
        }
        const stub = path.join(inside(directory, from), 'index.html');
        if (existsSync(stub)) throw new Error(`Refusing to overwrite generated page: ${from}`);
        if (isFile(inside(directory, from.replace(/\/+$/, '')))) throw new Error(`Refusing to overwrite generated page: ${from}`);
    }

    const audit = { redirects: [] };
    for (const { from, to } of entries) {
        const stubRoute = path.posix.join(from.replace(/^\/+/, ''), 'index.html');
        const stub = path.join(directory, stubRoute);
        const base = path.posix.dirname(stubRoute);
        const canonical = path.posix.relative(base, to.replace(/^\/+/, '')) + (to.endsWith('/') ? '/' : '');
        const script = path.posix.relative(base, SCRIPT_FILENAME);
        mkdirSync(path.dirname(stub), { recursive: true });
        writeFileSync(stub, `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Page moved</title>
<meta name="robots" content="noindex">
<meta name="cratis-content-redirect" content="${escapeHtml(canonical)}">
<link rel="canonical" href="${escapeHtml(canonical)}">
<script src="${escapeHtml(script)}" defer></script>
</head><body><p>This page has moved to <a href="${escapeHtml(canonical)}">its new location</a>.</p>
<noscript><p>Enable JavaScript to preserve the query string and fragment automatically.</p></noscript>
</body></html>
`);
        audit.redirects.push({ from, to, page: stubRoute, canonical });
    }

    if (entries.length) writeFileSync(path.join(directory, SCRIPT_FILENAME), redirectScript);
    writeFileSync(path.join(directory, AUDIT_FILENAME), `${JSON.stringify(audit, null, 2)}\n`);
    return entries.length;
}

if (process.argv[1] && await fsp.realpath(process.argv[1]) === await fsp.realpath(fileURLToPath(import.meta.url))) {
    const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    const manifest = path.join(webRoot, 'content-redirects.yml');
    const dist = path.join(webRoot, 'dist');
    if (!existsSync(dist)) {
        console.error(`[postbuild] content-redirects: no build output at ${path.relative(webRoot, dist)} — run astro build first`);
        process.exit(1);
    }
    try {
        const entries = parseRedirects(readFileSync(manifest, 'utf8'), path.relative(webRoot, manifest));
        const written = writeContentRedirects(dist, entries);
        if (written === 0) console.log('[postbuild] content-redirects: 0 redirects configured in content-redirects.yml');
        else console.log(`[postbuild] content-redirects: wrote ${written} redirect ${written === 1 ? 'page' : 'pages'}`);
    } catch (error) {
        console.error(`[postbuild] content-redirects FAILED: ${error instanceof Error ? error.message : String(error)}`);
        process.exit(1);
    }
}
