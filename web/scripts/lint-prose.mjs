// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Optional Vale prose lint. Missing Vale skips; genuine prose alerts remain
// advisory. Execution/configuration failures are blockers, not style advice.

import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');

export function lintProse({ run = spawnSync, cwd = webRoot, logger = console } = {}) {
    function failed(result, phase) {
        if (!result.error && !result.signal && result.status === 0) return false;
        const detail = result.error?.message ?? result.signal ?? `exit ${result.status}`;
        logger.error(`[lint:prose] Vale ${phase} failed (${detail}); prose lint did not complete.`);
        return true;
    }

    const probe = run('vale', ['--version'], { cwd, stdio: 'ignore' });
    if (probe.error?.code === 'ENOENT') {
        logger.log('[lint:prose] Vale not installed — skipping (install from https://vale.sh to enable).');
        return 0;
    }
    if (failed(probe, 'version probe')) return 1;

    // Make sure the Microsoft style package is present; never lint after a
    // failed sync with an incomplete or stale configuration.
    const sync = run('vale', ['sync'], { cwd, stdio: 'inherit' });
    if (failed(sync, 'style sync')) return 1;

    // --no-exit makes *alerts* advisory without masking CLI/configuration errors.
    // Keep Vale's complete human-readable diagnostics on stdout/stderr.
    const result = run('vale', ['--no-exit', path.join('src', 'content', 'docs')], { cwd, stdio: 'inherit' });
    if (failed(result, 'execution/configuration')) return 1;
    logger.log('[lint:prose] Vale completed (prose alerts are advisory).');
    return 0;
}

if (process.argv[1] && await fs.realpath(process.argv[1]) === await fs.realpath(fileURLToPath(import.meta.url))) {
    process.exitCode = lintProse();
}
