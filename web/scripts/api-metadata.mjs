// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { isDeepStrictEqual } from 'node:util';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export const apiLibraries = [
    { project: 'Chronicle/Source/Clients/DotNET/DotNET.csproj', assembly: 'Cratis.Chronicle', legacy: 'chronicle/clients/dotnet' },
    { project: 'Chronicle/Source/Clients/AspNetCore/AspNetCore.csproj', assembly: 'Cratis.Chronicle.AspNetCore', legacy: 'chronicle/clients/aspnetcore' },
    { project: 'Chronicle/Source/Clients/Testing/Testing.csproj', assembly: 'Cratis.Chronicle.Testing', legacy: 'chronicle/clients/testing' },
    { project: 'Arc/Source/DotNET/Arc/Arc.csproj', assembly: 'Cratis.Arc', legacy: 'arc/dotnet/arc' },
    { project: 'Arc/Source/DotNET/Arc.Core/Arc.Core.csproj', assembly: 'Cratis.Arc.Core', legacy: 'arc/dotnet/core' },
    { project: 'Arc/Source/DotNET/MongoDB/MongoDB.csproj', assembly: 'Cratis.Arc.MongoDB', legacy: 'arc/dotnet/mongodb' },
    { project: 'Fundamentals/Source/DotNET/Fundamentals/Fundamentals.csproj', assembly: 'Cratis.Fundamentals', legacy: 'fundamentals/dotnet/fundamentals' },
];

/** Extract each assembly independently as an audit baseline, then let DocFX group natively. */
export function metadataConfiguration(config, apiBuild) {
    if (config.metadata.length !== 1 || config.metadata[0].output !== 'dotnet') throw new Error('Expected one canonical dotnet metadata batch.');
    const batch = config.metadata[0];
    if (batch.src.length !== apiLibraries.length) throw new Error('API metadata inputs do not match the required libraries.');
    const sources = apiLibraries.map(library => {
        const matches = batch.src.filter(source => isDeepStrictEqual(source.files, [`${library.assembly}.dll`]));
        if (matches.length !== 1) throw new Error(`Missing or ambiguous metadata input for ${library.assembly}`);
        return { ...matches[0], src: path.resolve(apiBuild, matches[0].src) };
    });
    return {
        metadata: [
            ...apiLibraries.map((library, index) => ({ ...batch, src: [sources[index]], output: path.join(apiBuild, '_meta', library.legacy) })),
            { ...batch, src: sources, output: path.join(apiBuild, 'dotnet') },
        ],
    };
}

export function readMetadata(directory) {
    const documents = new Map();
    const items = new Map();
    for (const filename of readdirSync(directory).filter(name => name.endsWith('.yml') && name !== 'toc.yml').sort()) {
        const document = yaml.load(readFileSync(path.join(directory, filename), 'utf8'));
        if (!Array.isArray(document?.items)) throw new Error(`Missing metadata items: ${filename}`);
        documents.set(filename, document);
        for (const item of document.items) {
            if (!item.uid || items.has(item.uid)) throw new Error(`Missing or duplicate UID in ${directory}: ${item.uid}`);
            items.set(item.uid, { item, filename });
        }
    }
    if (!items.size) throw new Error(`Empty API metadata: ${directory}`);
    return { directory, documents, items };
}

/** Fail closed on lost members/children or changed signatures; restore provenance DocFX drops. */
export function reconcileMetadata(baselines, combined) {
    const expected = new Map();
    const routes = new Map();
    for (const { library, metadata } of baselines) {
        if (![...metadata.items.values()].some(({ item }) => item.assemblies?.includes(library.assembly))) {
            throw new Error(`No metadata for required assembly ${library.assembly}`);
        }
        for (const [uid, entry] of metadata.items) {
            if (!expected.has(uid)) expected.set(uid, []);
            expected.get(uid).push(entry);
            const target = combined.items.get(uid);
            if (!target) throw new Error(`Native DocFX grouping lost UID: ${uid}`);
            const legacy = `${library.legacy}/${entry.filename.replace(/\.yml$/, '.html')}`;
            const canonical = `dotnet/${target.filename.replace(/\.yml$/, '.html')}`;
            if (routes.has(legacy) && routes.get(legacy).target !== canonical) throw new Error(`Ambiguous legacy API page: ${legacy}`);
            if (!routes.has(legacy)) routes.set(legacy, { target: canonical, uids: [] });
            routes.get(legacy).uids.push(uid);
        }
    }
    for (const [uid, entries] of expected) {
        const target = combined.items.get(uid).item;
        const parentsOnly = entries.every(({ item }) => ['Namespace', 'Class', 'Interface', 'Struct', 'Enum', 'Delegate'].includes(item.type));
        if (entries.length > 1 && !parentsOnly) throw new Error(`Ambiguous API member UID across assemblies: ${uid}`);
        for (const { item } of entries) {
            for (const field of ['type', 'parent', 'id', 'commentId', 'syntax']) {
                if (!isDeepStrictEqual(item[field], target[field])) throw new Error(`Native DocFX grouping changed ${field}: ${uid}`);
            }
            // Unique items must retain their documentation and source as well as their signature.
            if (entries.length === 1) {
                for (const field of ['summary', 'remarks', 'example', 'source', 'attributes', 'exceptions', 'seealso', 'overload']) {
                    if (!isDeepStrictEqual(item[field], target[field])) throw new Error(`Native DocFX grouping changed ${field}: ${uid}`);
                }
            }
            for (const child of item.children ?? []) {
                if (!target.children?.includes(child) || !combined.items.has(child)) throw new Error(`Native DocFX grouping lost child ${child} of ${uid}`);
            }
        }
        const assemblies = [...new Set(entries.flatMap(({ item }) => item.assemblies ?? []))].sort();
        if ((target.assemblies ?? []).some(assembly => !assemblies.includes(assembly))) throw new Error(`Unexpected assembly provenance: ${uid}`);
        if (assemblies.length) target.assemblies = assemblies;
        // Keep assembly-specific descriptions and source links on merged parent pages,
        // not just in a private build report. Native DocFX otherwise selects the first.
        if (entries.length > 1) {
            const descriptions = entries.map(({ item }) => ({ assemblies: item.assemblies, summary: item.summary, remarks: item.remarks, source: item.source?.href }));
            const distinct = new Set(descriptions.map(({ summary, remarks, source }) => JSON.stringify({ summary, remarks, source })));
            if (distinct.size > 1) {
                target.remarks = descriptions.map(description => [
                    `**${description.assemblies.join(', ')}**`,
                    description.summary,
                    description.remarks,
                    description.source ? `[Source](${description.source})` : undefined,
                ].filter(Boolean).join('\n\n')).join('\n\n');
            }
        }
    }
    if (combined.items.size !== expected.size) throw new Error('Native DocFX grouping introduced unexpected UIDs.');
    normalizeNamespaceReferences(combined);
    return {
        sourceItems: [...expected.values()].reduce((sum, entries) => sum + entries.length, 0),
        uniqueUids: expected.size,
        assemblies: [...new Set([...expected.values()].flatMap(entries => entries.flatMap(({ item }) => item.assemblies ?? [])))].sort(),
        routes: Object.fromEntries([...routes].sort(([left], [right]) => left.localeCompare(right)).map(([route, value]) => [route, { ...value, uids: value.uids.sort() }])),
    };
}

/** DLL metadata splits namespace labels into links to nonexistent ancestor namespaces.
 * Link the complete qualified name to its actual namespace UID instead. No API or
 * hyperlink is stripped, and external namespaces are left to DocFX's xref resolver.
 */
export function normalizeNamespaceReferences(metadata) {
    for (const document of metadata.documents.values()) {
        for (const reference of document.references ?? []) {
            const target = metadata.items.get(reference.uid);
            if (target?.item.type !== 'Namespace') continue;
            const href = target.filename.replace(/\.yml$/, '.html');
            reference.href = href;
            reference.isExternal = false;
            for (const language of ['csharp', 'vb']) {
                if (!reference[`spec.${language}`]) continue;
                reference[`spec.${language}`] = [{ uid: reference.uid, name: reference.uid, href, isExternal: false }];
            }
        }
    }
}

export function saveMetadata(metadata) {
    for (const [filename, document] of metadata.documents) {
        writeFileSync(path.join(metadata.directory, filename), `### YamlMime:ManagedReference\n${yaml.dump(document, { lineWidth: -1, noRefs: true })}`);
    }
}
