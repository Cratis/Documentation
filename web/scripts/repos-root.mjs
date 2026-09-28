// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import path from 'node:path';

/** Locate sibling product checkouts, including when Documentation is a nested worktree. */
export function reposRootFor(webRoot, env = process.env) {
    return env.CRATIS_REPOS_ROOT
        ? path.resolve(env.CRATIS_REPOS_ROOT)
        : path.resolve(webRoot, '..', '..');
}

/** Resolve a manifest path relative to web/, mapping ../../ sibling paths to an overridden root. */
export function resolveRepoCandidate(webRoot, candidate, env = process.env) {
    return candidate.startsWith('../../')
        ? path.resolve(reposRootFor(webRoot, env), candidate.slice('../../'.length))
        : path.resolve(webRoot, candidate);
}
