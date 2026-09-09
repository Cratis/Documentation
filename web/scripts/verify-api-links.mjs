// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { htmlAnchors } from './html-anchors.mjs';

export { htmlAnchors } from './html-anchors.mjs';

function htmlFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const filename = path.join(directory, entry.name);
        if (entry.isSymbolicLink()) throw new Error(`Generated API output contains a symbolic link: ${filename}`);
        if (entry.isDirectory()) return htmlFiles(filename);
        return entry.isFile() && entry.name.endsWith('.html') ? [filename] : [];
    });
}

function decodeAttribute(value) {
    return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

function redirectTarget(html) {
    return html.match(/<meta\s+name="cratis-api-redirect"\s+content="([^"]+)"\s*>/i)?.[1];
}

/** Check generated API links without deleting or rewriting failed links. Follow our real redirects. */
export function verifyApiLinks(directory) {
    const files = htmlFiles(directory);
    const issues = [];
    const anchors = new Map();
    const contents = new Map();
    const content = filename => {
        if (!contents.has(filename)) contents.set(filename, readFileSync(filename, 'utf8'));
        return contents.get(filename);
    };
    function resolveTarget(targetUrl, visited = new Set()) {
        if (targetUrl.origin !== 'https://docs.invalid' || !targetUrl.pathname.startsWith('/api/')) return { reason: 'API redirect leaves generated output' };
        let decodedPath;
        let fragment;
        try {
            decodedPath = decodeURIComponent(targetUrl.pathname.slice('/api/'.length));
            fragment = decodeURIComponent(targetUrl.hash.slice(1));
        } catch {
            return { reason: 'Invalid URL encoding' };
        }
        let target = path.resolve(directory, decodedPath);
        if (target !== path.resolve(directory) && !target.startsWith(path.resolve(directory) + path.sep)) return { reason: 'API path escapes generated output' };
        if (existsSync(target) && statSync(target).isDirectory()) target = path.join(target, 'index.html');
        if (!existsSync(target) || !statSync(target).isFile()) return { reason: 'Missing generated target' };
        if (visited.has(target)) return { reason: 'API redirect cycle' };
        visited.add(target);
        if (target.endsWith('.html')) {
            const redirect = redirectTarget(content(target));
            if (redirect) {
                let destination;
                try {
                    destination = new URL(decodeAttribute(redirect), targetUrl);
                } catch {
                    return { reason: 'Invalid API redirect URL' };
                }
                destination.search = targetUrl.search;
                destination.hash = targetUrl.hash;
                return resolveTarget(destination, visited);
            }
            if (fragment) {
                if (!anchors.has(target)) anchors.set(target, htmlAnchors(content(target)));
                if (!anchors.get(target).has(fragment)) return { reason: 'Missing generated anchor' };
            }
        }
        return {};
    }
    let checked = 0;
    let deferredSiteLinks = 0;
    if (!files.length) throw new Error('API generation produced no HTML pages.');

    for (const filename of files) {
        const html = content(filename);
        const currentUrl = new URL(`/api/${path.relative(directory, filename).split(path.sep).join('/')}`, 'https://docs.invalid');
        if (redirectTarget(html)) {
            checked++;
            const result = resolveTarget(currentUrl);
            if (result.reason) issues.push({ file: filename, href: decodeAttribute(redirectTarget(html)), reason: result.reason });
        }
        for (const tag of html.matchAll(/<(?:a|link|script|img|iframe|source|video|form)\b[^>]*>/gi)) {
            for (const attribute of tag[0].matchAll(/\b(?:href|src|action|poster)\s*=\s*(["'])(.*?)\1/gi)) {
                const href = decodeAttribute(attribute[2]);
                if (!href || /^(?:https?:|mailto:|tel:|javascript:|data:|blob:|ftp:)/i.test(href) || href.startsWith('//')) continue;
                let targetUrl;
                try {
                    targetUrl = new URL(href, currentUrl);
                } catch {
                    issues.push({ file: filename, href, reason: 'Invalid URL' });
                    continue;
                }
                if (!targetUrl.pathname.startsWith('/api/')) {
                    // The complete rendered-site checker owns links outside the API output,
                    // such as DocFX's link back to the narrative documentation at '/'.
                    deferredSiteLinks++;
                    continue;
                }
                checked++;
                const result = resolveTarget(targetUrl);
                if (result.reason) issues.push({ file: filename, href, reason: result.reason });
            }
        }
    }
    return { pages: files.length, checked, deferredSiteLinks, issues };
}
