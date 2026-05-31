// Optional Vale prose lint. Runs Vale (https://vale.sh) over the built content when
// the binary is installed, and skips gracefully when it isn't — so this never breaks
// `npm run check` in an environment without Vale (CI installs it; local may not).
//
// Vale's richer style analysis (Microsoft Writing Style Guide + the house Cratis
// vocabulary) complements the always-on structural checks in lint-docs.mjs.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const target = path.join('src', 'content', 'docs');

function has(bin) {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'command', ['-v', bin], {
        shell: true,
        stdio: 'ignore',
    });
    return probe.status === 0;
}

if (!has('vale')) {
    console.log('[lint:prose] Vale not installed — skipping (install from https://vale.sh to enable).');
    process.exit(0);
}

// Make sure the Microsoft style package is present; `vale sync` is idempotent.
spawnSync('vale', ['sync'], { cwd: webRoot, stdio: 'inherit' });

const result = spawnSync('vale', [target], { cwd: webRoot, stdio: 'inherit' });
// Vale exits non-zero when it finds error-level alerts. We keep prose alerts advisory
// (the config sets MinAlertLevel=suggestion), so report but don't fail the gate.
if (result.status && result.status !== 0) {
    console.log('[lint:prose] Vale reported style suggestions (advisory — not failing the build).');
}
process.exit(0);
