// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import yaml from 'js-yaml';
import { writeApiRedirects } from './api-redirects.mjs';
import { verifyApiLinks } from './verify-api-links.mjs';

const scratch = path.resolve(import.meta.dirname, '../../.ai-work/docs-readiness/api-redirect-tests');
let directory;
const legacy = 'arc/dotnet/arc/Sample.Extensions.html';
const target = 'dotnet/Sample.Extensions.html';
const uid = 'Sample.Extensions.Add(System.String)';
const fragment = 'Sample_Extensions_Add_System_String_';
const audit = () => ({ routes: { [legacy]: { target, uids: [uid] } } });
function file(filename, content) {
    mkdirSync(path.dirname(path.join(directory, filename)), { recursive: true });
    writeFileSync(path.join(directory, filename), content);
}
function xref(references = [{ uid, href: `${target}#${fragment}` }]) {
    file('xrefmap.yml', yaml.dump({ references }));
}
beforeEach(() => {
    mkdirSync(scratch, { recursive: true });
    directory = mkdtempSync(path.join(scratch, 'case-'));
    file(target, `<h2 id="${fragment}">Add a string</h2>`);
    xref();
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('when retaining legacy API deep links', () => {
    it('writes real redirects and follows their destinations when validating member fragments', () => {
        assert.equal(writeApiRedirects(directory, audit()), 1);
        file('index.html', `<a href="${legacy}?view=full#${fragment}">Old member link</a>`);
        assert.deepEqual(verifyApiLinks(directory).issues, []);
        assert.match(readFileSync(path.join(directory, legacy), 'utf8'), /<script src="\.\.\/\.\.\/\.\.\/api-redirect.js" defer>/);
        assert.deepEqual(JSON.parse(readFileSync(path.join(directory, 'api-redirects.json'), 'utf8')), audit());
    });

    it('executes the shipped redirect script, preserving encoded query strings and member fragments', () => {
        writeApiRedirects(directory, audit());
        for (const [search, hash] of [['?q=a%20b&lang=en', `#${fragment}`], ['', ''], ['?x=1', '#encoded%20fragment']]) {
            let redirected;
            runInNewContext(readFileSync(path.join(directory, 'api-redirect.js'), 'utf8'), {
                URL,
                document: { querySelector: selector => {
                    assert.equal(selector, 'link[rel="canonical"]');
                    return { href: `https://docs.example/api/${target}` };
                } },
                window: { location: { search, hash, replace: value => redirected = value } },
            });
            assert.equal(redirected, `https://docs.example/api/${target}${search}${hash}`);
        }
    });

    it('rejects a missing fragment behind a redirect even if the redirect page has that ID', () => {
        writeApiRedirects(directory, audit());
        file('index.html', `<a href="${legacy}#missing">Missing member</a>`);
        const result = verifyApiLinks(directory);
        assert.equal(result.issues.length, 1);
        assert.equal(result.issues[0].reason, 'Missing generated anchor');
    });

    for (const [description, markup] of [
        ['a meta name', '<meta name="missing">'],
        ['an attribute suffix', '<div data-id="missing"></div>'],
        ['a comment', '<!-- <div id="missing"></div> -->'],
        ['escaped markup', '&lt;div id="missing"&gt;'],
        ['script text', '<script>const markup = \'<div id="missing">\';</script>'],
        ['style text', '<style>/* <div id="missing"> */</style>'],
        ['textarea text', '<textarea><div id="missing"></textarea>'],
    ]) {
        it(`rejects a redirected fragment represented only by ${description}`, () => {
            writeApiRedirects(directory, audit());
            file(target, markup);
            file('index.html', `<a href="${legacy}#missing">Missing member</a>`);
            const result = verifyApiLinks(directory);
            assert.equal(result.issues.length, 1);
            assert.equal(result.issues[0].reason, 'Missing generated anchor');
        });

        it(`rejects a rendered member represented only by ${description} before publishing redirects`, () => {
            file(target, markup.replaceAll('missing', fragment));
            assert.throws(() => writeApiRedirects(directory, audit()), /Missing rendered API member anchor/);
            assert.throws(() => readFileSync(path.join(directory, legacy)), { code: 'ENOENT' });
        });
    }

    it('preserves real unquoted, legacy, and encoded anchors through rendered-member checks and redirects', () => {
        const anchors = ['bare', 'legacy', 'A&B<>"\'', 'numeric\u{1f600}'];
        file(target, `<h2 ID=bare></h2><A NAME=legacy></A><div id="A&amp;B&lt;&gt;&quot;&apos;"></div><div id=numeric&#x1f600;></div>`);
        xref(anchors.map(anchor => ({ uid: anchor, href: `${target}#${encodeURIComponent(anchor)}` })));
        writeApiRedirects(directory, { routes: { [legacy]: { target, uids: anchors } } });
        file('index.html', anchors.map(anchor => `<a href="${legacy}#${encodeURIComponent(anchor)}">Member</a>`).join(''));
        assert.deepEqual(verifyApiLinks(directory).issues, []);
    });

    it('rejects missing rendered UIDs, pages, and member anchors before publishing redirects', () => {
        xref([]);
        assert.throws(() => writeApiRedirects(directory, audit()), /Missing rendered API UID/);
        xref();
        file(target, '<h1>No member</h1>');
        assert.throws(() => writeApiRedirects(directory, audit()), /Missing rendered API member anchor/);
        rmSync(path.join(directory, target));
        assert.throws(() => writeApiRedirects(directory, audit()), /Missing canonical API page/);
    });

    it('rejects an xref that points to a different page or duplicates a UID', () => {
        xref([{ uid, href: 'dotnet/Other.html' }]);
        assert.throws(() => writeApiRedirects(directory, audit()), /Unexpected canonical API route/);
        xref([{ uid, href: target }, { uid, href: target }]);
        assert.throws(() => writeApiRedirects(directory, audit()), /Duplicate rendered API UID/);
    });

    it('never overwrites a real page and rejects escaping routes', () => {
        file(legacy, '<h1>Existing real API page</h1>');
        assert.throws(() => writeApiRedirects(directory, audit()), /Refusing to overwrite/);
        const unsafe = audit();
        unsafe.routes[legacy].target = '../outside.html';
        assert.throws(() => writeApiRedirects(directory, unsafe), /Unsafe API route/);
    });

    it('fails on redirect cycles, external destinations, and nonexistent destinations', () => {
        file('first.html', '<meta name="cratis-api-redirect" content="second.html">');
        file('second.html', '<meta name="cratis-api-redirect" content="first.html">');
        assert.ok(verifyApiLinks(directory).issues.some(issue => issue.reason === 'API redirect cycle'));
        file('first.html', '<meta name="cratis-api-redirect" content="https://example.com/">');
        assert.ok(verifyApiLinks(directory).issues.some(issue => issue.reason === 'API redirect leaves generated output'));
        file('first.html', '<meta name="cratis-api-redirect" content="missing.html">');
        assert.ok(verifyApiLinks(directory).issues.some(issue => issue.reason === 'Missing generated target'));
    });
});
