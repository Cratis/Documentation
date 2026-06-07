// Optional markdownlint pass. Runs markdownlint-cli2 over the synced Markdown when it's
// installed, and skips gracefully when it isn't — so it never breaks `npm run check` in an
// environment without it (CI installs it; local may not). Mirrors the optional Vale layer
// in lint-prose.mjs. Advisory: reports structural issues but does not fail the gate.
//
// Configuration lives in .markdownlint-cli2.jsonc. To enable locally: `npm i -D markdownlint-cli2`.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const binName = process.platform === 'win32' ? 'markdownlint-cli2.cmd' : 'markdownlint-cli2';
const localBin = path.join(webRoot, 'node_modules', '.bin', binName);

function globalHas(bin) {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'command', ['-v', bin], {
        shell: true,
        stdio: 'ignore',
    });
    return probe.status === 0;
}

const cmd = existsSync(localBin) ? localBin : (globalHas('markdownlint-cli2') ? 'markdownlint-cli2' : null);

if (!cmd) {
    console.log('[lint:markdown] markdownlint-cli2 not installed — skipping (run `npm i -D markdownlint-cli2` to enable).');
    process.exit(0);
}

// markdownlint-cli2 reads .markdownlint-cli2.jsonc (globs + rules) automatically.
const result = spawnSync(cmd, [], { cwd: webRoot, stdio: 'inherit', shell: true });
if (result.status && result.status !== 0) {
    console.log('[lint:markdown] markdownlint reported issues (advisory — not failing the build).');
}
process.exit(0);
