// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { PAGE_MARKER, PAGE_SEPARATOR, SIZE_WARNINGS, budgetResult, compactFullText, isLogPage, sizeWarnings, withoutExcludedPages, withoutPageMarkers } from './llm-bulk.mjs';

describe('LLM export budgets', () => {
    it('allows missing exports and exports at or below each byte budget even when enforced', () => {
        assert.deepEqual(budgetResult(new Map(), true), { exceeded: [], failed: false });
        for (const { route, bytes } of SIZE_WARNINGS) {
            for (const size of [bytes - 1, bytes]) {
                assert.deepEqual(budgetResult(new Map([[route, size]]), true), { exceeded: [], failed: false });
            }
        }
    });

    it('returns each exceeded budget with actual and allowed bytes, failing only when enforced', () => {
        const sizes = new Map(SIZE_WARNINGS.map(({ route, bytes }) => [route, bytes + 1]));
        const exceeded = [
            { route: '/llms-small.txt', bytes: 400_001, budgetBytes: 400_000 },
            { route: '/llms-full.txt', bytes: 17_000_001, budgetBytes: 17_000_000 },
        ];
        assert.deepEqual(budgetResult(sizes), { exceeded, failed: false });
        assert.deepEqual(budgetResult(sizes, true), { exceeded, failed: true });
        assert.equal(sizeWarnings(sizes).length, 2);
        assert.ok(sizeWarnings(sizes).every(message => message.startsWith('::warning title=LLM export size::')));
    });
});

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

describe('full export compaction', () => {
    it('drops section anchor lines and collapses table padding outside code', () => {
        const input = '## Title\n\n[Section titled “Title”](#title)\n\nText\n\n| A    | B      |\n| ---- | ------ |\n| x    | y      |\n';
        assert.equal(compactFullText(input), '## Title\n\nText\n\n| A | B |\n| --- | --- |\n| x | y |\n');
    });

    it('keeps spaces and dashes inside table cells', () => {
        const input = '| `a  b`    | `----`  |\n| :---- | -----: |\n| x\\|  y | z |';
        assert.equal(compactFullText(input), '| `a  b` | `----` |\n| :--- | ---: |\n| x\\|  y | z |');
    });

    it('leaves tilde and longer fences untouched', () => {
        const code = '~~~\n| A    |\n~~~\n````md\n```\n| B    |\n```\n````\n| c  |';
        assert.equal(compactFullText(code), '~~~\n| A    |\n~~~\n````md\n```\n| B    |\n```\n````\n| c |');
    });

    it('leaves fenced code untouched', () => {
        const code = '```text\n| A    | B |\n[Section titled “X”](#x)\n```\n| a  | b |';
        assert.equal(compactFullText(code), '```text\n| A    | B |\n[Section titled “X”](#x)\n```\n| a | b |');
    });
});
