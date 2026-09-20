// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { runInNewContext } from 'node:vm';
import yaml from 'js-yaml';
import { AUDIT_FILENAME, SCRIPT_FILENAME, parseRedirects, writeContentRedirects } from './content-redirects.mjs';

const scratch = path.resolve(import.meta.dirname, '../../.ai-work/docs-readiness/content-redirect-tests');
let directory;

const from = '/arc/backend/commands/';
const to = '/arc/backend/csharp/commands/';

function file(filename, content) {
    mkdirSync(path.dirname(path.join(directory, filename)), { recursive: true });
    writeFileSync(path.join(directory, filename), content);
}

function manifest(entries) {
    return parseRedirects(yaml.dump(entries));
}

beforeEach(() => {
    mkdirSync(scratch, { recursive: true });
    directory = mkdtempSync(path.join(scratch, 'case-'));
    file('arc/backend/csharp/commands/index.html', '<h1>Commands</h1>');
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('when redirecting moved content routes', () => {
    it('writes a stub, the shim and an audit manifest for every entry', () => {
        assert.equal(writeContentRedirects(directory, manifest([{ from, to }])), 1);
        const stub = readFileSync(path.join(directory, 'arc/backend/commands/index.html'), 'utf8');
        assert.match(stub, /<link rel="canonical" href="\.\.\/csharp\/commands\/">/);
        assert.match(stub, /<script src="\.\.\/\.\.\/\.\.\/content-redirect.js" defer>/);
        assert.match(stub, /<a href="\.\.\/csharp\/commands\/">/);
        assert.ok(existsSync(path.join(directory, SCRIPT_FILENAME)));
        assert.deepEqual(JSON.parse(readFileSync(path.join(directory, AUDIT_FILENAME), 'utf8')), {
            redirects: [{ from, to, page: 'arc/backend/commands/index.html', canonical: '../csharp/commands/' }],
        });
    });

    it('executes the shipped shim, preserving the query string and fragment', () => {
        writeContentRedirects(directory, manifest([{ from, to }]));
        for (const [search, hash] of [['?q=a%20b&lang=en', '#step-2'], ['', ''], ['?x=1', '#encoded%20fragment']]) {
            let redirected;
            runInNewContext(readFileSync(path.join(directory, SCRIPT_FILENAME), 'utf8'), {
                URL,
                document: { querySelector: (selector) => {
                    assert.equal(selector, 'link[rel="canonical"]');
                    return { href: `https://www.cratis.io${to}` };
                } },
                window: { location: { search, hash, replace: (value) => redirected = value } },
            });
            assert.equal(redirected, `https://www.cratis.io${to}${search}${hash}`);
        }
    });

    it('accepts a file target and a target that is only a directory index', () => {
        file('arc/legacy.html', '<h1>Legacy</h1>');
        assert.equal(writeContentRedirects(directory, manifest([
            { from, to },
            { from: '/arc/backend/old-file/', to: '/arc/legacy.html' },
        ])), 2);
        assert.match(
            readFileSync(path.join(directory, 'arc/backend/old-file/index.html'), 'utf8'),
            /<link rel="canonical" href="\.\.\/\.\.\/legacy.html">/
        );
    });

    it('treats an empty manifest as the legitimate initial state', () => {
        assert.deepEqual(parseRedirects('[]'), []);
        assert.deepEqual(parseRedirects(''), []);
        assert.deepEqual(parseRedirects('# only comments\n'), []);
        assert.equal(writeContentRedirects(directory, []), 0);
        assert.equal(existsSync(path.join(directory, SCRIPT_FILENAME)), false);
        assert.deepEqual(JSON.parse(readFileSync(path.join(directory, AUDIT_FILENAME), 'utf8')), { redirects: [] });
    });

    it('fails on a target that does not exist in the build, writing nothing', () => {
        assert.throws(
            () => writeContentRedirects(directory, manifest([{ from, to: '/arc/backend/typescript/commands/' }])),
            /Missing canonical page for content redirect \/arc\/backend\/commands\/ -> \/arc\/backend\/typescript\/commands\//
        );
        assert.equal(existsSync(path.join(directory, 'arc/backend/commands/index.html')), false);
        assert.equal(existsSync(path.join(directory, AUDIT_FILENAME)), false);
    });

    it('refuses to overwrite a real generated page', () => {
        file('arc/backend/commands/index.html', '<h1>A real page still lives here</h1>');
        assert.throws(() => writeContentRedirects(directory, manifest([{ from, to }])), /Refusing to overwrite generated page: \/arc\/backend\/commands\//);
        assert.match(readFileSync(path.join(directory, 'arc/backend/commands/index.html'), 'utf8'), /A real page still lives here/);
    });

    it('validates every entry before writing any stub', () => {
        assert.throws(() => writeContentRedirects(directory, manifest([
            { from, to },
            { from: '/arc/backend/queries/', to: '/arc/backend/nowhere/' },
        ])), /Missing canonical page/);
        assert.equal(existsSync(path.join(directory, 'arc/backend/commands/index.html')), false);
    });

    it('rejects a duplicate from, a self redirect, and a chain or cycle', () => {
        assert.throws(() => manifest([{ from, to }, { from, to: '/arc/' }]), /Duplicate content redirect "from": \/arc\/backend\/commands\//);
        assert.throws(() => manifest([{ from, to: from }]), /redirects \/arc\/backend\/commands\/ to itself/);
        assert.throws(
            () => manifest([{ from: '/a/', to: '/b/' }, { from: '/b/', to: '/c/' }]),
            /Content redirect chain: \/a\/ -> \/b\/ -> \/c\//
        );
        assert.throws(
            () => manifest([{ from: '/a/', to: '/b/' }, { from: '/b/', to: '/a/' }]),
            /Content redirect cycle: \/a\/ -> \/b\/ -> \/a\//
        );
    });

    it('rejects routes that are not site-absolute directory routes', () => {
        assert.throws(() => manifest([{ from: 'arc/backend/commands/', to }]), /must be a site-absolute route/);
        assert.throws(() => manifest([{ from, to: 'https://example.com/arc/' }]), /must stay on this site/);
        assert.throws(() => manifest([{ from, to: '//example.com/arc/' }]), /must stay on this site/);
        assert.throws(() => manifest([{ from: '/arc/backend/commands', to }]), /must be a directory route ending with "\/"/);
        assert.throws(() => manifest([{ from, to: '/arc/../../outside/' }]), /must not contain relative segments/);
        assert.throws(() => manifest([{ from, to: '/arc/ backend/' }]), /has whitespace in "to"/);
    });

    it('rejects a malformed manifest', () => {
        assert.throws(() => parseRedirects('from: /a/\nto: /b/\n'), /must contain a top-level list/);
        assert.throws(() => manifest([{ from }]), /missing or non-string "to"/);
        assert.throws(() => manifest([{ from, to, status: 301 }]), /unsupported key\(s\): status/);
        assert.throws(() => parseRedirects('- /arc/backend/commands/\n'), /must be a \{ from, to \} mapping/);
    });
});
