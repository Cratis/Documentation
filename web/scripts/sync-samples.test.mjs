// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const scriptPath = fileURLToPath(new URL('./sync-samples.mjs', import.meta.url));

test('an unavailable explicit Samples checkout fails sync rather than falling back', () => {
    const missing = path.join(path.dirname(scriptPath), 'missing-samples');
    const result = spawnSync(process.execPath, [scriptPath], {
        env: { ...process.env, CRATIS_SAMPLES_ROOT: missing },
        encoding: 'utf8',
    });
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stderr, /Could not find the Samples catalog/);
    assert.match(result.stderr, /missing-samples\/samples.json/);
    assert.equal(result.stderr.includes(path.resolve(path.dirname(scriptPath), '../../Samples/samples.json')), false,
        'an explicit Samples checkout must not report the submodule fallback');
    assert.doesNotMatch(result.stdout, /Synced/);
});

test('sync reads Samples from the Documentation submodule when no sibling exists', async t => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'cratis-sync-samples-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const web = path.join(root, 'Documentation', 'web');
    const scripts = path.join(web, 'scripts');
    const catalog = path.join(root, 'Documentation', 'Samples', 'samples.json');
    await mkdir(scripts, { recursive: true });
    await mkdir(path.dirname(catalog), { recursive: true });
    await copyFile(scriptPath, path.join(scripts, 'sync-samples.mjs'));
    await copyFile(path.join(path.dirname(scriptPath), 'repos-root.mjs'), path.join(scripts, 'repos-root.mjs'));
    const fixture = { schemaVersion: 1, tracks: [], samples: [] };
    await writeFile(catalog, JSON.stringify(fixture));

    const result = spawnSync(process.execPath, [path.join(scripts, 'sync-samples.mjs')], {
        env: { ...process.env, CRATIS_SAMPLES_ROOT: '', CRATIS_REPOS_ROOT: root },
        encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Synced 0 samples/);
    assert.deepEqual(JSON.parse(await readFile(path.join(web, 'src/generated/samples.json'), 'utf8')), fixture);
});
