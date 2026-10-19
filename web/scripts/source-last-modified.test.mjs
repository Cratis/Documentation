// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { sourceLastModified } from './source-last-modified.mjs';

const runner = (shallow, date) => (cwd, args) => {
    if (args[0] === 'rev-parse' && args[1] === '--show-toplevel') return `/repo-${shallow}`;
    if (args[0] === 'rev-parse') return String(shallow);
    return date;
};

describe('source last modified', () => {
    it('returns the last commit date of a full clone', () => {
        assert.equal(sourceLastModified('/repo-false/Documentation/a.md', runner(false, '2026-03-04')), '2026-03-04');
    });

    it('does not guess from a shallow clone', () => {
        assert.equal(sourceLastModified('/repo-true/Documentation/a.md', runner(true, '2026-03-04')), undefined);
    });

    it('ignores files without history and non-git folders', () => {
        assert.equal(sourceLastModified('/repo-false/x/new.md', runner(false, '')), undefined);
        assert.equal(sourceLastModified('/nowhere/a.md', () => { throw new Error('not a repo'); }), undefined);
        assert.equal(sourceLastModified(undefined), undefined);
    });
});
