// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../../', import.meta.url));
const workflowPath = path.join(repositoryRoot, '.github/workflows/docs-site.yml');
const deployedInfoUrl = 'https://www.cratis.io/build-info.json';

function checkoutValue(step, name) {
    const value = step.match(new RegExp(`^          ${name}: (.+)$`, 'm'))?.[1].trim();
    return value?.replace(/^(['"])(.*)\1$/, '$2');
}

// Read only the build job's checkout steps, not a second product list. This is
// deliberately a strict subset of YAML so the probe needs no dependency install.
// Unsupported checkout syntax fails loudly instead of silently omitting a repo.
export function checkoutSources(workflow, repository, docsRef = 'main') {
    const build = workflow.match(/^  build:\n([\s\S]*?)(?=^  [\w-]+:|$(?![\s\S]))/m)?.[1];
    if (!build) throw new Error('Missing build job');
    const steps = build.split(/^      - /m).slice(1);
    const checkoutCount = (build.match(/uses:\s*['"]?actions\/checkout@/g) ?? []).length;
    const checkouts = steps.filter((step) => /(?:^|\n        )uses: actions\/checkout@[^\s]+/m.test(step));
    if (!checkoutCount || checkouts.length !== checkoutCount) throw new Error('Unsupported checkout syntax');
    const sources = checkouts.map((step) => {
        const sourceRepository = checkoutValue(step, 'repository') ?? repository;
        const checkoutRef = checkoutValue(step, 'ref');
        const ref = checkoutRef === '${{ env.DOCS_REF }}' ? docsRef : checkoutRef ?? 'main';
        const checkoutPath = checkoutValue(step, 'path');
        if (!/^[\w.-]+\/[\w.-]+$/.test(sourceRepository) || !/^[\w./-]+$/.test(ref) ||
            !checkoutPath || !/^[\w.-]+$/.test(checkoutPath) || checkoutPath === '..' ||
            (sourceRepository !== repository && !checkoutRef)) {
            throw new Error(`Unsupported checkout source: ${sourceRepository}`);
        }
        return { repository: sourceRepository, ref, path: checkoutPath };
    });
    if (sources.filter((source) => source.repository === repository).length !== 1) {
        throw new Error('Build must check out this repository exactly once');
    }
    if (new Set(sources.map(sourceKey)).size !== sources.length) throw new Error('Duplicate checkout source');
    return sources;
}

function sourceKey(source) {
    return `${source.repository}@${source.ref}`;
}

export function buildInfo(sources, revisions) {
    const entries = sources.map((source) => {
        const key = sourceKey(source);
        const sha = revisions[key];
        if (!/^[a-f0-9]{40}$/.test(sha ?? '')) throw new Error(`Missing or invalid revision for ${key}`);
        return [key, sha];
    }).sort(([left], [right]) => left < right ? -1 : 1);
    if (Object.keys(revisions).length !== entries.length) throw new Error('Unexpected source revision');
    const sourceRevisions = Object.fromEntries(entries);
    const fingerprint = createHash('sha256').update(JSON.stringify(sourceRevisions)).digest('hex');
    return { schema: 1, fingerprint, sources: sourceRevisions };
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
    return response.json();
}

export async function resolveRevisions(sources, token) {
    const revisions = await Promise.all(sources.map(async (source) => {
        const url = `https://api.github.com/repos/${source.repository}/commits/${encodeURIComponent(source.ref)}`;
        const commit = await fetchJson(url, {
            headers: { Accept: 'application/vnd.github+json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        });
        return [sourceKey(source), commit.sha];
    }));
    return Object.fromEntries(revisions);
}

export async function probe(sources, resolve, readDeployed, warn = console.warn) {
    let current;
    try {
        current = buildInfo(sources, await resolve());
        const deployed = await readDeployed();
        // Recompute the deployed manifest too: malformed, old or partial metadata
        // must never suppress a build. A missing source is an error, not "unchanged".
        const previous = buildInfo(sources, deployed.sources);
        if (deployed.schema !== current.schema || deployed.fingerprint !== previous.fingerprint) {
            throw new Error('Invalid deployed build info');
        }
        return { build: current.fingerprint !== previous.fingerprint, current };
    } catch (error) {
        warn(`Source probe failed open: ${error.message}`);
        return { build: true, current };
    }
}

async function main() {
    const sources = checkoutSources(await readFile(workflowPath, 'utf8'), process.env.GITHUB_REPOSITORY ?? 'Cratis/Documentation', process.env.DOCS_REF ?? 'main');
    if (process.argv.includes('--record')) {
        // Record actual checkouts, not the earlier probe: refs may move while a
        // runner is queued. This file is uploaded and deployed with the same site.
        const reposRoot = path.dirname(repositoryRoot.replace(/\/$/, ''));
        const revisions = Object.fromEntries(sources.map((source) => [sourceKey(source),
            execFileSync('git', ['-C', path.join(reposRoot, source.path), 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()]));
        const info = buildInfo(sources, revisions);
        await writeFile(path.join(repositoryRoot, 'web/dist/build-info.json'), JSON.stringify(info, null, 2) + '\n');
        console.log(JSON.stringify(info, null, 2));
        return;
    }
    const result = await probe(sources, () => resolveRevisions(sources, process.env.GH_TOKEN),
        () => fetchJson(`${deployedInfoUrl}?probe=${Date.now()}`, { headers: { 'Cache-Control': 'no-cache' } }));
    console.log(JSON.stringify(result, null, 2));
    if (process.env.GITHUB_OUTPUT) await appendFile(process.env.GITHUB_OUTPUT, `build=${result.build}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
