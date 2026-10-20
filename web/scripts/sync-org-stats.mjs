// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { promises as fs } from 'node:fs';
import { pathToFileURL } from 'node:url';

export const defaultUrl = 'https://raw.githubusercontent.com/Cratis/.github/main/stats/org-stats.json';
export const outputFile = new URL('../src/generated/org-stats.json', import.meta.url);

const count = (value) => Number.isSafeInteger(value) && value >= 0;
const text = (value) => typeof value === 'string' && value.length > 0;
const timestamp = (value) => text(value) && /T.*Z$/.test(value) && Number.isFinite(Date.parse(value));
const date = (value) => text(value) && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(value).toISOString().slice(0, 10) === value;
const link = (value) => {
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
};
const rows = (value, valid) => Array.isArray(value) && value.every(valid);

const repositoryCounts = (value) => rows(value, (repo) => text(repo?.name) && /^[A-Za-z0-9_.-]+$/.test(repo.name) && count(repo.releases) && repo.releases > 0);
const durationPair = (value) => [value?.medianMinutes, value?.p90Minutes].every((minutes) => Number.isFinite(minutes) && minutes >= 0)
    && value.p90Minutes >= value.medianMinutes;
const leadTime = (value) => count(value?.windowDays) && value.windowDays > 0
    && count(value.matchedReleases) && value.matchedReleases > 0
    && durationPair(value.mergeToRelease) && durationPair(value.openedToRelease);

function withoutField(value, field) {
    const result = { ...value };
    delete result[field];
    return result;
}

// A malformed optional field must not hide the rest of an otherwise valid snapshot.
function validateOptionalFields(data) {
    let result = data;
    const daily = data.daily.map((day) => day.repositories !== undefined && !repositoryCounts(day.repositories)
        ? withoutField(day, 'repositories') : day);
    if (daily.some((day, index) => day !== data.daily[index])) result = { ...result, daily };
    for (const [field, valid] of [['releasesThisWeek', repositoryCounts], ['deliveryLeadTime', leadTime]]) {
        if (result[field] !== undefined && !valid(result[field])) result = withoutField(result, field);
    }
    return result;
}

// Validate every field rendered by the site; unconsumed and future fields are ignored.
export function validateOrgStats(data) {
    try {
        const valid = data?.schemaVersion === 1 && timestamp(data.generatedAt)
            && ['last7Days'].every((key) => count(data.releases[key]) && count(data.mergedPullRequests[key]))
            && ['major', 'minor', 'patch', 'prerelease'].every((key) => count(data.releases.last7DaysByKind[key]))
            && count(data.releases.streak.currentDays) && count(data.releases.streak.longestDays)
            && count(data.issues.closedLast7Days)
            && rows(data.daily, (day) => date(day.date) && count(day.releases))
            && rows(data.weekly, (week) => date(week.weekStart) && count(week.releases) && count(week.mergedPullRequests))
            && rows(data.repositories, (repo) => text(repo.name) && link(repo.url)
                && text(repo.latestRelease.tag) && link(repo.latestRelease.url) && timestamp(repo.latestRelease.publishedAt))
            && rows(data.contributors.firstTime, (person) => text(person.login) && link(person.profileUrl)
                && text(person.repository) && link(person.pullRequestUrl) && timestamp(person.firstMergedAt))
            && rows(data.milestones.next, (milestone) => text(milestone.id) && text(milestone.label) && count(milestone.remaining));
        return valid ? validateOptionalFields(data) : null;
    } catch {
        return null;
    }
}

export async function fetchOrgStats({ file, url = defaultUrl, timeout = 10000, fetcher = fetch, warn = console.warn } = {}) {
    try {
        let source;
        if (file) {
            source = await fs.readFile(file, 'utf8');
        } else {
            const response = await fetcher(url, { signal: AbortSignal.timeout(timeout) });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            source = await response.text();
        }
        const data = validateOrgStats(JSON.parse(source));
        if (!data) throw new Error('invalid snapshot or unsupported schemaVersion');
        return data;
    } catch (error) {
        warn(`[sync] WARN org-stats: ${error.message}; activity data is unavailable`);
        return null;
    }
}

export async function syncOrgStats({ file = process.env.ORG_STATS_FILE, url = process.env.ORG_STATS_URL || defaultUrl, output = outputFile, ...options } = {}) {
    const data = await fetchOrgStats({ file, url, ...options });
    await fs.mkdir(new URL('.', output), { recursive: true });
    await fs.writeFile(output, `${JSON.stringify(data)}\n`);
    return data;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    syncOrgStats().catch((error) => console.warn(`[sync] WARN org-stats: ${error.message}`));
}
