// Audits the Chronicle client documentation model.
//
// Shared Chronicle docs should be language-neutral. Client SDK code belongs in
// client-owned snippets expanded through <ChronicleClientTabs />, or in the
// client-specific docs under /chronicle/clients/<client>/.

import { existsSync } from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';

import { loadChronicleClientDocsConfig, webRoot } from './chronicle-client-docs-config.mjs';

const chronicleClientDocsConfig = await loadChronicleClientDocsConfig();
const chronicleDocsRoot = chronicleClientDocsConfig.sharedDocsRoot;
const clients = chronicleClientDocsConfig.clients.map((client) => ({
    key: client.key,
    label: client.label,
    includeByDefault: client.includeByDefault,
    snippetRoot: client.snippetRoot,
    docsRoot: client.publicDocs?.root,
}));
const defaultClients = clients.filter((client) => client.includeByDefault);

const args = new Set(process.argv.slice(2));
const valueArg = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
};

const strict = args.has('--strict');
const baselinePath = valueArg('--baseline');
const writeBaselinePath = valueArg('--write-baseline');

const skipDirs = new Set([
    '.git',
    'bin',
    'client-snippets',
    'client-snippets-java',
    'node_modules',
    'obj',
    '_includes',
    '_shared',
    '_snippets',
]);

const languageAliases = new Map([
    ['csharp', 'csharp'],
    ['cs', 'csharp'],
    ['java', 'java'],
    ['kotlin', 'kotlin'],
    ['elixir', 'elixir'],
    ['typescript', 'typescript'],
    ['ts', 'typescript'],
    ['tsx', 'typescript'],
]);

async function* markdownFiles(root, current = root) {
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (skipDirs.has(entry.name)) continue;
            if (path.resolve(current) === path.resolve(root) && entry.name === 'clients') continue;
            yield* markdownFiles(root, path.join(current, entry.name));
            continue;
        }

        if (entry.name.endsWith('.md') || entry.name.endsWith('.mdx')) {
            yield path.join(current, entry.name);
        }
    }
}

function fenceRangesAndLanguages(body) {
    const ranges = [];
    const fences = [];
    const lines = body.split(/\r?\n/);
    let offset = 0;
    let current;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const match = line.match(/^([`~]{3,})\s*([A-Za-z0-9_+.-]*)/);
        if (match) {
            const marker = match[1];
            const markerChar = marker[0];
            const lang = languageAliases.get((match[2] ?? '').toLowerCase());

            if (!current) {
                current = { markerChar, markerLength: marker.length, start: offset, line: i + 1, lang };
                if (lang) {
                    fences.push({ line: i + 1, lang });
                }
            } else if (markerChar === current.markerChar && marker.length >= current.markerLength) {
                ranges.push({ start: current.start, end: offset + line.length });
                current = undefined;
            }
        }

        offset += line.length + 1;
    }

    if (current) {
        ranges.push({ start: current.start, end: body.length });
    }

    return { ranges, fences };
}

function isInRange(index, ranges) {
    return ranges.some((range) => index >= range.start && index <= range.end);
}

function getAttr(attrs, name) {
    const match = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
    return match ? (match[2] ?? match[3] ?? '') : null;
}

async function snippetExists(client, snippet) {
    for (const ext of ['.mdx', '.md']) {
        try {
            await fs.access(path.join(client.snippetRoot, snippet + ext));
            return true;
        } catch {
            // Try the next supported extension.
        }
    }
    return false;
}

async function collectAudit() {
    const directFences = new Map();
    const placeholders = [];
    const missingSnippets = [];
    const missingRoots = [];

    for (const client of clients) {
        if (!existsSync(client.snippetRoot)) {
            missingRoots.push(`${client.label} snippet root: ${client.snippetRoot}`);
        }
        if (client.docsRoot && !existsSync(client.docsRoot)) {
            missingRoots.push(`${client.label} docs root: ${client.docsRoot}`);
        }
    }

    for await (const file of markdownFiles(chronicleDocsRoot)) {
        const body = await fs.readFile(file, 'utf8');
        const rel = path.relative(chronicleDocsRoot, file).replace(/\\/g, '/');
        const { ranges, fences } = fenceRangesAndLanguages(body);

        for (const fence of fences) {
            const fileEntry = directFences.get(rel) ?? {};
            fileEntry[fence.lang] = (fileEntry[fence.lang] ?? 0) + 1;
            directFences.set(rel, fileEntry);
        }

        const componentRe = /^[ \t]*<ChronicleClientTabs\s+([^>]*)\/>[ \t]*$/gm;
        for (const match of body.matchAll(componentRe)) {
            const index = match.index ?? 0;
            if (isInRange(index, ranges)) continue;

            const attrs = match[1];
            const snippet = getAttr(attrs, 'snippet');
            if (!snippet) {
                missingSnippets.push(`${rel}: ChronicleClientTabs is missing snippet="..."`);
                continue;
            }

            const requested = (getAttr(attrs, 'clients') ?? defaultClients.map((client) => client.key).join(','))
                .split(',')
                .map((client) => client.trim().toLowerCase())
                .filter(Boolean);

            placeholders.push({ file: rel, snippet, clients: requested });

            for (const key of requested) {
                const client = clients.find((candidate) => candidate.key === key);
                if (!client) {
                    missingSnippets.push(`${rel}: unknown Chronicle client "${key}" for snippet "${snippet}"`);
                    continue;
                }
                if (!(await snippetExists(client, snippet))) {
                    missingSnippets.push(`${rel}: missing ${client.label} snippet "${snippet}" in ${client.snippetRoot}`);
                }
            }
        }
    }

    return { directFences, placeholders, missingSnippets, missingRoots };
}

function directFenceBaselineMap(directFences) {
    return Object.fromEntries(
        [...directFences.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([file, languages]) => [
                file,
                Object.fromEntries(
                    Object.entries(languages)
                        .filter(([, count]) => count > 0)
                        .sort(([a], [b]) => a.localeCompare(b))
                ),
            ])
    );
}

async function readBaseline(filePath) {
    const absolute = path.resolve(webRoot, filePath);
    const raw = await fs.readFile(absolute, 'utf8');
    const parsed = JSON.parse(raw);
    return parsed.directClientLanguageFences ?? {};
}

function compareBaseline(current, baseline) {
    const regressions = [];
    for (const [file, languages] of Object.entries(current)) {
        for (const [language, count] of Object.entries(languages)) {
            const allowed = baseline[file]?.[language] ?? 0;
            if (count > allowed) {
                regressions.push(`${file}: ${language} fences increased from ${allowed} to ${count}`);
            }
        }
    }
    return regressions;
}

function totalFences(map) {
    return Object.values(map)
        .flatMap((languages) => Object.values(languages))
        .reduce((total, count) => total + count, 0);
}

function printTopDirectFences(current) {
    const rows = Object.entries(current)
        .map(([file, languages]) => ({
            file,
            count: Object.values(languages).reduce((total, count) => total + count, 0),
            languages,
        }))
        .sort((a, b) => b.count - a.count || a.file.localeCompare(b.file))
        .slice(0, 20);

    for (const row of rows) {
        const summary = Object.entries(row.languages)
            .map(([language, count]) => `${language}:${count}`)
            .join(', ');
        console.warn(`  ${row.file} (${summary})`);
    }
}

const audit = await collectAudit();
const current = directFenceBaselineMap(audit.directFences);

if (writeBaselinePath) {
    const absolute = path.resolve(webRoot, writeBaselinePath);
    const baseline = {
        version: 1,
        description: 'Known direct client-language fences in shared Chronicle docs. Lower counts are allowed; increases fail the audit.',
        directClientLanguageFences: current,
    };
    await fs.writeFile(absolute, JSON.stringify(baseline, null, 2) + '\n', 'utf8');
    console.log(`[chronicle-client-docs] Wrote baseline: ${path.relative(webRoot, absolute)}`);
}

const directFenceCount = totalFences(current);
console.log(`[chronicle-client-docs] Checked ${clients.length} clients`);
console.log(`[chronicle-client-docs] Found ${audit.placeholders.length} ChronicleClientTabs placeholders`);
console.log(`[chronicle-client-docs] Found ${directFenceCount} direct client-language fences in shared Chronicle docs`);

if (directFenceCount > 0) {
    console.warn('[chronicle-client-docs] Top shared-doc files still needing snippet migration:');
    printTopDirectFences(current);
}

const failures = [];
failures.push(...audit.missingRoots.map((message) => `Missing root: ${message}`));
failures.push(...audit.missingSnippets);

if (baselinePath) {
    const baseline = await readBaseline(baselinePath);
    failures.push(...compareBaseline(current, baseline));
}

if (strict && directFenceCount > 0) {
    failures.push(`Strict mode failed: ${directFenceCount} direct client-language fences remain in shared Chronicle docs`);
}

if (failures.length) {
    console.error('[chronicle-client-docs] Audit failed:');
    for (const failure of failures) {
        console.error(`  - ${failure}`);
    }
    process.exit(1);
}

console.log('[chronicle-client-docs] Audit passed');
