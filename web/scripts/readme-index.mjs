// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Opt-in README publication policy. Keep product-specific branching out of the sync pipeline.
import path from 'node:path';
import { isPrivateDocPath } from './private-doc-paths.mjs';
import { isExcludedPage } from './excluded-doc-pages.mjs';
import { readmeNavigation } from './readme-navigation.mjs';

export { skipReadme } from './readme-navigation.mjs';

export function readmeIndexTarget(target, product) {
    return product.readmeIndex ? target.replace(/(^|\/)readme(\.mdx?)$/i, '$1index$2') : target;
}

export function readmeIndexFilename(basename, product) {
    return product.readmeIndex && /^readme\.md$/i.test(basename) ? 'index.md' : basename;
}

export function skipPublicationEntry(directory, entry, product) {
    return isPrivateDocPath(entry.name) || isExcludedPage(path.join(directory, entry.name), product);
}

export async function productSidebarItems(product, outputDirectory, tocToSidebar) {
    if (product.readmeIndex) return (await readmeNavigation(outputDirectory, product.key)).items;
    return tocToSidebar(product.src, product.key);
}
