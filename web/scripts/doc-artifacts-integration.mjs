// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// page-actions copies files using source-case names, but its links use Astro's
// lowercase page slugs. This integration writes the canonical mirrors (and static
// documentation assets) when the build completes, including when Astro is invoked
// directly rather than through npm's postbuild lifecycle.

import { fileURLToPath } from 'node:url';
import { emitDocArtifacts } from './emit-doc-artifacts.mjs';

export const DOC_ARTIFACTS_INTEGRATION = 'documentation-artifacts';

/**
 * Creates the Astro integration that emits documentation artifacts into the build output.
 * @param {string} docsRoot Absolute path to the synced documentation content.
 * @returns {import('astro').AstroIntegration}
 */
export function docArtifactsIntegration(docsRoot) {
    return {
        name: DOC_ARTIFACTS_INTEGRATION,
        hooks: {
            'astro:build:done': async ({ dir }) => {
                await emitDocArtifacts(docsRoot, fileURLToPath(dir));
            },
        },
    };
}
