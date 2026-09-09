// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { checkExternalLinks } from './check-external-links.mjs';

function check(status) {
    let invocation = 0;
    const messages = [];
    const result = checkExternalLinks({
        run: () => ({ status: invocation++ === 0 ? 0 : status }),
        logger: { log: message => messages.push(message), error: message => messages.push(message) },
        exists: () => true,
    });
    return { result, messages };
}

describe('when lychee reports its execution outcome', () => {
    it('keeps checked but unavailable links advisory', () => {
        const outcome = check(2);
        assert.equal(outcome.result, 0);
        assert.match(outcome.messages[0], /advisory/);
    });

    it('fails when input processing did not complete', () => {
        const outcome = check(1);
        assert.equal(outcome.result, 1);
        assert.ok(outcome.messages.every(message => !message.includes('advisory')));
    });

    it('fails on configuration errors', () => {
        const outcome = check(3);
        assert.equal(outcome.result, 1);
        assert.ok(outcome.messages.every(message => !message.includes('advisory')));
    });

    it('fails when the built site is missing rather than checking against nothing', () => {
        const messages = [];
        const result = checkExternalLinks({
            run: () => ({ status: 0 }),
            logger: { log: message => messages.push(message), error: message => messages.push(message) },
            exists: () => false,
        });
        assert.equal(result, 1);
        assert.match(messages[0], /Built-site root is missing/);
    });
});
