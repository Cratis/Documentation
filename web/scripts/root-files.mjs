// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import path from 'node:path';

// Repository control files that live at the repo root for tooling/AI but are
// not documentation. Checked case-insensitively at the product source root only.
const REPO_BOOTSTRAP_FILES = new Set([
    'agents.md', 'claude.md', 'gemini.md',
]);

const sameName = (left, right) => left.toLowerCase() === right.toLowerCase();

// A product can declare a root page whose name collides with a repository bootstrap
// file (Screenplay documents its `agents` block in agents.md). The declaration applies
// to the product's own source root only, never to family sources mounted under it.
export function isDeclaredRootPage(name, dirAbs, product) {
    return Boolean(product.src && product.includeRootPages?.length
        && path.resolve(dirAbs) === path.resolve(product.src)
        && product.includeRootPages.some((page) => sameName(page, name)));
}

// Whether a file at a product's content root is repository context rather than a
// site page: a bootstrap file the product did not declare as a page, or one of the
// product's own excludeRootFiles. Nested files of the same names stay authored content.
export function isSkippedRootFile(name, dirAbs, product) {
    if (REPO_BOOTSTRAP_FILES.has(name.toLowerCase())) return !isDeclaredRootPage(name, dirAbs, product);
    return Boolean(product.excludeRootFiles?.some((excluded) => sameName(excluded, name)));
}
