// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { reposRootFor, resolveRepoCandidate, samplesRootFor } from './repos-root.mjs';

test('sibling sources and Samples follow CRATIS_REPOS_ROOT in a nested Documentation worktree', () => {
    const web = path.join('/checkouts', 'Documentation', '.ai-work', 'worktrees', 'feature', 'web');
    const env = { CRATIS_REPOS_ROOT: '/checkouts' };
    assert.equal(reposRootFor(web, env), '/checkouts');
    assert.equal(samplesRootFor(web, env), '/checkouts/Samples');
    assert.equal(samplesRootFor(web, { ...env, CRATIS_SAMPLES_ROOT: '/worktrees/samples-121' }), '/worktrees/samples-121');
    assert.equal(resolveRepoCandidate(web, '../../Arc.TypeScript/Documentation', env), '/checkouts/Arc.TypeScript/Documentation');
    assert.equal(resolveRepoCandidate(web, '../Chronicle/Documentation', env),
        path.join('/checkouts', 'Documentation', '.ai-work', 'worktrees', 'feature', 'Chronicle', 'Documentation'));
});

test('standard sibling and submodule paths remain unchanged without an override', () => {
    const web = path.join('/checkouts', 'Documentation', 'web');
    assert.equal(reposRootFor(web, {}), '/checkouts');
    assert.equal(samplesRootFor(web, {}), '/checkouts/Samples');
    assert.equal(resolveRepoCandidate(web, '../../Chronicle/Documentation', {}), '/checkouts/Chronicle/Documentation');
    assert.equal(resolveRepoCandidate(web, '../Chronicle/Documentation', {}), '/checkouts/Documentation/Chronicle/Documentation');
});
