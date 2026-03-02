import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = resolve(currentDir, 'index.html');
const indexMdPath = resolve(currentDir, 'index.md');

const frontMatter = `---
title: Home
_disableToc: true
_disableAffix: true
_disableBreadcrumb: true
_disableContribution: true
---\n\n`;

const html = await readFile(indexHtmlPath, 'utf8');
const normalizedHtml = html
	.split('\n')
	.map((line) => line.trimStart())
	.join('\n');
const output = `${frontMatter}${normalizedHtml.endsWith('\n') ? normalizedHtml : `${normalizedHtml}\n`}`;

await writeFile(indexMdPath, output, 'utf8');
console.log('Synced index.html -> index.md');
