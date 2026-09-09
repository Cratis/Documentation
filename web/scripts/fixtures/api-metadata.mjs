// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

/** Small managed-reference fixtures: shared namespace/type, overloads, and a generic type. */
export function apiMetadataFixture() {
    const namespace = assembly => ({ uid: 'Sample', id: 'Sample', name: 'Sample', fullName: 'Sample', type: 'Namespace', assemblies: [assembly], children: ['Sample.Extensions', ...(assembly === 'Library.A' ? ['Sample.Box`1'] : [])] });
    const type = (assembly, member) => ({ uid: 'Sample.Extensions', id: 'Extensions', parent: 'Sample', namespace: 'Sample', name: 'Extensions', fullName: 'Sample.Extensions', type: 'Class', langs: ['csharp'], assemblies: [assembly], children: [member], syntax: { content: 'public static class Extensions' }, summary: `Extensions from ${assembly}.`, source: { href: `https://example.com/${assembly}/Extensions.cs` } });
    const method = (assembly, parameter) => ({ uid: `Sample.Extensions.Add(${parameter})`, id: `Add(${parameter})`, parent: 'Sample.Extensions', namespace: 'Sample', name: `Add(${parameter})`, fullName: `Sample.Extensions.Add(${parameter})`, type: 'Method', langs: ['csharp'], assemblies: [assembly], summary: `Adds a ${parameter}.`, overload: 'Sample.Extensions.Add*', syntax: { content: `public static void Add(${parameter} value)`, parameters: [{ id: 'value', type: parameter, description: 'The value.' }] } });
    const firstMethod = method('Library.A', 'System.String');
    const secondMethod = method('Library.B', 'System.Int32');
    const generic = { uid: 'Sample.Box`1', id: 'Box`1', parent: 'Sample', namespace: 'Sample', name: 'Box<T>', fullName: 'Sample.Box<T>', type: 'Class', langs: ['csharp'], assemblies: ['Library.A'], summary: 'A generic box.', syntax: { content: 'public class Box<T>', typeParameters: [{ id: 'T', description: 'The value type.' }] } };
    const references = () => [
        // Namespace children need local references as well as items in sibling files.
        // Native DocFX otherwise creates child models without a UID or type.
        { uid: 'Sample.Extensions', commentId: 'T:Sample.Extensions', href: 'Sample.Extensions.html', name: 'Extensions', nameWithType: 'Extensions', fullName: 'Sample.Extensions' },
        { uid: 'Sample.Box`1', commentId: 'T:Sample.Box`1', href: 'Sample.Box-1.html', name: 'Box<T>', nameWithType: 'Box<T>', fullName: 'Sample.Box<T>' },
        { uid: 'Sample.Extensions.Add*', commentId: 'Overload:Sample.Extensions.Add', name: 'Add', fullName: 'Sample.Extensions.Add' },
        { uid: 'Sample', name: 'Sample', href: 'Sample.html', 'spec.csharp': [{ uid: 'Sample', name: 'Sample', href: 'Sample.html' }] },
        ...['String', 'Int32'].map(type => ({ uid: `System.${type}`, name: type, isExternal: true, href: `https://learn.microsoft.com/dotnet/api/system.${type.toLowerCase()}` })),
    ];
    const make = (assembly, member) => {
        const documents = new Map([
            ['Sample.yml', { items: [namespace(assembly)], references: references() }],
            ['Sample.Extensions.yml', { items: [type(assembly, member.uid), member], references: references() }],
        ]);
        if (assembly === 'Library.A') documents.set('Sample.Box-1.yml', { items: [generic], references: references() });
        return fromDocuments(documents);
    };
    const first = make('Library.A', firstMethod);
    const second = make('Library.B', secondMethod);
    const combined = fromDocuments(structuredClone(first.documents));
    combined.items.get('Sample.Extensions').item.children.push(secondMethod.uid);
    combined.documents.get('Sample.Extensions.yml').items.push(structuredClone(secondMethod));
    combined.items.set(secondMethod.uid, { item: combined.documents.get('Sample.Extensions.yml').items.at(-1), filename: 'Sample.Extensions.yml' });
    return {
        baselines: [
            { library: { assembly: 'Library.A', legacy: 'library/a' }, metadata: first },
            { library: { assembly: 'Library.B', legacy: 'library/b' }, metadata: second },
        ],
        combined,
    };
}

function fromDocuments(documents) {
    return { documents, items: new Map([...documents].flatMap(([filename, document]) => document.items.map(item => [item.uid, { item, filename }]))) };
}
