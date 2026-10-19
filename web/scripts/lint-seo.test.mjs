// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { analyse, compare } from './lint-seo.mjs';

describe('SEO lint', () => {
    const pages = [
        { file: 'a.md', data: { title: 'Events', description: 'Real description of the events page.' } },
        { file: 'b/index.md', data: { title: 'Events', description: 'Events in the Chronicle documentation for Cratis.' } },
        { file: 'd.md', data: { title: 'No description' } },
        { file: 'c.md', data: { title: 'Draft', draft: true } },
        { file: '404.md', data: { title: '404' } },
    ];

    it('finds fallback and missing descriptions, skipping drafts and 404', () => {
        assert.deepEqual(analyse(pages).missingDescription, ['b/index.md', 'd.md']);
    });

    it('warns above the baseline, asks to lower it below, and is quiet at the baseline', () => {
        assert.deepEqual(compare({ missingDescription: 3 }, { missingDescription: 2 }).map(m => m.level), ['warning']);
        assert.deepEqual(compare({ missingDescription: 3 }, { missingDescription: 5 }).map(m => m.level), ['notice']);
        assert.deepEqual(compare({ missingDescription: 3 }, { missingDescription: 3 }), []);
    });
});
