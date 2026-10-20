// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { validateOrgStats } from '../../scripts/sync-org-stats.mjs';

// Resolve from the site root: during a build this module is bundled elsewhere, so import.meta.url
// does not point at src/lib any more. Astro runs from web/, where the sync step writes the file.
export const generatedFile = resolve(process.cwd(), 'src/generated/org-stats.json');

const cache = new Map();

// Every page renders the title override, so read and validate the snapshot once per build.
export function readOrgStats(file = generatedFile) {
    if (!cache.has(file)) {
        let data = null;
        try { data = validateOrgStats(JSON.parse(readFileSync(file, 'utf8'))); } catch { data = null; }
        cache.set(file, data);
    }
    return cache.get(file);
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
    'arc/backend/kotlin': 'Arc.Kotlin', 'arc/backend/typescript': 'Arc.TypeScript',
    specifications: 'Specifications', screenplay: 'Screenplay',
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

export function releaseIntensity(releases, max) {
    return releases > 0 ? Math.ceil(Math.log1p(releases) / Math.log1p(Math.max(1, max)) * 4) : 0;
}

export function repositorySummary(repositories = [], limit = 5) {
    const sorted = [...repositories].sort((a, b) => b.releases - a.releases || a.name.localeCompare(b.name));
    const names = sorted.slice(0, limit).map((repo) => `${repo.name} ${repo.releases}`).join(', ');
    return names + (sorted.length > limit ? ` and ${sorted.length - limit} more` : '');
}

export function busiestDays(days) {
    return days.filter((day) => day.releases > 0 && day.repositories?.length)
        .sort((a, b) => b.releases - a.releases || b.date.localeCompare(a.date)).slice(0, 3);
}

// Use the same Monday-based UTC weeks as the existing activity chart, not rolling seven-day bins.
export function repositoryRhythm(data) {
    const weeks = data.weekly.slice(-12);
    const weekIndices = new Map(weeks.map((week, index) => [week.weekStart, index]));
    const repositories = new Map();
    for (const day of data.daily) {
        const monday = new Date(`${day.date}T00:00:00Z`);
        monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
        const index = weekIndices.get(monday.toISOString().slice(0, 10));
        if (index === undefined) continue;
        for (const repo of day.repositories ?? []) {
            if (!repositories.has(repo.name)) {
                repositories.set(repo.name, {
                    name: repo.name, url: `https://github.com/Cratis/${encodeURIComponent(repo.name)}`,
                    counts: weeks.map(() => 0), total: 0,
                });
            }
            const row = repositories.get(repo.name);
            row.counts[index] += repo.releases;
            row.total += repo.releases;
        }
    }
    return [...repositories.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}

export function humanDuration(minutes) {
    const [value, unit] = minutes < 1 ? [Math.round(minutes * 60), 'second']
        : minutes < 60 ? [minutes, 'minute']
        : minutes < 1440 ? [minutes / 60, 'hour'] : [minutes / 1440, 'day'];
    return new Intl.NumberFormat('en', { style: 'unit', unit, unitDisplay: 'long', maximumFractionDigits: 1 }).format(value);
}
