// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import path from 'node:path';

const checkoutAliases = new Map([
    ['GitHubLanding', '.github'],
    ['CLI', 'cli'],
]);

// Explicit public source repositories. An arbitrary local folder must not
// become an edit link to an invented or unrelated GitHub repository.
const publicCheckouts = new Set([
    '.github', 'GitHubLanding', 'Arc', 'Arc.Kotlin', 'Arc.TypeScript', 'Architecture', 'AuthProxy',
    'Chronicle', 'Chronicle.Elixir', 'Chronicle.Kotlin', 'Chronicle.Mcp',
    'Chronicle.TypeScript', 'CLI', 'cli', 'Components',
    'Eventmodelers-Build-Kit-CSharp', 'Eventmodelers-Build-Kit-Kotlin',
    'Eventmodelers-Build-Kit-Java', 'Fundamentals', 'Prologue', 'Prompter',
    'Screenplay', 'Screenplay.CritterStack', 'Screenplay.Generation',
    'Stage', 'Templates',
]);

function within(root, file) {
    const relative = path.relative(root, file);
    return relative && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
        ? relative.split(path.sep)
        : null;
}

function sourceUrl(action, sourcePath, reposRoot, docRepoRoot) {
    if (!sourcePath) return false;
    const resolved = path.resolve(sourcePath);
    const segments = within(docRepoRoot, resolved) ?? within(reposRoot, resolved);
    if (!segments || segments.length < 2) return false;
    const [checkout, ...sourceSegments] = segments;
    if (!publicCheckouts.has(checkout)) return false;
    const repository = checkoutAliases.get(checkout) ?? checkout;
    if (!/^[a-z0-9._-]+$/i.test(repository)) return false;
    return `https://github.com/Cratis/${repository}/${action}/main/${sourceSegments.map(encodeURIComponent).join('/')}`;
}

/** Return the original Cratis repository's edit URL, never a generated-site edit URL. */
export function sourceEditUrl(sourcePath, reposRoot, docRepoRoot) {
    return sourceUrl('edit', sourcePath, reposRoot, docRepoRoot);
}

/** Return the original Cratis repository's view URL for a source file, or false when it has no public owner. */
export function sourceViewUrl(sourcePath, reposRoot, docRepoRoot) {
    return sourceUrl('blob', sourcePath, reposRoot, docRepoRoot);
}
