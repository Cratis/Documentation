// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { citeRenderedSet } from './llm-set-sources.mjs';

const pages = [{ title: 'Events', url: 'https://www.cratis.io/chronicle/events/' }];
it('adds a source URL per page without mistaking fenced code for a page', () => {
    const content = '# Events\n\n```markdown\n# Example\n```\n';
    const result = citeRenderedSet(content, pages, 'events');
    assert.match(result, /^# Events\nSource: https:\/\/www\.cratis\.io\/chronicle\/events\//);
    assert.equal(citeRenderedSet(result, pages, 'events'), result);
});
it('rejects ambiguous, repeated, missing and unrelated page headings', () => {
    assert.throws(() => citeRenderedSet('# Events', [...pages, ...pages], 'events'), /Ambiguous/);
    assert.throws(() => citeRenderedSet('# Events\n# Events', pages, 'events'), /Duplicate/);
    assert.throws(() => citeRenderedSet('filler', pages, 'events'), /Missing/);
    assert.throws(() => citeRenderedSet('# Unrelated', pages, 'events'), /Unexpected/);
});
