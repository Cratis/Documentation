import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadChronicleClientDocsConfig, webRoot } from './chronicle-client-docs-config.mjs';

const args = new Set(process.argv.slice(2));
const strictToolchains = args.has('--strict-toolchains');

function run(command, commandArgs, cwd) {
    return new Promise((resolve) => {
        const child = spawn(command, commandArgs, {
            cwd,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: process.env,
        });

        let output = '';
        child.stdout.on('data', (chunk) => { output += chunk.toString(); });
        child.stderr.on('data', (chunk) => { output += chunk.toString(); });
        child.on('error', (error) => {
            resolve({ code: 127, output: `${error.name}: ${error.message}`, error });
        });
        child.on('close', (code) => {
            resolve({ code: code ?? 1, output });
        });
    });
}

async function countSnippetFiles(root) {
    let count = 0;
    let entries;
    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
        return 0;
    }

    for (const entry of entries) {
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) {
            count += await countSnippetFiles(entryPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
            count++;
        }
    }

    return count;
}

async function* markdownFiles(root, current = root) {
    let entries;
    try {
        entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
            if (['.git', 'client-snippets', 'client-snippets-java', 'node_modules'].includes(entry.name)) continue;
            yield* markdownFiles(root, entryPath);
        } else if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
            yield entryPath;
        }
    }
}

function matchesPattern(relativePath, pattern) {
    const normalized = relativePath.replace(/\\/g, '/');
    if (pattern.endsWith('/**')) {
        const prefix = pattern.slice(0, -3);
        return normalized === prefix || normalized.startsWith(`${prefix}/`);
    }
    return normalized === pattern;
}

function isSharedTopicBridge(body) {
    const match = body.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!match) return false;
    return /^sharedTopicBridge:\s*true\s*$/m.test(match[1]);
}

async function sharedTopicPages(client, patterns) {
    if (!client.publicDocs || !patterns.length) return [];

    const matches = [];
    for await (const file of markdownFiles(client.publicDocs.root)) {
        const rel = path.relative(client.publicDocs.root, file).replace(/\\/g, '/');
        if (patterns.some((pattern) => matchesPattern(rel, pattern))) {
            const body = await fs.readFile(file, 'utf8');
            if (isSharedTopicBridge(body)) continue;
            matches.push(rel);
        }
    }
    return matches.sort((a, b) => a.localeCompare(b));
}

function isBlockedToolchain(client, result) {
    if (result.error?.code === 'ENOENT') return true;
    return client.validator.blockedOutput.some((pattern) => result.output.includes(pattern));
}

function printIndented(output) {
    const trimmed = output.trim();
    if (!trimmed) return;
    for (const line of trimmed.split(/\r?\n/)) {
        console.error(`    ${line}`);
    }
}

const config = await loadChronicleClientDocsConfig();
const failures = [];
const blocked = [];

console.log('[chronicle-client-docs] Running shared-doc audit');
const audit = await run(process.execPath, [
    'scripts/audit-chronicle-client-docs.mjs',
    '--strict',
    '--baseline',
    'scripts/chronicle-client-docs-baseline.json',
], webRoot);

if (audit.output.trim()) {
    console.log(audit.output.trim());
}
if (audit.code !== 0) {
    failures.push('Shared-doc audit failed');
}

console.log('[chronicle-client-docs] Checking legacy snippet baselines');
for (const client of config.clients) {
    const count = await countSnippetFiles(path.join(client.snippetRoot, 'legacy'));
    const baseline = client.legacySnippetBaseline;
    if (count > baseline) {
        failures.push(`${client.label} legacy snippets increased from ${baseline} to ${count}`);
    } else {
        const suffix = count < baseline ? `, below baseline ${baseline}` : '';
        console.log(`[chronicle-client-docs] ${client.label}: ${count} legacy snippets${suffix}`);
    }
}

console.log('[chronicle-client-docs] Checking client public docs for shared-topic overlap');
for (const client of config.clients) {
    if (!client.publicDocs) continue;

    const matches = await sharedTopicPages(client, config.publicDocsAudit.sharedTopicPatterns);
    const baseline = config.publicDocsAudit.baselines[client.key] ?? 0;
    if (matches.length > baseline) {
        failures.push(`${client.label} public shared-topic pages increased from ${baseline} to ${matches.length}`);
    }

    const suffix = matches.length < baseline ? `, below baseline ${baseline}` : '';
    console.log(`[chronicle-client-docs] ${client.label}: ${matches.length} public shared-topic pages${suffix}`);
    if (matches.length) {
        const preview = matches.slice(0, 8).join(', ');
        const more = matches.length > 8 ? `, +${matches.length - 8} more` : '';
        console.log(`[chronicle-client-docs] ${client.label}: ${preview}${more}`);
    }
}

console.log('[chronicle-client-docs] Running client snippet validators');
for (const client of config.clients) {
    if (!client.validator) {
        console.log(`[chronicle-client-docs] ${client.label}: no validator configured`);
        continue;
    }

    const result = await run(client.validator.command, client.validator.args, client.validator.cwd);
    if (result.code === 0) {
        console.log(`[chronicle-client-docs] ${client.label}: validator passed`);
        continue;
    }

    if (isBlockedToolchain(client, result)) {
        const message = `${client.label}: validator blocked by missing local toolchain`;
        blocked.push(message);
        console.warn(`[chronicle-client-docs] ${message}`);
        continue;
    }

    failures.push(`${client.label}: validator failed`);
    printIndented(result.output);
}

if (strictToolchains && blocked.length) {
    failures.push(...blocked);
}

if (failures.length) {
    console.error('[chronicle-client-docs] Check failed:');
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    process.exit(1);
}

if (blocked.length) {
    console.warn('[chronicle-client-docs] Check passed with blocked local validators:');
    for (const item of blocked) {
        console.warn(`  - ${item}`);
    }
    console.warn('[chronicle-client-docs] Use --strict-toolchains in CI to make blocked validators fail.');
} else {
    console.log('[chronicle-client-docs] Check passed');
}
