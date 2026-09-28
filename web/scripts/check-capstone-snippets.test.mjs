// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { checkCapstoneSnippets } from './check-capstone-snippets.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pagePath = path.join(webRoot, 'src/content/docs/build-a-full-app.mdx');

// docs-site.yml checks out Samples beside Documentation; local worktrees can set CRATIS_SAMPLES_ROOT.
test('every C# and TSX capstone fence matches the buildable Samples checkout', async () => {
    await checkCapstoneSnippets();
});

test('capstone fence drift and missing fences fail the check', async () => {
    const pageSource = await readFile(pagePath, 'utf8');
    const drift = pageSource.replace('public record AuthorId(Guid Value)', 'public record AuthorId(string Value)');
    assert.notEqual(drift, pageSource);
    await assert.rejects(checkCapstoneSnippets({ pageSource: drift }), /differs from Capstone\/Authors\/AuthorId.cs/);

    const frontendDrift = pageSource.replace('initialValues={{ id: Guid.create() }}', 'initialValues={{ id: Guid.empty }}');
    assert.notEqual(frontendDrift, pageSource);
    await assert.rejects(checkCapstoneSnippets({ pageSource: frontendDrift }), /differs from Capstone\/Authors\/AddAuthor.tsx/);

    const routeDrift = pageSource.replace("<Route path='/authors' element={<Authors />} />", "<Route path='/writers' element={<Authors />} />");
    assert.notEqual(routeDrift, pageSource);
    await assert.rejects(checkCapstoneSnippets({ pageSource: routeDrift }), /differs from Capstone\/App.tsx/);

    const missing = pageSource.replace('```csharp\n   public record AuthorId', '```text\n   public record AuthorId');
    assert.notEqual(missing, pageSource);
    await assert.rejects(checkCapstoneSnippets({ pageSource: missing }), /Expected 7 C#\/TSX capstone fences; found 6/);
});

test('capstone check cannot silently skip an unavailable Samples checkout', async () => {
    await assert.rejects(checkCapstoneSnippets({ samplesRoot: path.join(webRoot, 'missing-samples') }), /ENOENT/);
});
