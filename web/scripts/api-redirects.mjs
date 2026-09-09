// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { htmlAnchors } from './verify-api-links.mjs';

export const redirectScript = `// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.
const destination = new URL(document.querySelector('link[rel="canonical"]').href);
destination.search = window.location.search;
destination.hash = window.location.hash;
window.location.replace(destination.href);
`;

function escapeHtml(value) {
    return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function inside(directory, filename) {
    if (!filename || filename.includes('\\') || filename.split('/').includes('..') || path.isAbsolute(filename)) throw new Error(`Unsafe API route: ${filename}`);
    return path.join(directory, filename);
}

/** Real local redirects; destinations and every source UID are checked against DocFX's xref map. */
export function writeApiRedirects(directory, audit) {
    const xref = yaml.load(readFileSync(path.join(directory, 'xrefmap.yml'), 'utf8'));
    const references = new Map();
    for (const reference of xref.references ?? []) {
        if (references.has(reference.uid)) throw new Error(`Duplicate rendered API UID: ${reference.uid}`);
        references.set(reference.uid, reference.href);
    }
    const anchors = new Map();
    for (const [legacy, { target, uids }] of Object.entries(audit.routes)) {
        const destination = inside(directory, target);
        if (!existsSync(destination)) throw new Error(`Missing canonical API page: ${target}`);
        if (!anchors.has(target)) anchors.set(target, htmlAnchors(readFileSync(destination, 'utf8')));
        for (const uid of uids) {
            const href = references.get(uid);
            if (!href) throw new Error(`Missing rendered API UID: ${uid}`);
            const url = new URL(href, 'https://docs.invalid/');
            if (url.origin !== 'https://docs.invalid' || decodeURIComponent(url.pathname.slice(1)) !== target) throw new Error(`Unexpected canonical API route for ${uid}: ${href}`);
            if (url.hash && !anchors.get(target).has(decodeURIComponent(url.hash.slice(1)))) throw new Error(`Missing rendered API member anchor: ${uid}`);
        }
        const filename = inside(directory, legacy);
        if (existsSync(filename)) throw new Error(`Refusing to overwrite generated API page: ${legacy}`);
        const relative = path.posix.relative(path.posix.dirname(legacy), target);
        const script = path.posix.relative(path.posix.dirname(legacy), 'api-redirect.js');
        mkdirSync(path.dirname(filename), { recursive: true });
        writeFileSync(filename, `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>API reference moved</title>
<meta name="cratis-api-redirect" content="${escapeHtml(relative)}">
<link rel="canonical" href="${escapeHtml(relative)}">
<script src="${escapeHtml(script)}" defer></script>
</head><body><p>This API reference has moved to <a href="${escapeHtml(relative)}">its canonical namespace page</a>.</p>
<noscript><p>Enable JavaScript to preserve the query string and member fragment automatically.</p></noscript>
</body></html>
`);
    }
    writeFileSync(path.join(directory, 'api-redirect.js'), redirectScript);
    writeFileSync(path.join(directory, 'api-redirects.json'), `${JSON.stringify(audit, null, 2)}\n`);
    return Object.keys(audit.routes).length;
}
