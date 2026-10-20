// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { it } from 'node:test';
import { fetchOrgStats, syncOrgStats, validateOrgStats } from './sync-org-stats.mjs';
import { recentRepositories, releaseDate, relativeDate, repositoryForLanding } from '../src/lib/org-stats.mjs';

const fixtureFile = new URL('./fixtures/org-stats.json', import.meta.url);
const fixture = JSON.parse(await readFile(fixtureFile, 'utf8'));
const warn = () => {};

it('accepts the version 1 snapshot and future optional fields', () => {
    assert.equal(validateOrgStats(fixture), fixture);
    assert.ok(validateOrgStats({ ...fixture, futureField: true }));
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
