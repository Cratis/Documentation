// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Optional HTTP(S)-only link check via lychee (https://lychee.cli.rs).
// check-links.mjs separately hard-gates rendered local targets. External
// availability is advisory because rate limits and transient failures are common.

import { spawnSync } from 'node:child_process';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');

export const externalLinkArguments = [
    // Synced content is intentionally gitignored, but is the explicit input.
    '--config', '.lychee.toml', '--no-progress', '--no-ignore',
    '--root-dir', 'dist', '--scheme', 'http', '--scheme', 'https', '--',
    'src/content/docs/**/*.md', 'src/content/docs/**/*.mdx',
];

// `exists` is injectable so the checker's own behavior can be verified without
// depending on whether the site happens to have been built in this checkout.
export function checkExternalLinks({ run = spawnSync, cwd = webRoot, logger = console, exists = existsSync } = {}) {
    const probe = run('lychee', ['--version'], { cwd, stdio: 'ignore' });
    if (probe.error?.code === 'ENOENT') {
        logger.log('[check:external] lychee not installed — skipping (install from https://lychee.cli.rs to enable).');
        return 0;
    }
    if (probe.error || probe.signal || probe.status !== 0) {
        logger.error('[check:external] Could not execute lychee version probe.');
        return 1;
    }
    // Lychee resolves local references before applying its scheme filter. Supply
    // the built-site root so a local reference cannot become a spurious error.
    if (!exists(path.join(cwd, 'dist'))) {
        logger.error('[check:external] Built-site root is missing; build the site before checking external links.');
        return 1;
    }
    const result = run('lychee', externalLinkArguments, { cwd, stdio: 'inherit' });
    // Lychee reports checked-but-broken links with exit 2. Input/operational
    // failures (1) and configuration failures (3) did not complete the check.
    if (result.error || result.signal || (result.status !== 0 && result.status !== 2)) {
        logger.error('[check:external] lychee could not complete the external-link check.');
        return 1;
    }
    if (result.status === 2) {
        logger.log('[check:external] lychee reported external-link check failures (advisory — not failing the build).');
    }
    return 0;
}

if (process.argv[1] && await fs.realpath(process.argv[1]) === await fs.realpath(fileURLToPath(import.meta.url))) {
    process.exitCode = checkExternalLinks();
}
