// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { apiLibraries, metadataConfiguration, normalizeNamespaceReferences, readMetadata, reconcileMetadata, saveMetadata } from './api-metadata.mjs';
import { apiMetadataFixture } from './fixtures/api-metadata.mjs';

const scratch = path.resolve(import.meta.dirname, '../../.ai-work/docs-readiness/api-metadata-tests');
let directory;
beforeEach(() => {
    mkdirSync(scratch, { recursive: true });
    directory = mkdtempSync(path.join(scratch, 'case-'));
});
afterEach(() => rmSync(directory, { recursive: true, force: true }));

describe('when validating native DocFX grouping', () => {
    it('retains every source UID, child, assembly, and assembly-specific parent description', () => {
        const { baselines, combined } = apiMetadataFixture();
        const result = reconcileMetadata(baselines, combined);
        assert.equal(result.sourceItems, 7);
        assert.equal(result.uniqueUids, 5);
        assert.deepEqual(result.assemblies, ['Library.A', 'Library.B']);
        for (const { metadata, library } of baselines) {
            for (const [uid, { item, filename }] of metadata.items) {
                const target = combined.items.get(uid).item;
                assert.ok(target.assemblies.includes(library.assembly));
                for (const child of item.children ?? []) assert.ok(target.children.includes(child));
                assert.ok(result.routes[`${library.legacy}/${filename.replace('.yml', '.html')}`].uids.includes(uid));
            }
        }
        const parent = combined.items.get('Sample.Extensions').item;
        assert.match(parent.remarks, /Extensions from Library.A/);
        assert.match(parent.remarks, /Extensions from Library.B/);
        assert.match(parent.remarks, /https:\/\/example.com\/Library.B\/Extensions.cs/);
        assert.deepEqual(parent.assemblies, ['Library.A', 'Library.B']);
        assert.deepEqual(combined.items.get('Sample.Extensions.Add(System.Int32)').item.assemblies, ['Library.B']);
    });

    for (const [field, mutate, message] of [
        ['UID', combined => combined.items.delete('Sample.Extensions.Add(System.Int32)'), /lost UID/],
        ['child', combined => combined.items.get('Sample.Extensions').item.children.pop(), /lost child/],
        ['signature', combined => combined.items.get('Sample.Extensions.Add(System.Int32)').item.syntax.content = 'wrong', /changed syntax/],
        ['documentation', combined => combined.items.get('Sample.Extensions.Add(System.Int32)').item.summary = 'wrong', /changed summary/],
        ['assembly', combined => combined.items.get('Sample.Extensions.Add(System.Int32)').item.assemblies = ['Unknown'], /Unexpected assembly/],
        ['extra UID', combined => combined.items.set('Unexpected', { item: { uid: 'Unexpected' }, filename: 'Unexpected.yml' }), /unexpected UIDs/],
    ]) {
        it(`fails closed on a lost or changed ${field}`, () => {
            const { baselines, combined } = apiMetadataFixture();
            mutate(combined);
            assert.throws(() => reconcileMetadata(baselines, combined), message);
        });
    }

    it('rejects ambiguous same-UID members across assemblies instead of selecting one', () => {
        const { baselines, combined } = apiMetadataFixture();
        const entry = structuredClone(baselines[0].metadata.items.get('Sample.Extensions.Add(System.String)'));
        entry.item.assemblies = ['Library.B'];
        baselines[1].metadata.items.set(entry.item.uid, entry);
        assert.throws(() => reconcileMetadata(baselines, combined), /Ambiguous API member/);
    });

    it('rejects empty or incorrect assembly baselines', () => {
        const { baselines, combined } = apiMetadataFixture();
        baselines[1].library.assembly = 'Missing';
        assert.throws(() => reconcileMetadata(baselines, combined), /No metadata for required assembly/);
        assert.throws(() => readMetadata(directory), /Empty API metadata/);
    });

    it('round-trips repaired metadata with its ManagedReference MIME header and provenance', () => {
        const { baselines, combined } = apiMetadataFixture();
        reconcileMetadata(baselines, combined);
        combined.directory = directory;
        saveMetadata(combined);
        assert.match(readFileSync(path.join(directory, 'Sample.Extensions.yml'), 'utf8'), /^### YamlMime:ManagedReference/);
        assert.deepEqual(readMetadata(directory).items, combined.items);
        writeFileSync(path.join(directory, 'duplicate.yml'), readFileSync(path.join(directory, 'Sample.Extensions.yml')));
        assert.throws(() => readMetadata(directory), /duplicate UID/);
    });

    it('links a whole namespace to its real UID, without creating nonexistent ancestor pages', () => {
        const { combined } = apiMetadataFixture();
        const reference = { uid: 'Sample', href: 'MissingAncestor.html', 'spec.csharp': [{ uid: 'MissingAncestor', href: 'MissingAncestor.html' }], 'spec.vb': [] };
        const external = { uid: 'System', href: 'https://learn.microsoft.com/dotnet/api/system' };
        combined.documents.get('Sample.yml').references = [reference, external];
        normalizeNamespaceReferences(combined);
        assert.equal(reference.href, 'Sample.html');
        assert.deepEqual(reference['spec.csharp'], [{ uid: 'Sample', name: 'Sample', href: 'Sample.html', isExternal: false }]);
        assert.deepEqual(reference['spec.vb'], reference['spec.csharp']);
        assert.equal(external.href, 'https://learn.microsoft.com/dotnet/api/system');
    });
});

describe('when configuring required API coverage', () => {
    const apiBuild = path.resolve(import.meta.dirname, '../api-build');
    const config = JSON.parse(readFileSync(path.join(apiBuild, 'docfx.json'), 'utf8'));

    it('includes Arc.Core, global public types, and exactly seven audited assembly inputs', () => {
        const result = metadataConfiguration(config, apiBuild);
        assert.equal(apiLibraries.length, 7);
        assert.ok(apiLibraries.some(library => library.assembly === 'Cratis.Arc.Core' && library.project.endsWith('/Arc.Core/Arc.Core.csproj')));
        assert.equal(result.metadata.length, 8);
        assert.equal(result.metadata.at(-1).src.length, 7);
        for (const batch of result.metadata) {
            assert.equal(batch.globalNamespaceId, 'global');
            assert.ok(path.isAbsolute(batch.output));
            for (const source of batch.src) assert.ok(path.isAbsolute(source.src));
        }
        assert.deepEqual(config.build.content[0].files, ['dotnet/**/*.{yml,md}']);
    });

    it('rejects missing or duplicated assembly inputs before running tools', () => {
        const missing = structuredClone(config);
        missing.metadata[0].src.pop();
        assert.throws(() => metadataConfiguration(missing, apiBuild), /required libraries/);
        const duplicate = structuredClone(config);
        duplicate.metadata[0].src[0] = duplicate.metadata[0].src[1];
        assert.throws(() => metadataConfiguration(duplicate, apiBuild), /Missing or ambiguous/);
    });
});
