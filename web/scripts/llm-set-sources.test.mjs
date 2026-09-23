// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { citeRenderedSet, withoutSnippetSourceLinks } from './llm-set-sources.mjs';

const pages = [{ title: 'Events', url: 'https://www.cratis.io/chronicle/events/' }];
it('adds a source URL per page without mistaking fenced code for a page', () => {
    const content = '# Events\n\n```markdown\n# Example\n```\n';
    const result = citeRenderedSet(content, pages, 'events');
    assert.match(result, /^# Events\nSource: https:\/\/www\.cratis\.io\/chronicle\/events\//);
    assert.equal(citeRenderedSet(result, pages, 'events'), result);
});
it('drops per-tab snippet source links but keeps page citations and ordinary links', () => {
    const content = [
        '# Events',
        'Source: https://www.cratis.io/chronicle/events/',
        '```csharp',
        'eventLog.Append(id, @event);',
        '```',
        '  [View C# snippet source on GitHub](https://github.com/Cratis/Chronicle/blob/main/Documentation/client-snippets/events/append.md)',
        'Read [Event types](https://www.cratis.io/chronicle/events/types/) next.',
        '[View the sample on GitHub](https://github.com/Cratis/Samples/blob/main/README.md)',
        '',
    ].join('\n');
    const result = withoutSnippetSourceLinks(content);
    assert.doesNotMatch(result, /snippet source on GitHub/);
    assert.match(result, /^Source: https:\/\/www\.cratis\.io\/chronicle\/events\/$/m);
    assert.match(result, /\[Event types\]/);
    assert.match(result, /\[View the sample on GitHub\]/);
    assert.equal(withoutSnippetSourceLinks(result), result);
});

it('rejects ambiguous, repeated, missing and unrelated page headings', () => {
    assert.throws(() => citeRenderedSet('# Events', [...pages, ...pages], 'events'), /Ambiguous/);
    assert.throws(() => citeRenderedSet('# Events\n# Events', pages, 'events'), /Duplicate/);
    assert.throws(() => citeRenderedSet('filler', pages, 'events'), /Missing/);
    assert.throws(() => citeRenderedSet('# Unrelated', pages, 'events'), /Unexpected/);
});
