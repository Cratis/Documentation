// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { it } from 'node:test';
import { PRODUCTS } from './sync-content.mjs';
import { LLM_FAMILIES, familyOf, familyRoute } from './llm-families.mjs';

it('assigns every product to exactly one family without unknown products', () => {
    const assigned = LLM_FAMILIES.flatMap(family => family.products);
    assert.deepEqual([...assigned].sort(), PRODUCTS.map(product => product.key).sort());
    for (const { key } of PRODUCTS) {
        assert.equal(LLM_FAMILIES.filter(family => family.products.includes(key)).length, 1, key);
        assert.ok(familyOf(key), key);
    }
});

it('resolves nested and model-first products by their exact keys', () => {
    assert.equal(familyOf('chronicle/go').id, 'chronicle');
    assert.equal(familyOf('eventmodelers-ai/java').id, 'tooling');
    assert.equal(familyOf('screenplay').id, 'screenplay-stage');
    assert.equal(familyOf('unknown'), undefined);
});

it('uses unique safe family ids and routes distinct from every product download', () => {
    assert.equal(new Set(LLM_FAMILIES.map(family => family.id)).size, 6);
    for (const { id } of LLM_FAMILIES) {
        assert.match(id, /^[a-z0-9-]+$/);
        assert.equal(familyRoute(id), `/families/${id}/llms-full.txt`);
        assert.ok(!PRODUCTS.some(product => familyRoute(id) === `/${product.key}/llms-full.txt`));
    }
});
