// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { resolveApiAssemblyInputs } from './api-assembly-inputs.mjs';

const scratch = path.resolve(import.meta.dirname, '../../.ai-work/283/assembly-tests');
let directory;
beforeEach(() => {
    mkdirSync(scratch, { recursive: true });
    directory = mkdtempSync(path.join(scratch, 'case-'));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

function output(framework, files = ['Library.dll', 'Library.xml']) {
    const target = path.join(directory, framework);
    mkdirSync(target, { recursive: true });
    for (const filename of files) writeFileSync(path.join(target, filename), '');
    return target;
}

function configuration() {
    const source = { src: directory, files: ['Library.dll'] };
    return { metadata: [{ src: [source], output: 'audit' }, { src: [source], output: 'dotnet' }] };
}

describe('when selecting compiled API framework inputs', () => {
    it('keeps every configured DocFX assembly rooted at Release rather than a pinned TFM', () => {
        const config = JSON.parse(readFileSync(new URL('../api-build/docfx.json', import.meta.url), 'utf8'));
        const sources = config.metadata[0].src;
        assert.equal(sources.length, 7);
        for (const source of sources) {
            assert.ok(source.src.endsWith('/bin/Release'), source.src);
            assert.match(source.files[0], /^Cratis\..+\.dll$/);
        }
    });

    it('resolves net11-only output for both the audit and combined batches', () => {
        const expected = output('net11.0');
        const config = configuration();
        const result = resolveApiAssemblyInputs(config);
        for (const batch of result.metadata) {
            assert.equal(batch.src[0].src, expected);
            assert.deepEqual(batch.src[0].files, ['Library.dll']);
        }
        assert.equal(config.metadata[0].src[0].src, directory);
        assert.equal(result.metadata[1].output, 'dotnet');
    });

    it('selects the highest numeric framework from multi-target output', () => {
        output('net9.0');
        output('net10.0');
        const expected = output('net11.0');
        output('netstandard2.0');
        output('net11.0-windows');
        assert.equal(resolveApiAssemblyInputs(configuration()).metadata[0].src[0].src, expected);
    });

    it('supports a library that still only builds net10', () => {
        const expected = output('net10.0');
        assert.equal(resolveApiAssemblyInputs(configuration()).metadata[0].src[0].src, expected);
    });

    it('resolves each library independently rather than imposing a shared TFM', () => {
        output('net11.0');
        const older = output('older/net10.0');
        const config = configuration();
        config.metadata[1].src = [{ src: path.dirname(older), files: ['Library.dll'] }];
        const result = resolveApiAssemblyInputs(config);
        assert.equal(result.metadata[0].src[0].src, path.join(directory, 'net11.0'));
        assert.equal(result.metadata[1].src[0].src, older);
    });

    it('rejects an incomplete higher TFM instead of silently using an older DLL', () => {
        output('net10.0');
        const newer = output('net11.0', ['Library.xml']);
        assert.throws(() => resolveApiAssemblyInputs(configuration()), {
            message: `Missing compiled API input: ${path.join(newer, 'Library.dll')}`,
        });
    });

    it('requires XML documentation beside the selected DLL', () => {
        const newer = output('net11.0', ['Library.dll']);
        assert.throws(() => resolveApiAssemblyInputs(configuration()), {
            message: `Missing compiled API input: ${path.join(newer, 'Library.xml')}`,
        });
    });

    it('rejects a Release directory with no .NET TFM output', () => {
        output('ref');
        assert.throws(() => resolveApiAssemblyInputs(configuration()), /Missing compiled API input:/);
    });

    it('rejects a missing Release directory', () => {
        const config = configuration();
        config.metadata[0].src[0].src = path.join(directory, 'missing');
        assert.throws(() => resolveApiAssemblyInputs(config), /Missing compiled API input:/);
    });
});
