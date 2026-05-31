// Optional external-link check via lychee (https://lychee.cli.rs). Runs when the binary is
// installed and skips gracefully otherwise — so it never breaks `npm run check`. Mirrors the
// optional Vale layer in lint-prose.mjs.
//
// check-links.mjs already HARD-GATES internal links; this complements it by flagging dead
// EXTERNAL URLs. External checks can be flaky (rate limits, transient network), so this is
// ADVISORY — it reports but never fails the gate. Config lives in .lychee.toml.

import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');

function has(bin) {
    const probe = spawnSync(process.platform === 'win32' ? 'where' : 'command', ['-v', bin], {
        shell: true,
        stdio: 'ignore',
    });
    return probe.status === 0;
}

if (!has('lychee')) {
    console.log('[check:external] lychee not installed — skipping (install from https://lychee.cli.rs to enable).');
    process.exit(0);
}

const result = spawnSync(
    'lychee',
    ['--config', '.lychee.toml', '--no-progress', 'src/content/docs/**/*.md', 'src/content/docs/**/*.mdx'],
    { cwd: webRoot, stdio: 'inherit' },
);
if (result.status && result.status !== 0) {
    console.log('[check:external] lychee found unreachable external links (advisory — not failing the build).');
}
process.exit(0);
