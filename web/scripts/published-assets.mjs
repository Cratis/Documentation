// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// One naming rule for documentation assets: sync-content copies them next to the
// pages and rewrites links to them, emit-doc-artifacts publishes them into dist.

import path from 'node:path';

// Files copied with the documentation and published as static files.
export const STATIC_ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.html', '.js', '.css', '.json', '.play']);

// Assets Astro does not process. Pages are served from trailing-slash routes, so a
// relative link to one of these would resolve one directory too deep.
const ROUTED_ASSET_EXT = new Set(['.html', '.js', '.css', '.json', '.play']);

export function slugifyAssetDirectory(relativeDirectory) {
    return relativeDirectory
        .replace(/\\/g, '/')
        .split('/')
        .map((segment) => segment.toLowerCase().replace(/[^a-z0-9_-]+/g, ''))
        .filter(Boolean)
        .join('/');
}

// The dist path, relative to the docs root, a synchronized asset is published at.
export function publishedAssetPath(relativeFile) {
    const normalized = relativeFile.replace(/\\/g, '/');
    const directory = slugifyAssetDirectory(path.posix.dirname(normalized));
    const name = path.posix.basename(normalized).toLowerCase().replace(/[^a-z0-9._-]+/g, '');
    return directory ? `${directory}/${name}` : name;
}

// The link target for an in-root asset link, or null when the link is not to an
// asset. Images stay as authored (Astro processes them), as do absolute links.
// ctx is the link-rewriting context: the page's dir plus its product, and the
// optional contentRoot and slugBase a variant mount overrides them with.
export function assetLinkTarget(ctx, pathPart, target, suffix) {
    const extension = path.extname(pathPart).toLowerCase();
    if (!STATIC_ASSET_EXT.has(extension)) return null;
    if (!ROUTED_ASSET_EXT.has(extension) || pathPart.startsWith('/')) return target;
    let decoded = pathPart;
    try {
        decoded = decodeURIComponent(pathPart);
    } catch {
        // Keep a malformed escape as authored, like page links do.
    }
    const relative = path.relative(ctx.contentRoot ?? ctx.product.src, path.resolve(ctx.dir, decoded));
    return `/${slugifyAssetDirectory(ctx.slugBase ?? ctx.product.key)}/${publishedAssetPath(relative)}${suffix}`;
}
