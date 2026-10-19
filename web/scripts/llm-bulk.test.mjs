// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PAGE_MARKER, PAGE_SEPARATOR, isLogPage, withoutExcludedPages, withoutPageMarkers } from './llm-bulk.mjs';

describe('log page detection', () => {
    it('matches release digests and changelog pages', () => {
        for (const slug of ['release-digests', 'release-digests/2026-09-28-to-2026-10-05', 'chronicle/changelog', 'changelogs'])
            assert.ok(isLogPage(slug), slug);
    });

    it('keeps ordinary documentation about releases', () => {
        for (const slug of ['fundamentals/go/releases', 'arc/backend/typescript/contributing/releases', 'contributing/consuming-pre-releases',
            'screenplay/screens-release-acceptance', 'chronicle/release-process', 'chronicle/changelog-format'])
            assert.ok(!isLogPage(slug), slug);
    });
});

describe('exclusion helpers', () => {
    it('drops only segments whose title belongs solely to excluded pages', () => {
        const content = `# Keep\n\nx${PAGE_SEPARATOR}# Shared\n\nkept${PAGE_SEPARATOR}# Digest\n\ny\n`;
        const pages = [{ title: 'Keep' }, { title: 'Shared' }, { title: 'Shared', excluded: true }, { title: 'Digest', excluded: true }];
        const out = withoutExcludedPages(content, pages);
        assert.ok(out.includes('# Keep') && out.includes('# Shared') && !out.includes('# Digest'));
    });

    it('returns content unchanged when nothing is excluded, and removes markers', () => {
        assert.equal(withoutExcludedPages('a', [{ title: 'A' }]), 'a');
        assert.equal(withoutPageMarkers(`a${PAGE_SEPARATOR}b${PAGE_MARKER}`), 'a\n\nb');
    });
});
