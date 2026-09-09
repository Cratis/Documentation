// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { verifyApiLinks } from './verify-api-links.mjs';

const scratch = path.resolve(import.meta.dirname, '../../.ai-work/docs-readiness/api-link-tests');
let directory;

function page(filename, content) {
    const target = path.join(directory, filename);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, content);
    return target;
}

beforeEach(() => {
    mkdirSync(scratch, { recursive: true });
    directory = mkdtempSync(path.join(scratch, 'case-'));
});

afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('when verifying generated API links', () => {
    it('accepts relative, root-relative, encoded, and fragment targets', () => {
        page('index.html', '<a href="types/a%20type.html?view=full&amp;lang=en#member">Type</a><a href="/api/types/">Index</a>');
        page('types/a type.html', '<h2 id="member">Member</h2><a href="#member">Member</a>');
        page('types/index.html', '<h1>Types</h1>');
        const result = verifyApiLinks(directory);
        assert.equal(result.pages, 3);
        assert.equal(result.checked, 3);
        assert.deepEqual(result.issues, []);
    });

    it('reports a missing file without deleting its hyperlink', () => {
        const original = '<a class="member" href="missing.html">Missing member</a>';
        const filename = page('index.html', original);
        const result = verifyApiLinks(directory);
        assert.equal(result.issues.length, 1);
        assert.equal(result.issues[0].href, 'missing.html');
        assert.equal(result.issues[0].reason, 'Missing generated target');
        assert.equal(readFileSync(filename, 'utf8'), original);
    });

    it('reports a missing anchor even when its page exists', () => {
        page('index.html', '<a href="type.html#missing">Member</a>');
        page('type.html', '<h1 id="type">Type</h1>');
        const result = verifyApiLinks(directory);
        assert.equal(result.issues.length, 1);
        assert.equal(result.issues[0].reason, 'Missing generated anchor');
    });

    for (const [description, markup] of [
        ['a meta name', '<meta name="missing">'],
        ['an attribute suffix', '<div data-id="missing"></div>'],
        ['a comment', '<!-- <div id="missing"></div> -->'],
        ['escaped markup', '&lt;div id="missing"&gt;'],
        ['an attribute value', '<div title=\'<div id="missing">\'></div>'],
        ['script text', '<script>const markup = \'<div id="missing">\';</script>'],
        ['style text', '<style>/* <div id="missing"> */</style>'],
        ['textarea text', '<textarea><div id="missing"></textarea>'],
    ]) {
        it(`reports a missing anchor represented only by ${description}`, () => {
            page('index.html', '<a href="type.html#missing">Member</a>');
            page('type.html', markup);
            const result = verifyApiLinks(directory);
            assert.equal(result.issues.length, 1);
            assert.equal(result.issues[0].reason, 'Missing generated anchor');
        });
    }

    it('accepts quoted, unquoted, legacy, and entity-encoded real anchors', () => {
        const anchors = ['double', 'single', 'bare', 'legacy', 'A&B<>"\'', 'numeric\u{1f600}'];
        page('index.html', anchors.map(anchor => `<a href="type.html#${encodeURIComponent(anchor)}">Member</a>`).join(''));
        page('type.html', `<h2 id="double"></h2><h2 id='single'></h2><h2 ID=bare></h2><A NAME=legacy></A>
            <div id="A&amp;B&lt;&gt;&quot;&apos;"></div><div id=numeric&#x1f600;></div>`);
        const result = verifyApiLinks(directory);
        assert.equal(result.checked, anchors.length);
        assert.deepEqual(result.issues, []);
    });

    it('reports missing resources as well as hyperlinks', () => {
        page('index.html', '<script src="missing.js"></script><img src="missing.png">');
        assert.equal(verifyApiLinks(directory).issues.length, 2);
    });

    it('defers narrative-site links explicitly and leaves external links alone', () => {
        page('index.html', '<a href="/">Docs</a><a href="/arc/">Arc</a><a href="https://example.com/">External</a><a href="mailto:docs@example.com">Mail</a>');
        const result = verifyApiLinks(directory);
        assert.equal(result.deferredSiteLinks, 2);
        assert.equal(result.checked, 0);
        assert.deepEqual(result.issues, []);
    });

    it('reports malformed URL encoding rather than skipping it', () => {
        page('index.html', '<a href="broken%ZZ.html">Broken</a>');
        assert.equal(verifyApiLinks(directory).issues[0].reason, 'Invalid URL encoding');
    });

    it('rejects empty generated output', () => {
        assert.throws(() => verifyApiLinks(directory), /no HTML pages/);
    });

    it('rejects symbolic links rather than following them outside the output', () => {
        const target = page('index.html', '<h1>API</h1>');
        symlinkSync(target, path.join(directory, 'linked.html'));
        assert.throws(() => verifyApiLinks(directory), /symbolic link/);
    });
});
