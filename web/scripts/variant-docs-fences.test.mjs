// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { loadVariantDocsConfig } from './variant-docs-config.mjs';
import { fenceRangesAndLanguages } from './variant-docs-fences.mjs';

const aliases = (await loadVariantDocsConfig()).getAxis('chronicle', 'client').ratchetLanguageAliases;
const audit = (body, ext = 'mdx') => fenceRangesAndLanguages(body, `example.${ext}`, aliases);

test('counts a client-language fence nested in a list item', () => {
    const body = '- Example:\n\n  ```csharp\n  var value = 1;\n  ```\n';
    assert.deepEqual(audit(body, 'md').fences, [{ line: 3, lang: 'csharp' }]);
});

test('counts a client-language fence nested in a blockquote', () => {
    const body = '> ```kotlin\n> val value = 1\n> ```\n';
    assert.deepEqual(audit(body, 'md').fences, [{ line: 1, lang: 'kotlin' }]);
});

test('counts a client-language fence inside an MDX component', () => {
    const body = '<Steps>\n\n```typescript\nconst value = 1;\n```\n\n</Steps>\n';
    assert.deepEqual(audit(body).fences, [{ line: 3, lang: 'typescript' }]);
});

test('distinguishes Markdown indented code from an MDX indented fence', () => {
    const body = '    ```csharp\n    var value = 1;\n    ```\n';
    assert.deepEqual(audit(body, 'md').fences, []);
    assert.deepEqual(audit(body).fences, [{ line: 1, lang: 'csharp' }]);
});

test('folds language aliases from the manifest', () => {
    const body = '```C#\nclass C {}\n```\n\n~~~kt\nval x = 1\n~~~\n\n```tsx\nconst x = 1;\n```\n';
    assert.deepEqual(audit(body).fences, [
        { line: 1, lang: 'csharp' },
        { line: 5, lang: 'kotlin' },
        { line: 9, lang: 'typescript' },
    ]);
});

test('does not count a non-client fence, but excludes macros inside code', () => {
    const macro = '<ChronicleClientTabs snippet="missing" />';
    const body = `\`\`\`json\n${macro}\n\`\`\`\n\n${macro}\n`;
    const { ranges, fences } = audit(body);
    assert.deepEqual(fences, []);
    assert.equal(ranges.some(({ start, end }) => start <= body.indexOf(macro) && body.indexOf(macro) <= end), true);
    assert.equal(ranges.some(({ start, end }) => start <= body.lastIndexOf(macro) && body.lastIndexOf(macro) <= end), false);
});

test('preserves the MDX expression exclusion range for macro checks', () => {
    const macro = '<ChronicleClientTabs snippet="missing" />';
    const body = `{/*\n${macro}\n*/}\n\n\`\`\`csharp\nclass C {}\n\`\`\`\n`;
    const { ranges, fences } = audit(body);
    assert.deepEqual(fences, [{ line: 5, lang: 'csharp' }]);
    assert.equal(ranges.some(({ start, end }) => start <= body.indexOf(macro) && body.indexOf(macro) <= end), true);
});

test('masks YAML frontmatter without shifting fence lines or ranges', () => {
    const body = '---\ndescription: "Uses IProjectionFor<T>"\n---\n\n```cs\nclass C {}\n```\n';
    assert.deepEqual(audit(body).fences, [{ line: 5, lang: 'csharp' }]);
});

test('parse errors name the source file', () => {
    assert.throws(() => audit('<Steps>\n{bad\n</Steps>'), /Failed to parse example\.mdx:/);
});

test('counts a fence whose info string carries highlight or title metadata', () => {
    const body = '```csharp{1,3}\nvar a = 1;\n```\n\n```cs,title\nvar b = 2;\n```\n\n```csharp:Program.cs\nvar c = 3;\n```\n';
    assert.deepEqual(audit(body).fences, [
        { line: 1, lang: 'csharp' },
        { line: 5, lang: 'csharp' },
        { line: 9, lang: 'csharp' },
    ]);
});

test('masks frontmatter closed by a delimiter with trailing whitespace', () => {
    const body = '---\ndescription: Uses IProjectionFor<T>\n---   \n\n```csharp\nvar value = 1;\n```\n';
    assert.deepEqual(audit(body).fences, [{ line: 5, lang: 'csharp' }]);
});
