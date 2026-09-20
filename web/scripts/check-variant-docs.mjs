// Aggregate gate for the variant documentation model across every product
// configured in web/variant-docs.yml: the shared-doc audit, the legacy snippet
// ratchet, the shared-topic overlap ratchet, and each variant's own snippet
// validator.

import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadVariantDocsConfig, webRoot } from './variant-docs-config.mjs';

const MESSAGE_PREFIX = '[variant-docs]';

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

async function* markdownFiles(root, skipDirs, current = root) {
    let entries;
    try {
        entries = await fs.readdir(current, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        const entryPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
            if (skipDirs.has(entry.name)) continue;
            yield* markdownFiles(root, skipDirs, entryPath);
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

async function sharedTopicPages(variant, patterns, skipDirs) {
    if (!variant.publicDocs || !patterns.length) return [];

    const matches = [];
    for await (const file of markdownFiles(variant.publicDocs.root, skipDirs)) {
        const rel = path.relative(variant.publicDocs.root, file).replace(/\\/g, '/');
        if (patterns.some((pattern) => matchesPattern(rel, pattern))) {
            const body = await fs.readFile(file, 'utf8');
            if (isSharedTopicBridge(body)) continue;
            matches.push(rel);
        }
    }
    return matches.sort((a, b) => a.localeCompare(b));
}

function isBlockedToolchain(variant, result) {
    if (result.error?.code === 'ENOENT') return true;
    return variant.validator.blockedOutput.some((pattern) => result.output.includes(pattern));
}

function printIndented(output) {
    const trimmed = output.trim();
    if (!trimmed) return;
    for (const line of trimmed.split(/\r?\n/)) {
        console.error(`    ${line}`);
    }
}

const config = await loadVariantDocsConfig();
const failures = [];
const blocked = [];

// Snippet folders are inputs to the axis macros, never standalone pages.
const snippetSkipDirs = new Set(['.git', 'node_modules', ...config.snippetRootBasenames]);

console.log(`${MESSAGE_PREFIX} Running shared-doc audit`);
const audit = await run(process.execPath, [
    'scripts/audit-variant-docs.mjs',
    '--strict',
    '--baseline',
    'scripts/variant-docs-baseline.json',
], webRoot);

if (audit.output.trim()) {
    console.log(audit.output.trim());
}
if (audit.code !== 0) {
    failures.push('Shared-doc audit failed');
}

for (const product of config.products) {
    for (const axis of product.axes) {
        const scope = `${product.key}/${axis.key}`;

        console.log(`${MESSAGE_PREFIX} ${scope}: checking legacy snippet baselines`);
        for (const variant of axis.variants) {
            const count = await countSnippetFiles(path.join(variant.snippetRoot, 'legacy'));
            const baseline = variant.legacySnippetBaseline;
            if (count > baseline) {
                failures.push(`${scope}: ${variant.label} legacy snippets increased from ${baseline} to ${count}`);
            } else {
                const suffix = count < baseline ? `, below baseline ${baseline}` : '';
                console.log(`${MESSAGE_PREFIX} ${scope}: ${variant.label}: ${count} legacy snippets${suffix}`);
            }
        }

        console.log(`${MESSAGE_PREFIX} ${scope}: checking variant public docs for shared-topic overlap`);
        for (const variant of axis.variants) {
            if (!variant.publicDocs) continue;

            const matches = await sharedTopicPages(variant, product.publicDocsAudit.sharedTopicPatterns, snippetSkipDirs);
            const baseline = product.publicDocsAudit.baselines[variant.key] ?? 0;
            if (matches.length > baseline) {
                failures.push(`${scope}: ${variant.label} public shared-topic pages increased from ${baseline} to ${matches.length}`);
            }

            const suffix = matches.length < baseline ? `, below baseline ${baseline}` : '';
            console.log(`${MESSAGE_PREFIX} ${scope}: ${variant.label}: ${matches.length} public shared-topic pages${suffix}`);
            if (matches.length) {
                const preview = matches.slice(0, 8).join(', ');
                const more = matches.length > 8 ? `, +${matches.length - 8} more` : '';
                console.log(`${MESSAGE_PREFIX} ${scope}: ${variant.label}: ${preview}${more}`);
            }
        }

        console.log(`${MESSAGE_PREFIX} ${scope}: running variant snippet validators`);
        for (const variant of axis.variants) {
            if (!variant.validator) {
                console.log(`${MESSAGE_PREFIX} ${scope}: ${variant.label}: no validator configured`);
                continue;
            }

            const result = await run(variant.validator.command, variant.validator.args, variant.validator.cwd);
            if (result.code === 0) {
                console.log(`${MESSAGE_PREFIX} ${scope}: ${variant.label}: validator passed`);
                continue;
            }

            if (isBlockedToolchain(variant, result)) {
                const message = `${scope}: ${variant.label}: validator blocked by missing local toolchain`;
                blocked.push(message);
                console.warn(`${MESSAGE_PREFIX} ${message}`);
                continue;
            }

            failures.push(`${scope}: ${variant.label}: validator failed`);
            printIndented(result.output);
        }
    }
}

if (strictToolchains && blocked.length) {
    failures.push(...blocked);
}

if (failures.length) {
    console.error(`${MESSAGE_PREFIX} Check failed:`);
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    process.exit(1);
}

if (blocked.length) {
    console.warn(`${MESSAGE_PREFIX} Check passed with blocked local validators:`);
    for (const item of blocked) {
        console.warn(`  - ${item}`);
    }
    console.warn(`${MESSAGE_PREFIX} Use --strict-toolchains in CI to make blocked validators fail.`);
} else {
    console.log(`${MESSAGE_PREFIX} Check passed`);
}
