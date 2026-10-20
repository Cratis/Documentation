// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateOrgStats } from '../../scripts/sync-org-stats.mjs';

// Resolve from the site root: during a build this module is bundled elsewhere, so import.meta.url
// does not point at src/lib any more. Astro runs from web/, where the sync step writes the file.
export const generatedFile = resolve(process.cwd(), 'src/generated/org-stats.json');

export function readOrgStats(file = generatedFile) {
    try { return validateOrgStats(JSON.parse(readFileSync(file, 'utf8'))); } catch { return null; }
}

export function releaseDate(value) {
    return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(value));
}

export function relativeDate(value, now = Date.now()) {
    const days = Math.floor((now - Date.parse(value)) / 86400000);
    return new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-days, 'day');
}

// Public repository mappings follow PRODUCTS/familySources in sync-content.mjs
// and the release links on What's new, AI, and Tools. Only exact landing routes match.
const repositories = {
    chronicle: 'Chronicle', arc: 'Arc', components: 'Components', fundamentals: 'Fundamentals',
    'chronicle/clients/dotnet': 'Chronicle', 'chronicle/clients/typescript': 'Chronicle.TypeScript',
    'chronicle/clients/kotlin': 'Chronicle.Kotlin', 'chronicle/clients/elixir': 'Chronicle.Elixir',
    'fundamentals/go': 'Fundamentals.Go', 'chronicle/go': 'Chronicle.Go', 'arc/go': 'Arc.Go',
    screenplay: 'Screenplay',
    'screenplay/ecosystem-examples/critter-stack': 'Screenplay.CritterStack',
    prologue: 'Prologue', cli: 'cli', ai: 'AI', authproxy: 'AuthProxy',
    'chronicle-mcp': 'Chronicle.Mcp', prompter: 'Prompter', templates: 'Templates',
    'tools/lens': 'Lens', 'tools/vscode-extension': 'Narrator',
};

export function repositoryForLanding(route) {
    return repositories[route.replace(/^\/+|\/+$/g, '')] ?? null;
}

export function recentRepositories(data) {
    return [...data.repositories].sort((a, b) => Date.parse(b.latestRelease.publishedAt) - Date.parse(a.latestRelease.publishedAt)).slice(0, 10);
}
