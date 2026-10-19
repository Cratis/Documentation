// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { buildInfo, checkoutSources, probe } from './docs-source-fingerprint.mjs';

const workflow = await readFile(new URL('../workflows/docs-site.yml', import.meta.url), 'utf8');
const sources = checkoutSources(workflow, 'Cratis/Documentation');
const revisions = Object.fromEntries(sources.map((source) => [`${source.repository}@${source.ref}`, 'a'.repeat(40)]));
const deployed = buildInfo(sources, revisions);
const quiet = () => {};

test('unchanged sources should skip the build', async () => {
    const result = await probe(sources, async () => revisions, async () => deployed, quiet);
    assert.equal(result.build, false);
});

test('changed source should build', async () => {
    const changed = { ...revisions, 'Cratis/Chronicle@main': 'b'.repeat(40) };
    const result = await probe(sources, async () => changed, async () => deployed, quiet);
    assert.equal(result.build, true);
});

test('this repository changing should build', async () => {
    const changed = { ...revisions, 'Cratis/Documentation@main': 'b'.repeat(40) };
    const result = await probe(sources, async () => changed, async () => deployed, quiet);
    assert.equal(result.build, true);
});

test('deployed metadata fetch failure should build', async () => {
    const result = await probe(sources, async () => revisions, async () => { throw new Error('HTTP 404'); }, quiet);
    assert.equal(result.build, true);
    assert.equal(result.current.fingerprint, deployed.fingerprint);
});

test('GitHub fetch failure should build', async () => {
    const result = await probe(sources, async () => { throw new Error('HTTP 403'); }, async () => deployed, quiet);
    assert.equal(result.build, true);
});

test('invalid or incomplete deployed metadata should build', async () => {
    for (const metadata of [{}, { ...deployed, fingerprint: 'invalid' }, { ...deployed, schema: 0 },
        { ...deployed, sources: { 'Cratis/Documentation@main': 'a'.repeat(40) } }]) {
        const result = await probe(sources, async () => revisions, async () => metadata, quiet);
        assert.equal(result.build, true);
    }
});

test('missing checked-out repository should fail manifest validation', () => {
    const { 'Cratis/Chronicle@main': omitted, ...incomplete } = revisions;
    assert.ok(omitted);
    assert.throws(() => buildInfo(sources, incomplete), /Missing or invalid revision for Cratis\/Chronicle@main/);
});

test('every build checkout, including this repository, should be fingerprinted', () => {
    const build = workflow.split('  build:\n')[1].split('\n  deploy:')[0];
    const checkoutCount = (build.match(/uses: actions\/checkout@/g) ?? []).length;
    assert.equal(sources.length, checkoutCount);
    assert.equal(Object.keys(deployed.sources).length, checkoutCount);
    assert.ok(deployed.sources['Cratis/Documentation@main']);
});

test('adding a checkout should automatically extend the fingerprint and reject the old list', () => {
    const updated = workflow.replace('      - name: Plan the build', `      - name: Checkout another product
        uses: actions/checkout@v4
        with:
          repository: Cratis/Another.Product
          ref: main
          path: Another.Product

      - name: Plan the build`);
    const expanded = checkoutSources(updated, 'Cratis/Documentation');
    assert.equal(expanded.length, sources.length + 1);
    assert.throws(() => buildInfo(expanded, revisions), /Missing or invalid revision for Cratis\/Another.Product@main/);
});

test('unsupported checkout syntax should fail rather than omit a source', () => {
    assert.throws(() => checkoutSources(workflow.replace('repository: Cratis/Samples', 'repository: ${{ vars.SAMPLES }}'), 'Cratis/Documentation'), /Unsupported checkout source/);
    const quotedCheckout = workflow.replace('      - name: Checkout Documentation\n        uses: actions/checkout@v4', "      - name: Checkout Documentation\n        uses: 'actions/checkout@v4'");
    assert.throws(() => checkoutSources(quotedCheckout, 'Cratis/Documentation'), /Unsupported checkout syntax/);
    assert.throws(() => checkoutSources(workflow.replace('          ref: main\n', ''), 'Cratis/Documentation'), /Unsupported checkout source/);
});

test('fingerprint should not depend on source ordering', () => {
    assert.deepEqual(buildInfo([...sources].reverse(), revisions), deployed);
});

test('docs-overhaul refs should resolve only for the checkouts that select them', () => {
    const validation = checkoutSources(workflow, 'Cratis/Documentation', 'docs-overhaul');
    assert.equal(validation.find((source) => source.repository === 'Cratis/Chronicle').ref, 'docs-overhaul');
    assert.equal(validation.find((source) => source.repository === 'Cratis/Samples').ref, 'main');
});

function jobCondition(job, context) {
    const definition = workflow.split(`  ${job}:\n`)[1].split(/^  [\w-]+:/m)[0];
    const expression = definition.match(/^    if: (.+)$/m)[1].replace(/^\$\{\{ | \}\}$/g, '');
    // The workflow uses only boolean/comparison operators shared with JavaScript.
    return runInNewContext(expression, { cancelled: () => false, ...context });
}

test('event matrix should keep immediate validation, batch hourly builds and skip dispatches', () => {
    const cases = [
        ['pull_request', undefined, undefined, true, false, false],
        ['push', undefined, undefined, true, true, false],
        ['workflow_dispatch', undefined, undefined, true, true, false],
        ['repository_dispatch', undefined, undefined, false, false, false],
        ['schedule', '17 2 * * *', undefined, true, false, false],
        ['schedule', '7 * * * *', 'true', true, true, true],
        ['schedule', '7 * * * *', 'false', false, false, true],
    ];
    for (const [eventName, schedule, changed, build, deploy, runProbe] of cases) {
        const context = {
            github: { event_name: eventName, event: { schedule }, ref_name: 'main' },
            needs: { probe: { outputs: { build: changed } }, build: { result: build ? 'success' : 'skipped' } },
        };
        assert.equal(jobCondition('probe', context), runProbe, `${eventName}/${schedule}: probe`);
        assert.equal(jobCondition('build', context), build, `${eventName}/${schedule}: build`);
        assert.equal(jobCondition('deploy', context), deploy, `${eventName}/${schedule}: deploy`);
    }
});

test('slow checks should run only on PR, manual and nightly builds', () => {
    const script = workflow.match(/      - name: Plan the build[\s\S]*?        run: \|\n([\s\S]*?)(?=\n      - )/)[1]
        .split('\n').map((line) => line.slice(10)).join('\n');
    for (const [eventName, schedule, checks] of [
        ['pull_request', '', true], ['workflow_dispatch', '', true], ['push', '', false],
        ['schedule', '17 2 * * *', true], ['schedule', '7 * * * *', false],
    ]) {
        const output = execFileSync('bash', ['-c', script], {
            encoding: 'utf8', env: {
                ...process.env, EVENT_NAME: eventName, EVENT_SCHEDULE: schedule,
                PAYLOAD_REPO: '', PAYLOAD_SHA: '', GITHUB_OUTPUT: '/dev/stdout',
            },
        });
        assert.match(output, new RegExp(`^checks=${checks}$`, 'm'));
    }
});

test('failed builds and validation branches should never deploy', () => {
    for (const [ref, result] of [['main', 'failure'], ['main', 'cancelled'], ['main', 'skipped'], ['docs-overhaul', 'success']]) {
        assert.equal(jobCondition('deploy', {
            github: { event_name: 'push', event: {}, ref_name: ref },
            needs: { build: { result } },
        }), false);
    }
});

test('hourly and main notifications should share concurrency while nightly remains separate', () => {
    const expression = workflow.match(/^  group: docs-site-\$\{\{ (.+) \}\}$/m)[1];
    const group = (eventName, schedule) => runInNewContext(expression, {
        github: { event_name: eventName, event: { schedule }, ref_name: 'main' },
    });
    assert.equal(group('schedule', '7 * * * *'), 'main');
    assert.equal(group('push'), 'main');
    assert.equal(group('workflow_dispatch'), 'main');
    assert.equal(group('repository_dispatch'), 'main');
    assert.equal(group('schedule', '17 2 * * *'), 'nightly');
});
