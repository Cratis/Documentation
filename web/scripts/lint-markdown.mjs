// Fail-closed markdownlint pass for exact-production plain Markdown.
// MDX is validated by Astro/Starlight and rendered-link checks instead.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const binName = process.platform === 'win32' ? 'markdownlint-cli2.cmd' : 'markdownlint-cli2';
const localBin = path.join(webRoot, 'node_modules', '.bin', binName);

if (!existsSync(localBin)) {
    console.error('[lint:markdown] local markdownlint-cli2 is missing; run npm ci');
    process.exit(1);
}

const result = spawnSync(localBin, [], {
    cwd: webRoot,
    stdio: 'inherit',
    shell: false,
});

if (result.error) {
    console.error(`[lint:markdown] failed to start markdownlint-cli2: ${result.error.message}`);
    process.exit(1);
}
if (result.status === null) {
    console.error('[lint:markdown] markdownlint-cli2 exited without a status');
    process.exit(1);
}
process.exit(result.status);
