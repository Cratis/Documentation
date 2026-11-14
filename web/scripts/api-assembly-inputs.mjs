// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

/** Resolve one Release input to its highest built .NET TFM, never to a recursive glob
 * that could document the same assembly twice. Missing DLL/XML inputs fail closed;
 * an incomplete newer output must not silently fall back to an older framework.
 */
function resolveAssemblySource(source) {
    const frameworks = existsSync(source.src)
        ? readdirSync(source.src, { withFileTypes: true })
            .filter(entry => entry.isDirectory() && /^net\d+\.\d+$/.test(entry.name))
            .map(entry => entry.name)
            .sort((left, right) => right.localeCompare(left, 'en', { numeric: true }))
        : [];
    const directory = frameworks.length ? path.join(source.src, frameworks[0]) : source.src;
    for (const filename of [source.files[0], source.files[0].replace(/\.dll$/, '.xml')]) {
        if (!frameworks.length || !existsSync(path.join(directory, filename))) {
            throw new Error(`Missing compiled API input: ${path.join(directory, filename)}`);
        }
    }
    return { ...source, src: directory };
}

/** Resolve audit baselines and the combined DocFX batch only after compilation or
 * cache restoration has finished, so a clean checkout needs no pre-existing output.
 */
export function resolveApiAssemblyInputs(config) {
    return {
        ...config,
        metadata: config.metadata.map(batch => ({ ...batch, src: batch.src.map(resolveAssemblySource) })),
    };
}
