// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { it } from 'node:test';
import { fetchOrgStats, syncOrgStats, validateOrgStats } from './sync-org-stats.mjs';
import { busiestDays, humanDuration, recentRepositories, releaseDate, relativeDate, releaseIntensity, repositoryForLanding, repositoryRhythm, repositorySummary } from '../src/lib/org-stats.mjs';

const fixtureFile = new URL('./fixtures/org-stats.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixtureFile, 'utf8'));
const warn = () => {};

it('accepts the version 1 snapshot and future optional fields', () => {
    assert.equal(validateOrgStats(fixture), fixture);
    assert.ok(validateOrgStats({ ...fixture, futureField: true }));
});

it('accepts an older snapshot without optional fields', async () => {
    const older = JSON.parse(await readFile(new URL('./fixtures/org-stats-old.json', import.meta.url), 'utf8'));
    assert.equal(validateOrgStats(older), older);
    assert.equal(older.deliveryLeadTime, undefined);
    assert.ok(older.daily.every((day) => day.repositories === undefined));
    assert.deepEqual(repositoryRhythm(older), []);
    assert.deepEqual(busiestDays(older.daily), []);
});

it('drops only malformed daily repository breakdowns without mutating the input', () => {
    for (const repositories of [null, {}, [null], [{ name: 123, releases: 1 }], [{ name: '../unsafe', releases: 1 }],
        [{ name: 'Stage', releases: -1 }], [{ name: 'Stage', releases: 1.5 }], [{ name: 'Stage', releases: 0 }]]) {
        const data = structuredClone(fixture);
        data.daily[0].repositories = repositories;
        const validated = validateOrgStats(data);
        assert.ok(validated);
        assert.equal(validated.daily[0].repositories, undefined);
        assert.deepEqual(validated.daily[1], fixture.daily[1]);
        assert.deepEqual(validated.deliveryLeadTime, fixture.deliveryLeadTime);
        assert.equal(data.daily[0].repositories, repositories);
    }
});

it('drops malformed optional weekly repository counts but keeps the snapshot', () => {
    const data = { ...fixture, releasesThisWeek: [{ name: 'Arc', releases: '3' }] };
    const validated = validateOrgStats(data);
    assert.ok(validated);
    assert.equal(validated.releasesThisWeek, undefined);
    assert.deepEqual(validated.daily, fixture.daily);
});

it('drops malformed lead times but keeps all existing sections available', () => {
    for (const value of [null, {}, { ...fixture.deliveryLeadTime, matchedReleases: 0 },
        { ...fixture.deliveryLeadTime, windowDays: -1 }, { ...fixture.deliveryLeadTime, matchedReleases: 1.5 },
        { ...fixture.deliveryLeadTime, mergeToRelease: { medianMinutes: -1, p90Minutes: 9 } },
        { ...fixture.deliveryLeadTime, mergeToRelease: { medianMinutes: '2', p90Minutes: 9 } },
        { ...fixture.deliveryLeadTime, mergeToRelease: { medianMinutes: 10, p90Minutes: 9 } },
        { ...fixture.deliveryLeadTime, openedToRelease: { medianMinutes: 2, p90Minutes: Infinity } }]) {
        const data = { ...fixture, deliveryLeadTime: value };
        const validated = validateOrgStats(data);
        assert.ok(validated);
        assert.equal(validated.deliveryLeadTime, undefined);
        assert.equal(validated.releases, data.releases);
        assert.equal(validated.daily, data.daily);
        assert.equal(data.deliveryLeadTime, value);
    }
});

it('accepts zero-minute lead times', () => {
    const data = { ...fixture, deliveryLeadTime: { ...fixture.deliveryLeadTime,
        mergeToRelease: { medianMinutes: 0, p90Minutes: 0 } } };
    assert.equal(validateOrgStats(data), data);
});

it('rejects unsupported versions, absent fields, malformed dates, unsafe links, and invalid counts', () => {
    const invalid = [null, {}, { ...fixture, schemaVersion: 2 }, { ...fixture, generatedAt: 'invalid' }];
    for (const mutate of [
        (data) => { delete data.releases; },
        (data) => { data.releases.last7Days = -1; },
        (data) => { data.issues.closedLast7Days = 1.5; },
        (data) => { data.daily[0].date = '2026-02-30'; },
        (data) => { data.weekly[0].mergedPullRequests = '3'; },
        (data) => { data.repositories[0].latestRelease.url = 'javascript:alert(1)'; },
        (data) => { data.contributors.firstTime = null; },
        (data) => { data.milestones.next[0].remaining = -2; },
    ]) {
        const data = structuredClone(fixture);
        mutate(data);
        invalid.push(data);
    }
    for (const data of invalid) assert.equal(validateOrgStats(data), null);
});

it('loads a local fixture before considering the URL', async () => {
    const data = await fetchOrgStats({ file: fixtureFile, fetcher: () => { throw new Error('must not fetch'); } });
    assert.deepEqual(data, fixture);
});

it('fetches the overridden URL with a timeout signal', async () => {
    const data = await fetchOrgStats({ url: 'https://example.test/stats.json', fetcher: async (url, options) => {
        assert.equal(url, 'https://example.test/stats.json');
        assert.ok(options.signal instanceof AbortSignal);
        return { ok: true, text: async () => JSON.stringify(fixture) };
    } });
    assert.deepEqual(data, fixture);
});

it('warns and returns no data for network, HTTP, JSON, schema, and local-file failures', async () => {
    const failures = [
        { fetcher: async () => { throw new Error('offline'); } },
        { fetcher: async () => ({ ok: false, status: 404 }) },
        { fetcher: async () => ({ ok: true, text: async () => '{' }) },
        { fetcher: async () => ({ ok: true, text: async () => '{"schemaVersion":2}' }) },
        { file: new URL('./fixtures/does-not-exist.json', import.meta.url) },
    ];
    for (const options of failures) {
        const warnings = [];
        assert.equal(await fetchOrgStats({ ...options, warn: (message) => warnings.push(message) }), null);
        assert.equal(warnings.length, 1);
        assert.match(warnings[0], /WARN org-stats/);
    }
});

it('aborts a slow request and degrades gracefully', async () => {
    // Keep the event loop alive while AbortSignal.timeout's unreferenced timer fires.
    const keepAlive = setTimeout(() => {}, 1000);
    try {
        const data = await fetchOrgStats({ timeout: 5, warn, fetcher: (_url, { signal }) => new Promise((_resolve, reject) => {
            signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        }) });
        assert.equal(data, null);
    } finally { clearTimeout(keepAlive); }
});

it('replaces stale generated data with a no-data marker on failure', async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'cratis-org-stats-'));
    const output = pathToFileURL(path.join(directory, 'org-stats.json'));
    try {
        await syncOrgStats({ file: fixtureFile, output });
        assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), fixture);
        await syncOrgStats({ output, warn, fetcher: async () => { throw new Error('offline'); } });
        assert.equal(await readFile(output, 'utf8'), 'null\n');
    } finally { await rm(directory, { recursive: true, force: true }); }
});

it('formats release dates in UTC and relative to build time', () => {
    assert.equal(releaseDate('2026-10-20T23:59:00Z'), '20 Oct 2026');
    assert.equal(relativeDate('2026-10-20T12:00:00Z', Date.parse('2026-10-22T12:00:00Z')), '2 days ago');
});

it('matches only public product landing routes, including client repositories', () => {
    assert.equal(repositoryForLanding('/chronicle/'), 'Chronicle');
    assert.equal(repositoryForLanding('cli'), 'cli');
    assert.equal(repositoryForLanding('chronicle/clients/typescript'), 'Chronicle.TypeScript');
    assert.equal(repositoryForLanding('screenplay/stage/guides/build-renderer-target'), null);
    assert.equal(repositoryForLanding('ai'), 'AI');
    assert.equal(repositoryForLanding('chronicle/get-started'), null);
    assert.equal(repositoryForLanding('studio'), null);
    assert.equal(repositoryForLanding('pulse'), null);
});

it('shows the ten most recently released repositories, not release-volume order', () => {
    const recent = recentRepositories(fixture);
    assert.equal(recent.length, 10);
    assert.equal(recent[0].name, 'Arc');
    assert.equal(recent.at(-1).name, 'AuthProxy');
    assert.equal(fixture.repositories[0].name, 'Screenplay.CritterStack');
});

it('uses logarithmic release intensity buckets for zero, sparse, and busy cells', () => {
    assert.equal(releaseIntensity(0, 1000), 0);
    assert.equal(releaseIntensity(1, 1000), 1);
    assert.equal(releaseIntensity(10, 1000), 2);
    assert.equal(releaseIntensity(100, 1000), 3);
    assert.equal(releaseIntensity(1000, 1000), 4);
    assert.equal(releaseIntensity(1, 1), 4);
    assert.equal(releaseIntensity(0, 0), 0);
});

it('lists the busiest repositories with bounded summaries and no input changes', () => {
    const repositories = [{ name: 'Stage', releases: 30 }, { name: 'Arc', releases: 25 },
        ...Array.from({ length: 15 }, (_, index) => ({ name: `Repo${index}`, releases: 1 }))];
    const original = structuredClone(repositories);
    assert.match(repositorySummary(repositories), /^Stage 30, Arc 25, .* and 12 more$/);
    assert.match(repositorySummary(repositories, 3), /^Stage 30, Arc 25, .* and 14 more$/);
    assert.equal(repositorySummary([{ name: 'Arc', releases: 1 }]), 'Arc 1');
    assert.equal(repositorySummary(), '');
    assert.deepEqual(repositories, original);
});

it('shows the three busiest days with available repository breakdowns', () => {
    const original = structuredClone(fixture.daily);
    assert.deepEqual(busiestDays(fixture.daily).map((day) => day.date), ['2026-10-20', '2026-10-19', '2026-10-18']);
    assert.deepEqual(fixture.daily, original);
});

it('aggregates repository releases into Monday UTC weeks and excludes older releases', () => {
    const data = {
        weekly: [{ weekStart: '2026-10-12' }, { weekStart: '2026-10-19' }],
        daily: [
            { date: '2026-10-11', repositories: [{ name: 'Older', releases: 100 }] },
            { date: '2026-10-12', repositories: [{ name: 'Stage', releases: 2 }] },
            { date: '2026-10-18', repositories: [{ name: 'Stage', releases: 3 }, { name: 'Arc', releases: 5 }] },
            { date: '2026-10-19', repositories: [{ name: 'Stage', releases: 1 }] },
            { date: '2026-10-20' },
        ],
    };
    const rhythm = repositoryRhythm(data);
    assert.deepEqual(rhythm, [
        { name: 'Stage', url: 'https://github.com/Cratis/Stage', counts: [5, 1], total: 6 },
        { name: 'Arc', url: 'https://github.com/Cratis/Arc', counts: [5, 0], total: 5 },
    ]);
});

it('ranks all active repositories across the latest twelve weeks before display capping', () => {
    const rhythm = repositoryRhythm(fixture);
    assert.equal(rhythm.length, 22);
    assert.ok(rhythm.every((repo) => repo.counts.length === 12));
    assert.ok(rhythm.every((repo) => repo.total === repo.counts.reduce((sum, count) => sum + count, 0)));
    assert.equal(rhythm[0].name, 'Stage');
    assert.ok(rhythm[0].total > rhythm[1].total);
    assert.ok(rhythm.every((repo, index) => !index || repo.total <= rhythm[index - 1].total));
});

it('formats delivery durations as human-readable seconds, minutes, hours, and days', () => {
    assert.equal(humanDuration(0), '0 seconds');
    assert.equal(humanDuration(0.1), '6 seconds');
    assert.equal(humanDuration(1), '1 minute');
    assert.equal(humanDuration(2.1), '2.1 minutes');
    assert.equal(humanDuration(9.8), '9.8 minutes');
    assert.equal(humanDuration(60), '1 hour');
    assert.equal(humanDuration(95), '1.6 hours');
    assert.equal(humanDuration(1440), '1 day');
    assert.equal(humanDuration(2880), '2 days');
});
