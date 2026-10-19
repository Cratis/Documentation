// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { execFileSync } from 'node:child_process';
import path from 'node:path';

const shallowByRoot = new Map();

function git(cwd, args) {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/**
 * Date of the last commit that touched a source file, as `YYYY-MM-DD`.
 *
 * Returns undefined when the file is not in a git repository or the repository is a shallow
 * clone: every file would then report the tip commit's date, which is not when it changed.
 */
export function sourceLastModified(file, run = git) {
    if (!file) return undefined;
    const cwd = path.dirname(path.resolve(file));
    try {
        const root = run(cwd, ['rev-parse', '--show-toplevel']);
        if (!shallowByRoot.has(root)) shallowByRoot.set(root, run(root, ['rev-parse', '--is-shallow-repository']) !== 'false');
        if (shallowByRoot.get(root)) return undefined;
        const date = run(cwd, ['log', '-1', '--format=%cs', '--', path.basename(file)]);
        return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
    } catch {
        return undefined;
    }
}
