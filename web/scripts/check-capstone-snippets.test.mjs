// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkCapstoneSnippets } from './check-capstone-snippets.mjs';
import { resolveRepoCandidate } from './repos-root.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(webRoot, 'src/content/docs/build-a-full-app.mdx');

// docs-site.yml checks out Samples beside Documentation; local worktrees can set CRATIS_SAMPLES_ROOT.
test('Arc C# capstone snippets and shared TSX fences match the buildable Samples checkout', async () => {
    await checkCapstoneSnippets();
});

test('missing backend tabs, C# snippet drift and frontend fence drift fail the check', async t => {
    const pageSource = await readFile(pagePath, 'utf8');
    const missing = pageSource.replace('<ArcBackendTabs snippet="capstone/author-id" />', 'No author id tab');
    assert.notEqual(missing, pageSource);
    await assert.rejects(checkCapstoneSnippets({ pageSource: missing }), /Expected ordered capstone backend tabs/);

    const extraCsharp = pageSource + '\n```csharp\nvar unexpected = true;\n```\n';
    await assert.rejects(checkCapstoneSnippets({ pageSource: extraCsharp }), /Expected 3 TSX capstone fences and no C# fences/);

    const frontendDrift = pageSource.replace('initialValues={{ id: Guid.create() }}', 'initialValues={{ id: Guid.empty }}');
    assert.notEqual(frontendDrift, pageSource);
    await assert.rejects(checkCapstoneSnippets({ pageSource: frontendDrift }), /differs from Capstone\/Authors\/AddAuthor.tsx/);

    const routeDrift = pageSource.replace("<Route path='/authors' element={<Authors />} />", "<Route path='/writers' element={<Authors />} />");
    assert.notEqual(routeDrift, pageSource);
    await assert.rejects(checkCapstoneSnippets({ pageSource: routeDrift }), /differs from Capstone\/App.tsx/);

    const root = await mkdtemp(path.join(os.tmpdir(), 'cratis-capstone-drift-'));
    t.after(() => rm(root, { recursive: true, force: true }));
    const sourceRoot = path.join(resolveRepoCandidate(webRoot, '../../Arc'), 'Documentation/client-snippets/capstone');
    const destination = path.join(root, 'Documentation/client-snippets/capstone');
    await mkdir(destination, { recursive: true });
    for (const name of ['host', 'author-id', 'register-author', 'author-read-model']) {
        const snippet = await readFile(path.join(sourceRoot, `${name}.md`), 'utf8');
        await writeFile(path.join(destination, `${name}.md`),
            name === 'author-id' ? snippet.replace('public record AuthorId(Guid Value)', 'public record AuthorId(string Value)') : snippet);
    }
    await assert.rejects(checkCapstoneSnippets({ arcRoot: root }), /Arc capstone\/author-id differs from Capstone\/Authors\/AuthorId.cs/);
});

test('capstone check cannot silently skip an unavailable Samples or Arc checkout', async () => {
    await assert.rejects(checkCapstoneSnippets({ samplesRoot: path.join(webRoot, 'missing-samples') }), /ENOENT/);
    await assert.rejects(checkCapstoneSnippets({ arcRoot: path.join(webRoot, 'missing-arc') }), /ENOENT/);
});
