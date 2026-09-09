// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Build the supported composed Storybook, including every renderer, before
// replacing the documentation site's local bundle. This does not deploy it.
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';

const web = path.resolve(import.meta.dirname, '..');
const components = path.resolve(web, '../../Components');
const source = path.join(components, 'Source/storybook-static');
const destination = path.join(web, 'public/storybook');

for (const command of [
    ['workspace', '@cratis/components', 'build-storybook'],
    ['workspace', '@cratis/components.storybook', 'verify-indexes'],
]) {
    console.log(`\n+ yarn ${command.join(' ')}`);
    execFileSync('yarn', command, { cwd: components, stdio: 'inherit' });
}
if (!existsSync(path.join(source, 'index.html'))) throw new Error('The Components Storybook manager was not generated.');

const scratch = path.resolve(web, '../.ai-work/storybook-build');
mkdirSync(scratch, { recursive: true });
const staging = mkdtempSync(path.join(scratch, 'components-'));
const next = path.join(staging, 'next');
const previous = path.join(staging, 'previous');
cpSync(source, next, { recursive: true });
mkdirSync(path.dirname(destination), { recursive: true });
const hadPreviousOutput = existsSync(destination);
if (hadPreviousOutput) renameSync(destination, previous);
try {
    renameSync(next, destination);
} catch (error) {
    if (hadPreviousOutput) renameSync(previous, destination);
    throw error;
}
rmSync(staging, { recursive: true, force: true });
console.log('\nComplete Components Storybook copied to web/public/storybook.');
