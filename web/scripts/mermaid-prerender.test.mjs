// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { makeResponsive } from './mermaid-prerender.mjs';

test('responsive Mermaid dimensions come from the width and height of a viewBox with fractional origins', () => {
    const svg = '<svg viewBox="0 0.000003814697265625 1234.3125 84.09991455078125" width="1234" height="84" style="max-width: 1234px;"></svg>';

    const responsive = makeResponsive(svg);

    assert.match(responsive, /width="100%"/);
    assert.match(responsive, /max-width:1235px/);
    assert.match(responsive, /aspect-ratio:1234\.3125\/84\.09991455078125/);
    assert.doesNotMatch(responsive, /height="84"/);
});

test('responsive Mermaid dimensions support negative and nonzero viewBox origins', () => {
    const svg = '<svg viewBox="-0.5 2.25 934 1301.8656005859375"></svg>';

    const responsive = makeResponsive(svg);

    assert.match(responsive, /max-width:934px/);
    assert.match(responsive, /aspect-ratio:934\/1301\.8656005859375/);
});

test('invalid Mermaid viewBox dimensions are left unchanged', () => {
    const svg = '<svg viewBox="0 0 0 84" width="100%"></svg>';

    assert.equal(makeResponsive(svg), svg);
});
