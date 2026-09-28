// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
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
    assert.doesNotMatch(result.stderr, /Documentation\/web\/\.\.\/Samples/);
    assert.doesNotMatch(result.stdout, /Synced/);
});
