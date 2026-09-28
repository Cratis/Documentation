// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { reposRootFor, resolveRepoCandidate, samplesCatalogFor, samplesRootFor } from './repos-root.mjs';

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

test('per-repository worktrees override only the named sibling, not Samples or other checkouts', () => {
    const web = path.join('/checkouts', 'Documentation', 'web');
    const env = {
        CRATIS_REPOS_ROOT: '/checkouts',
        CRATIS_REPO_ARC: '/worktrees/arc-capstone',
        CRATIS_REPO_ARC_KOTLIN: '/worktrees/arc.kotlin-capstone',
        CRATIS_REPO_ARC_TYPESCRIPT: '/worktrees/arc.typescript-capstone',
    };
    assert.equal(resolveRepoCandidate(web, '../../Arc/Documentation/client-snippets', env),
        '/worktrees/arc-capstone/Documentation/client-snippets');
    assert.equal(resolveRepoCandidate(web, '../../Arc.Kotlin/Documentation/client-snippets-java', env),
        '/worktrees/arc.kotlin-capstone/Documentation/client-snippets-java');
    assert.equal(resolveRepoCandidate(web, '../../Arc.TypeScript/Documentation/client-snippets', env),
        '/worktrees/arc.typescript-capstone/Documentation/client-snippets');
    assert.equal(resolveRepoCandidate(web, '../../Chronicle/Documentation', env), '/checkouts/Chronicle/Documentation');
    assert.equal(resolveRepoCandidate(web, '../Arc/Documentation', env),
        '/checkouts/Documentation/Arc/Documentation');
    assert.equal(samplesRootFor(web, env), '/checkouts/Samples');
});

test('standard sibling and submodule paths remain unchanged without an override', () => {
    const web = path.join('/checkouts', 'Documentation', 'web');
    assert.equal(reposRootFor(web, {}), '/checkouts');
    assert.equal(samplesRootFor(web, {}), '/checkouts/Samples');
    assert.equal(resolveRepoCandidate(web, '../../Chronicle/Documentation', {}), '/checkouts/Chronicle/Documentation');
    assert.equal(resolveRepoCandidate(web, '../Chronicle/Documentation', {}), '/checkouts/Documentation/Chronicle/Documentation');
});

test('Samples catalog resolves a submodule-only Documentation checkout, then prefers a sibling', async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cratis-samples-layout-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const web = path.join(root, 'Documentation', 'web');
    const submodule = path.join(root, 'Documentation', 'Samples', 'samples.json');
    const sibling = path.join(root, 'Samples', 'samples.json');
    await mkdir(path.dirname(submodule), { recursive: true });
    await writeFile(submodule, '{}');
    assert.equal(await samplesCatalogFor(web, {}), submodule);

    await mkdir(path.dirname(sibling), { recursive: true });
    await writeFile(sibling, '{}');
    assert.equal(await samplesCatalogFor(web, {}), sibling);
    await assert.rejects(samplesCatalogFor(web, { CRATIS_SAMPLES_ROOT: path.join(root, 'missing') }),
        error => error.message.includes(path.join(root, 'missing', 'samples.json')) && !error.message.includes(submodule));
});
