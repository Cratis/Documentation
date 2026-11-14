// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { promises as fs } from 'node:fs';
import path from 'node:path';

/** Arc pages that are kept out of the site until the feature they describe ships. */
export const ARC_EXCLUDED_PAGES = [{
    path: 'backend/csharp/mcp/capability-manifest.md',
    reason: 'Describes the capability-manifest contract from Cratis/Arc#3750 and #3751, which Arc has not implemented yet; publish once Arc ships it and the page loses its TODO markers.',
}];

function normalizedPage(page) {
    return path.posix.normalize(page.replace(/\\/g, '/')).toLowerCase();
}

export function isExcludedPage(sourcePath, product) {
    const relative = normalizedPage(path.relative(product.src, sourcePath));
    return (product.excludePages ?? []).some((entry) => normalizedPage(entry.path) === relative);
}

// A product's own excludeRootFiles (e.g. project-context.md) are deliberately
// never generated (see `walk`'s isProductRoot check); a root toc.yml entry
// pointing at one is not a broken link, so it must not trip the dropped-entry
// gate.
export function isExcludedRootTocHref(href, dirAbs, products) {
    // Compare the whole normalised href, so only the product-root file itself
    // matches; a nested page of the same name (nested/project-context.md) does not.
    const normalized = href.split(/[#?]/)[0].replace(/\\/g, '/').replace(/^(\.\/)+/, '').toLowerCase();
    return products.some((product) => product.src && product.excludeRootFiles?.length
        && path.resolve(dirAbs) === path.resolve(product.src)
        && product.excludeRootFiles.some((excluded) => excluded.toLowerCase() === normalized));
}

const MARKDOWN_LINK = /(!?)\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;

/**
 * Turns inline Markdown links whose target is a page excluded from the sync into
 * their plain text, so excluded pages leave no broken links. Images, absolute and
 * external targets, and anything the caller reports as code are left untouched.
 */
export function unlinkExcludedPages(body, { dir, product }, inCode = () => false) {
    if (!product?.excludePages?.length) return body;
    return body.replace(MARKDOWN_LINK, (whole, bang, text, target, offset) => {
        if (bang || inCode(offset)) return whole;
        const pathPart = target.split(/[#?]/)[0];
        if (!/\.mdx?$/i.test(pathPart) || /^(?:[a-z][a-z0-9+.-]*:|\/)/i.test(pathPart)) return whole;
        return isExcludedPage(path.resolve(dir, pathPart.replace(/\\/g, '/')), product) ? text : whole;
    });
}

export function isExcludedPageTocHref(href, dirAbs, products) {
    if (!dirAbs) return false;
    const target = path.resolve(dirAbs, href.split(/[#?]/)[0].replace(/\\/g, '/'));
    return products.some((product) => isExcludedPage(target, product));
}

async function excludedSourcePath(product, entry) {
    let source = product.src;
    for (const segment of normalizedPage(entry.path).split('/')) {
        const names = await fs.readdir(source);
        const name = names.find((candidate) => candidate.toLowerCase() === segment);
        if (!name) throw new Error(`[sync] Stale exclusion for ${product.key}: excluded page "${entry.path}" does not exist`);
        source = path.join(source, name);
    }
    return source;
}

async function excludedSourceText(product, entry) {
    try {
        return await fs.readFile(await excludedSourcePath(product, entry), 'utf8');
    } catch (error) {
        if (['ENOENT', 'ENOTDIR', 'EISDIR'].includes(error.code)) {
            throw new Error(`[sync] Stale exclusion for ${product.key}: excluded page "${entry.path}" is not a source file`, { cause: error });
        }
        throw error;
    }
}

// A missing excluded page fails CI, which always syncs current sources. Locally it only
// warns: an older sibling checkout may predate the page, and that must not block a sync.
async function excludedSourceOrWarn(product, entry) {
    try {
        return await excludedSourceText(product, entry);
    } catch (error) {
        if (process.env.CI === 'true' || !String(error.message).includes('Stale exclusion')) throw error;
        console.warn(`${error.message} (not failing outside CI; the local checkout may be older than the page)`);
        return null;
    }
}

export async function validateExcludedPages(product) {
    for (const entry of product.excludePages ?? []) {
        const raw = await excludedSourceOrWarn(product, entry);
        if (raw === null) continue;
        if (!/\bTODO\b|\bFIXME\b|\bTBD\b/.test(raw)) {
            console.warn(`[sync] Exclusion for ${product.key}: "${entry.path}" has no authoring markers and may now be removed. Reason: ${entry.reason}`);
        }
    }
}
