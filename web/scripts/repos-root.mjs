// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { access } from 'node:fs/promises';
import path from 'node:path';

/** Locate sibling product checkouts, including when Documentation is a nested worktree. */
export function reposRootFor(webRoot, env = process.env) {
    return env.CRATIS_REPOS_ROOT
        ? path.resolve(env.CRATIS_REPOS_ROOT)
        : path.resolve(webRoot, '..', '..');
}

/** Resolve the Samples checkout, optionally pointing local worktree checks at another checkout. */
export function samplesRootFor(webRoot, env = process.env) {
    return env.CRATIS_SAMPLES_ROOT
        ? path.resolve(env.CRATIS_SAMPLES_ROOT)
        : path.join(reposRootFor(webRoot, env), 'Samples');
}

/** Find the catalog in an explicit checkout, a sibling checkout, or the Documentation submodule. */
export async function samplesCatalogFor(webRoot, env = process.env) {
    const candidates = [
        path.join(samplesRootFor(webRoot, env), 'samples.json'),
        ...(!env.CRATIS_SAMPLES_ROOT ? [path.resolve(webRoot, '../Samples/samples.json')] : []),
    ];
    for (const candidate of candidates) {
        try {
            await access(candidate);
            return candidate;
        } catch {
            // Try the next supported repository layout.
        }
    }
    throw new Error(
        `Could not find the Samples catalog. Expected one of:\n${candidates.map(candidate => `  - ${candidate}`).join('\n')}`,
    );
}

/** Resolve a manifest path relative to web/, with optional per-repo worktree checkouts. */
export function resolveRepoCandidate(webRoot, candidate, env = process.env) {
    if (!candidate.startsWith('../../')) return path.resolve(webRoot, candidate);
    const relative = candidate.slice('../../'.length);
    const [repository, ...parts] = relative.split('/');
    // A repo override replaces only that checkout, not the root for unrelated products.
    const overrides = {
        Arc: 'CRATIS_REPO_ARC',
        'Arc.Kotlin': 'CRATIS_REPO_ARC_KOTLIN',
        'Arc.TypeScript': 'CRATIS_REPO_ARC_TYPESCRIPT',
    };
    const override = env[overrides[repository]];
    return override
        ? path.resolve(env[overrides[repository]], ...parts)
        : path.resolve(reposRootFor(webRoot, env), relative);
}
