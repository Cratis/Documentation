// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import yaml from 'js-yaml';
import { loadVariantDocsConfig, webRoot, variantDocsManifestPath } from './variant-docs-config.mjs';
import { fenceRangesAndLanguages } from './variant-docs-fences.mjs';
import { countProductFences } from './variant-docs-product-fences.mjs';
import { compareFenceBaseline } from './variant-docs-site-audit.mjs';

const axis = (await loadVariantDocsConfig()).getAxis('arc', 'backend');
const scope = 'arc/backend';
const page = 'upgrading/secure-defaults.md';
const code = (value) => `\`\`\`csharp\n${value}\n\`\`\`\n`;
const fences = (body) => fenceRangesAndLanguages(body, page, axis.ratchetLanguageAliases, { includeValue: true }).fences;
const body = axis.exemptFences.map((entry) => code(entry.contains)).join('\n');
const audit = (text, exemptions = axis.exemptFences) => countProductFences(new Map([[page, fences(text)]]), exemptions, scope);

test('the two .NET-only migration examples are exempt, without raising the shared baseline', () => {
    assert.equal(axis.exemptFences.length, 2);
    assert.ok(axis.exemptFences.every((entry) => entry.page === page && entry.reason));
    const result = audit(body);
    assert.deepEqual(result.problems, []);
    assert.equal(result.exemptedFences, 2);
    assert.equal(result.directFences.size, 0);
});

test('additional shared-language fences still fail the zero baseline', () => {
    const result = audit(body + '\n' + code('var shared = 1;'));
    assert.deepEqual(result.problems, []);
    assert.deepEqual(compareFenceBaseline(Object.fromEntries(result.directFences), {}),
        [`${page}: csharp fences increased from 0 to 1`]);
});

test('missing, moved, changed-language and ambiguous exempt fences fail closed', () => {
    const missing = audit('No examples.');
    assert.equal(missing.problems.length, 2);
    assert.match(missing.problems[0], /remove the stale exemption/);
    const moved = countProductFences(new Map(), axis.exemptFences, scope);
    assert.equal(moved.problems.length, 2);
    assert.match(moved.problems[0], /not an audited shared page/);
    assert.equal(audit(body.replaceAll('```csharp', '```json')).problems.length, 2);
    const ambiguous = audit(body + '\n' + code(axis.exemptFences[0].contains));
    assert.match(ambiguous.problems.join('\n'), /has 2 csharp fences/);
    assert.equal(ambiguous.directFences.get(page).csharp, 2);
});

test('a product exemption must explain its reason', async (context) => {
    const root = await mkdtemp(path.join(webRoot, '../.ai-work/product-fences-'));
    context.after(() => rm(root, { recursive: true, force: true }));
    const manifest = yaml.load(await readFile(variantDocsManifestPath, 'utf8'));
    manifest.products.arc.axes.backend.exemptFences[0].reason = ' ';
    const manifestPath = path.join(root, 'variant-docs.yml');
    await writeFile(manifestPath, yaml.dump(manifest));
    await assert.rejects(loadVariantDocsConfig({ manifestPath }), /exemptFences\[0\].reason must explain why/);
});
