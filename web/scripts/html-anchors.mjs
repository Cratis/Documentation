// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

const whitespace = /[\t\n\f\r ]/;
const namedReferences = new Map(Object.entries({ amp: '&', AMP: '&', quot: '"', QUOT: '"', apos: "'", lt: '<', LT: '<', gt: '>', GT: '>', nbsp: '\u00a0' }));
const legacyReferences = new Set(['amp', 'AMP', 'quot', 'QUOT', 'lt', 'LT', 'gt', 'GT', 'nbsp']);
// HTML numeric character references use the Windows-1252 replacements for these codes.
const numericReplacements = new Map([
    [0x80, 0x20ac], [0x82, 0x201a], [0x83, 0x0192], [0x84, 0x201e], [0x85, 0x2026],
    [0x86, 0x2020], [0x87, 0x2021], [0x88, 0x02c6], [0x89, 0x2030], [0x8a, 0x0160],
    [0x8b, 0x2039], [0x8c, 0x0152], [0x8e, 0x017d], [0x91, 0x2018], [0x92, 0x2019],
    [0x93, 0x201c], [0x94, 0x201d], [0x95, 0x2022], [0x96, 0x2013], [0x97, 0x2014],
    [0x98, 0x02dc], [0x99, 0x2122], [0x9a, 0x0161], [0x9b, 0x203a], [0x9c, 0x0153],
    [0x9e, 0x017e], [0x9f, 0x0178],
]);

function decodeAnchor(value) {
    // Decode once, after tokenization: &lt; and &quot; never become HTML syntax.
    return value.replace(/&(#(?:x[\da-f]+|\d+);?|[a-z][\da-z]*;?)/gi, (reference, entity, offset) => {
        if (entity.startsWith('#')) {
            const code = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
            return String.fromCodePoint(code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff) ? 0xfffd : numericReplacements.get(code) ?? code);
        }
        const terminated = entity.endsWith(';');
        const name = terminated ? entity.slice(0, -1) : entity;
        if (!terminated && value[offset + reference.length] === '=') return reference;
        if (namedReferences.has(name) && (terminated || legacyReferences.has(name))) return namedReferences.get(name);
        // Generated anchors use the references above. Do not certify an uncertain
        // value as a literal anchor when a broader HTML entity table is needed.
        throw new Error(`Unsupported HTML anchor character reference: ${reference}`);
    });
}

/** Read anchors from generated HTML, not text that merely resembles attributes.
 * This deliberately bounded tokenizer rejects unsupported/ambiguous markup instead
 * of guessing that it contains a valid target. It uses the scripting-enabled
 * profile required by generated reference navigation/redirects, with no parser dependency.
 */
export function htmlAnchors(source) {
    const html = source.replace(/\r\n?/g, '\n').replaceAll('\0', '\ufffd');
    const anchors = new Set();
    let position = 0;
    while (position < html.length) {
        const start = html.indexOf('<', position);
        if (start === -1) break;
        position = start + 1;
        if (html.startsWith('!--', position)) {
            const end = /--!?>/g;
            end.lastIndex = position + 3;
            position = end.exec(html)?.index ?? html.length;
            position = position < html.length ? html.indexOf('>', position) + 1 : html.length;
            continue;
        }
        if (/^!doctype\s/i.test(html.slice(position, position + 10))) {
            const end = html.indexOf('>', position);
            if (end === -1 || /[<>"']/.test(html.slice(position, end))) throw new Error('Unsupported HTML doctype');
            position = end + 1;
            continue;
        }
        if (html[position] === '!' || html[position] === '?') throw new Error('Unsupported HTML declaration');
        const closing = html[position] === '/';
        if (closing) position++;
        if (!/[a-z]/i.test(html[position] ?? '')) continue;
        const nameStart = position;
        while (position < html.length && !/[\t\n\f\r />]/.test(html[position])) position++;
        const name = html.slice(nameStart, position).toLowerCase();
        if (!/^[a-z][a-z\d:-]*$/.test(name)) throw new Error('Unsupported HTML tag name');
        const attributes = new Map();
        while (position < html.length) {
            while (whitespace.test(html[position] ?? '')) position++;
            if (html[position] === '>' || html.startsWith('/>', position)) break;
            const attributeStart = position;
            while (position < html.length && !/[\t\n\f\r />=]/.test(html[position])) position++;
            const attribute = html.slice(attributeStart, position).toLowerCase();
            if (!attribute || /[<"']/.test(attribute)) throw new Error('Unsupported HTML attribute name');
            while (whitespace.test(html[position] ?? '')) position++;
            let value = '';
            if (html[position] === '=') {
                position++;
                while (whitespace.test(html[position] ?? '')) position++;
                const quote = html[position];
                if (quote === '"' || quote === "'") {
                    const end = html.indexOf(quote, ++position);
                    if (end === -1) throw new Error('Unterminated HTML attribute');
                    value = html.slice(position, end);
                    position = end + 1;
                    if (position < html.length && !/[\t\n\f\r />]/.test(html[position])) throw new Error('Missing HTML attribute separator');
                } else {
                    const valueStart = position;
                    while (position < html.length && !/[\t\n\f\r >]/.test(html[position])) position++;
                    value = html.slice(valueStart, position);
                    if (!value || /[<"'`=]/.test(value)) throw new Error('Unsupported unquoted HTML attribute');
                }
            }
            // Like HTML, only the first occurrence of a duplicate attribute counts.
            if (!attributes.has(attribute)) attributes.set(attribute, value);
        }
        if (position >= html.length) throw new Error('Unterminated HTML tag');
        position += html[position] === '/' ? 2 : 1;
        if (closing) continue;
        if (name === 'template') throw new Error('Unsupported inert HTML template');
        for (const attribute of ['id', ...(name === 'a' ? ['name'] : [])]) {
            if (attributes.get(attribute)) anchors.add(decodeAnchor(attributes.get(attribute)));
        }
        if (name === 'plaintext') break;
        if (['script', 'style', 'textarea', 'title', 'xmp', 'iframe', 'noembed', 'noframes', 'noscript'].includes(name)) {
            const end = new RegExp(`</${name}(?=[\\t\\n\\f\\r />])`, 'gi');
            end.lastIndex = position;
            const match = end.exec(html);
            const raw = html.slice(position, match?.index ?? html.length);
            // HTML script double-escape states need a full tokenizer; fail closed.
            if (name === 'script' && /<!--/.test(raw) && /<script[\t\n\f\r />]/i.test(raw)) throw new Error('Unsupported double-escaped HTML script');
            position = match?.index ?? html.length;
        }
    }
    return anchors;
}
