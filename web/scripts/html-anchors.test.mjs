// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { htmlAnchors } from './html-anchors.mjs';

const anchors = html => [...htmlAnchors(html)];

describe('when reading generated HTML anchors', () => {
    it('accepts real IDs on any element and legacy names only on anchors', () => {
        assert.deepEqual(anchors(`<!doctype html><META id="meta" name="not-an-anchor">
            <div ID = 'single'></div><section id=unquoted></section><A NaMe=legacy></A>
            <a id="modern" name="old"></a><input name="not-an-anchor"><div id=""></div>`),
        ['meta', 'single', 'unquoted', 'legacy', 'modern', 'old']);
    });

    it('matches full attribute names, not suffixes or attribute-like text', () => {
        assert.deepEqual(anchors(`<div data-id="missing" xml:id="missing" aria-id="missing" data-name="missing"
            title='a > b <div id="missing">' id="real"></div>
            id="missing" &lt;div id="missing"&gt;<a data-name="missing"></a>`), ['real']);
    });

    it('does not read anchors from comments or closing tags', () => {
        assert.deepEqual(anchors('<!-- <div id="missing"> --><h2 id=real></h2 id="missing">'), ['real']);
        assert.deepEqual(anchors('<!-- unterminated <div id="missing">'), []);
    });

    for (const element of ['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript']) {
        it(`ignores ${element} contents but keeps its own ID and resumes after its closing tag`, () => {
            assert.deepEqual(anchors(`<${element} id=container><div id="missing">&lt;div id="missing"&gt;
                </${element}-suffix><div id=missing></${element.toUpperCase()}><div id=after></div>`), ['container', 'after']);
            assert.deepEqual(anchors(`<${element}><div id=missing>`), []);
        });
    }

    it('decodes quoted and unquoted named and numeric values exactly once', () => {
        assert.deepEqual(anchors(`<div id="A&amp;B&lt;&gt;&quot;&apos;"></div><a name=&#65;&#x42;&#X43;></a>
            <div id="&amp;lt;"></div><div id="&#128512;"></div><div id="space&nbsp;here"></div>
            <div id="x&amp=literal"></div><div id="&AMP;"></div><div id="&#128;"></div>`),
        ['A&B<>"\'', 'ABC', '&lt;', '\u{1f600}', 'space\u00a0here', 'x&amp=literal', '&', '\u20ac']);
    });

    it('does not turn decoded attribute values into markup or additional attributes', () => {
        assert.deepEqual(anchors('<div id="&quot; id=&quot;missing" title="&lt;a name=missing&gt;"></div>'), ['" id="missing']);
    });

    it('uses the first duplicate attribute, including an empty first ID', () => {
        assert.deepEqual(anchors('<div id=first ID=missing></div><div id id=missing></div><a name=legacy NAME=missing></a>'), ['first', 'legacy']);
    });

    it('retains case, line breaks, and the slash belonging to an unquoted value', () => {
        assert.deepEqual(anchors('<div id="Case\r\nSensitive"></div><div id=slash/><div id=bare /><div id="quoted"/>'), ['Case\nSensitive', 'slash/', 'bare', 'quoted']);
    });

    it('fails closed rather than inventing anchors from unsupported or malformed markup', () => {
        for (const html of [
            '<div id="unterminated>',
            '<div id=missing',
            '<div id="real"id="missing">',
            '<div / id="missing">',
            '<div id="&copy;">',
            '<template><div id=missing></div></template>',
            '<script><!-- <script></script><div id=missing></script>',
        ]) assert.throws(() => htmlAnchors(html), /Unsupported|Unterminated|Missing HTML attribute separator/);
    });
});
