// Converts DocFX-format product documentation into Starlight-ready content.
//
// Source of truth stays in each product repo's `Documentation/` folder. This
// script reads those folders and emits converted Markdown into
// `web/src/content/docs/<product>/` (generated — gitignored). Run via the
// `predev`/`prebuild` npm hooks, or directly:  node scripts/sync-content.mjs [product]
//
// First pass = mechanical conversion (frontmatter, DocFX alerts, xref, INCLUDE,
// link fixups). Sidebar order/Diátaxis re-bucketing is layered on afterwards.

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

import { existsSync } from 'node:fs';
import { loadChronicleClientDocsConfig } from './chronicle-client-docs-config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..'); // Documentation/web
const docRepoRoot = path.resolve(webRoot, '..'); // Documentation/  (submodules live here in CI)
const reposRoot = path.resolve(webRoot, '..', '..'); // cratis/      (sibling clones live here locally)

// Each product's docs can come from a sibling clone next to this repo (local dev
// and the docs-site CI workflow) or a git submodule inside the Documentation repo
// (fallback layout). Prefer the sibling so the branch under test wins; fall back
// to the submodule.
function firstExisting(...candidates) {
    return candidates.find((c) => existsSync(c)) ?? candidates[candidates.length - 1];
}

const chronicleClientDocsConfig = await loadChronicleClientDocsConfig();

const PRODUCTS = [
    {
        key: 'chronicle', label: 'Chronicle', icon: 'seti:db', sidebarMode: 'toc',
        src: chronicleClientDocsConfig.sharedDocsRoot,
        buckets: [
            { label: 'Start here', sections: ['Getting started', 'Tutorial', 'Scenarios'] },
            {
                label: 'Concepts and architecture',
                sections: ['Why Event Sourcing', 'CRUD, EF Core, and Chronicle', 'Understanding constraints', 'Understanding event evolution', 'Concepts', 'Architecture', 'Dynamic Consistency Boundary'],
            },
            {
                label: 'Event store',
                sections: [
                    'Events', 'Event Seeding', 'Namespaces', 'Constraints', 'Closing Streams',
                    'Migrations', 'Compliance',
                ],
            },
            {
                label: 'Read models and processing',
                sections: ['Read Models', 'Projections', 'Reactors', 'Reducers', 'Subscriptions', 'Sinks', 'Jobs', 'Webhooks'],
            },
            {
                label: 'Running Chronicle',
                sections: ['Hosting', 'Configuration', 'Connection Strings', 'Testing', 'Troubleshooting'],
            },
            { label: 'Workbench', sections: ['Workbench'] },
            {
                label: 'Reference',
                sections: ['Code Analysis', 'Statistics', 'Contributing'],
            },
        ],
    },
    {
        key: 'arc', label: 'Arc', icon: 'puzzle', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Arc', 'Documentation'),
            path.join(docRepoRoot, 'Arc', 'Documentation')),
        buckets: [
            { label: 'Start here', sections: ['Tutorial', 'Scenarios'] },
            { label: 'Concepts and architecture', sections: ['Why Arc', 'CQRS without event sourcing', 'MediatR, MVC, and Arc', 'Vertical slices', 'Understanding the proxy boundary', 'Understanding identity and access'] },
            { label: 'Backend', sections: ['Backend'] },
            { label: 'Integrations', sections: ['Integrate with Chronicle'] },
            { label: 'Frontend', sections: ['Frontend'] },
            { label: 'Operations and reference', sections: ['General', 'Troubleshooting'] },
        ],
    },
    {
        key: 'components', label: 'Components', icon: 'laptop', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Components', 'Documentation'),
            path.join(docRepoRoot, 'Components', 'Documentation')),
        buckets: [
            { label: 'Start here', sections: ['Getting started', 'Tutorial', 'Choosing a component'] },
            { label: 'Design and styling', sections: ['Why Components', 'PrimeReact and Components', 'Styling'] },
            { label: 'Recipes', sections: ['Building a form', 'Displaying data', 'Multi-step form', 'A list screen with actions'] },
            {
                label: 'Component library',
                sections: [
                    'Storybook', 'CommandDialog', 'CommandForm', 'CommandStepper', 'StepperCommandDialog', 'DataPage',
                    'DataTables', 'Dialogs', 'Filter', 'Dropdown', 'Toolbar', 'ObjectNavigationalBar',
                    'ObjectContentEditor', 'PivotViewer', 'SchemaEditor', 'TimeMachine', 'Common',
                ],
            },
            { label: 'Reference', sections: ['Types', 'Migration'] },
        ],
    },
    {
        // Screenplay — the modeling language. A single declarative `.play` file describes
        // a whole bounded context; Stage runs it live and Studio visualizes the same model.
        // Content lives in the `screenplay/` subfolder, so point straight at it for clean
        // `/screenplay/<page>` URLs (the outer Documentation/ wrapper isn't a site page).
        key: 'screenplay', label: 'Screenplay', icon: 'pencil', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Screenplay', 'Documentation', 'screenplay'),
            path.join(docRepoRoot, 'Screenplay', 'Documentation', 'screenplay')),
        buckets: [
            { label: 'Start here', sections: ['Getting started'] },
            { label: 'Understand', sections: ['Why Screenplay', 'Language overview', 'Concepts', 'Policies', 'Modules, features and slices'] },
            {
                label: 'Language constructs',
                sections: ['Events', 'Commands', 'Queries', 'Projections', 'Captures', 'Constraints', 'Reactors', 'Screens'],
            },
            { label: 'Reference', sections: ['Sub-language pluggability', 'Grammar', 'Glossary', 'Frequently asked questions'] },
        ],
    },
    {
        // The Cratis CLI — a terminal window into a running Chronicle event store.
        key: 'cli', label: 'CLI', icon: 'rocket', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'cli', 'Documentation'),
            path.join(docRepoRoot, 'CLI', 'Documentation'),
            path.join(docRepoRoot, 'cli', 'Documentation')),
        buckets: [
            { label: 'Start here', sections: ['Getting Started', 'Context'] },
            { label: 'Commands', sections: ['Chronicle', 'Arc'] },
            { label: 'Reference', sections: ['Reference'] },
        ],
    },
    {
        // Shared utilities (concepts, serialization, DI, type discovery) for .NET and TS.
        key: 'fundamentals', label: 'Fundamentals', icon: 'seti:folder', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Fundamentals', 'Documentation'),
            path.join(docRepoRoot, 'Fundamentals', 'Documentation')),
    },
    {
        // The Cratis/.github org repo (submodule "GitHubLanding") holds the Contributing docs.
        key: 'contributing', label: 'Contributing', icon: 'heart', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, '.github'),
            path.join(docRepoRoot, 'GitHubLanding')),
    },
    {
        // Roslyn analyzers enforcing Cratis architectural conventions across all products.
        key: 'architecture', label: 'Architecture', icon: 'seti:config', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Architecture', 'Documentation'),
            path.join(docRepoRoot, 'Architecture', 'Documentation')),
        buckets: [
            { label: 'Code Analysis', sections: ['Documentation'] },
        ],
    },
    {
        // Prompter — the community's Discord documentation assistant (RAG bot). Not a stack
        // layer you build with; it lives on Discord and answers, with citations, grounded in
        // this very site. Its docs are already Diataxis-shaped (Getting started / Guides /
        // Concepts / Reference), so no bucket re-grouping is needed.
        key: 'prompter', label: 'Prompter', icon: 'discord', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Prompter', 'Documentation'),
            path.join(docRepoRoot, 'Prompter', 'Documentation')),
    },
];

const CHRONICLE_CLIENT_SNIPPETS = chronicleClientDocsConfig.snippetClients;
const CHRONICLE_CLIENT_DOCS = chronicleClientDocsConfig.publicDocsClients;
const CHRONICLE_SHARED_TOPICS = chronicleClientDocsConfig.sharedTopics;

const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.html', '.js', '.css', '.json']);
const SKIP_DIRS = new Set([
    'node_modules', 'obj', 'bin', '.git', 'storybook-static', '.vitepress',
    // Shared Markdown snippets are included into pages but should not become pages.
    '_includes', '_shared', '_snippets',
    // Client-owned snippets are expanded into shared Chronicle pages through
    // <ChronicleClientTabs />; they are not standalone public docs pages.
    'client-snippets', 'client-snippets-java',
    // dotfolders found at the .github repo root that are not documentation
    '.ai', '.claude', '.github', '.vscode',
    // the org GitHub landing page (duplicates our front door) — not site content
    'profile',
]);
const ALERT_MAP = { NOTE: 'note', TIP: 'tip', IMPORTANT: 'note', WARNING: 'caution', CAUTION: 'danger' };

const only = process.argv[2];

function humanize(name) {
    return name
        .replace(/\.mdx?$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function splitFrontmatter(raw) {
    if (raw.startsWith('---')) {
        const end = raw.indexOf('\n---', 3);
        if (end !== -1) {
            const fmText = raw.slice(3, end).replace(/^\n/, '');
            const body = raw.slice(end + 4).replace(/^\r?\n/, '');
            return { fmText, body, hasFm: true };
        }
    }
    return { fmText: '', body: raw, hasFm: false };
}

function firstH1(body) {
    const m = body.match(/^#\s+(.+?)\s*$/m);
    return m ? m[1].trim() : null;
}

function stripLeadingH1(body) {
    // Starlight renders the frontmatter title as the page H1; drop a duplicate leading H1.
    return body.replace(/^\s*#\s+.+?\r?\n+/, '');
}

function quoteYaml(s) {
    return '"' + s.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}

function convertAlerts(body) {
    const lines = body.split('\n');
    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const m = lines[i].match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*$/);
        if (m) {
            const type = ALERT_MAP[m[1]];
            const inner = [];
            i++;
            while (i < lines.length && /^>/.test(lines[i])) {
                inner.push(lines[i].replace(/^>\s?/, ''));
                i++;
            }
            i--; // step back; outer loop will advance
            out.push(`:::${type}`);
            out.push(...inner);
            out.push(':::');
        } else {
            out.push(lines[i]);
        }
    }
    return out.join('\n');
}

function convertXref(body) {
    let out = body;
    // Link form: [text](xref:UID) -> keep the human text (the API ref isn't a page here).
    out = out.replace(/\[([^\]]+)\]\(\s*xref:[^)]+\)/g, (_m, text) => text);
    // Inline form: <xref:Foo.Bar>, <xref:Foo.Bar?text=Baz>, <xref:Foo.Bar?displayProperty=...>
    out = out.replace(/<xref:([^>]+)>/g, (_m, inner) => {
        const q = inner.indexOf('?');
        const uid = q === -1 ? inner : inner.slice(0, q);
        const query = q === -1 ? '' : inner.slice(q + 1);
        const tm = query.match(/(?:^|&)text=([^&]*)/);
        return tm ? decodeURIComponent(tm[1].replace(/\+/g, ' ')) : '`' + uid + '`';
    });
    return out;
}

function extractFmField(fmText, field) {
    const m = fmText.match(new RegExp('^' + field + '\\s*:\\s*(.+?)\\s*$', 'm'));
    if (!m) return null;
    return m[1].trim().replace(/^["']/, '').replace(/["']$/, '');
}

function splitLinkTarget(target) {
    const trimmed = target.trim();
    const m = trimmed.match(/^(\S+)(.*)$/s);
    return m ? { url: m[1], suffix: m[2] || '' } : { url: trimmed, suffix: '' };
}

function splitUrlSuffix(url) {
    const hash = url.indexOf('#');
    const query = url.indexOf('?');
    const cut = [hash, query].filter((i) => i !== -1).sort((a, b) => a - b)[0];
    if (cut === undefined) return { pathPart: url, suffix: '' };
    return { pathPart: url.slice(0, cut), suffix: url.slice(cut) };
}

function isExternalOrSpecial(url) {
    return /^(https?:|mailto:|tel:|#|data:|javascript:|blob:)/i.test(url) || url.startsWith('//');
}

function stripDocTarget(pathPart) {
    let out = pathPart;
    if (/\/?toc\.ya?ml$/i.test(out)) {
        out = out.replace(/\/?toc\.ya?ml$/i, '');
    } else if (/\.mdx?$/i.test(out)) {
        out = out.replace(/\.mdx?$/i, '');
        out = out.replace(/\/index$/i, '/').replace(/(^|\/)index$/i, '$1');
    }
    return out;
}

function slugifyPath(urlPath) {
    const leadingSlash = urlPath.startsWith('/');
    const trailingSlash = urlPath.endsWith('/');
    let normalized = path.posix.normalize(urlPath.replace(/\\/g, '/'));
    if (leadingSlash && !normalized.startsWith('/')) normalized = '/' + normalized;
    if (trailingSlash && !normalized.endsWith('/')) normalized += '/';
    const slugged = normalized
        .split('/')
        .map((seg) => (seg === '' || seg === '.' || seg === '..' ? seg : seg.toLowerCase().replace(/[^a-z0-9_-]+/g, '')))
        .join('/');
    return leadingSlash && !slugged.startsWith('/') ? '/' + slugged : slugged;
}

function withTrailingSlash(urlPath) {
    if (urlPath === '/') return urlPath;
    return urlPath.endsWith('/') ? urlPath : urlPath + '/';
}

function resolveInternalLink(ctx, target) {
    const { url, suffix: titleSuffix } = splitLinkTarget(target);
    if (!url || isExternalOrSpecial(url)) return target;

    const { pathPart: originalPathPart, suffix: urlSuffix } = splitUrlSuffix(url);
    if (!originalPathPart) return target;
    if (ASSET_EXT.has(path.extname(originalPathPart).toLowerCase())) return target;

    const strippedPath = stripDocTarget(originalPathPart);
    let resolvedPath;

    if (strippedPath.startsWith('/')) {
        // Product-doc links should follow Astro's slug rules. Generated assets and
        // reference sites under /api and /storybook already have literal paths.
        if (/^\/(?:api|storybook|storybook-arc)(?:\/|$)/i.test(strippedPath)) {
            resolvedPath = strippedPath;
        } else {
            const ext = path.extname(strippedPath);
            resolvedPath = slugifyPath(strippedPath);
            if (!ext) resolvedPath = withTrailingSlash(resolvedPath);
        }
    } else {
        const contentRoot = ctx.contentRoot ?? ctx.product.src;
        const slugBase = ctx.slugBase ?? ctx.product.key;
        const absoluteTarget = path.resolve(ctx.dir, strippedPath || '.');
        const relToProduct = path.relative(contentRoot, absoluteTarget).replace(/\\/g, '/');
        if (relToProduct.startsWith('..') || path.isAbsolute(relToProduct)) return target;
        const slug = slugifyPath(relToProduct).replace(/^\/+|\/+$/g, '');
        resolvedPath = withTrailingSlash('/' + slugBase + (slug ? '/' + slug : ''));
    }

    return resolvedPath + urlSuffix + titleSuffix;
}

function fixLinks(body, ctx) {
    // Markdown links/images: ](target)
    let out = body.replace(/\]\(([^)]+)\)/g, (whole, target) => '](' + resolveInternalLink(ctx, target) + ')');

    // MDX/HTML attributes used by Starlight cards and authored links. These do
    // not appear in Markdown link syntax, so they must be normalized separately.
    out = out.replace(/\bhref=(["'])([^"']+)\1/g, (_whole, quote, target) => {
        return `href=${quote}${resolveInternalLink(ctx, target)}${quote}`;
    });

    return out;
}

async function inlineIncludes(body, dir, sourcePath) {
    const includeRe = /\[!INCLUDE\s*\[[^\]]*\]\(([^)]+)\)\]/g;
    let result = body;
    const matches = [...body.matchAll(includeRe)];
    for (const m of matches) {
        const incPath = path.resolve(dir, m[1]);
        try {
            const raw = await fs.readFile(incPath, 'utf8');
            const { body: incBody } = splitFrontmatter(raw);
            result = result.replace(m[0], stripLeadingH1(incBody).trim());
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            throw new Error(`[sync] Failed to include ${m[1]} from ${sourcePath}: ${message}`);
        }
    }
    return result;
}

function getAttr(attrs, name) {
    const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`));
    return m ? (m[2] ?? m[3] ?? '') : null;
}

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

// Returns null when the client repo has no snippet for this id — that just
// means the tab is omitted, not an error. Chronicle shared docs don't track
// which clients apply to a given example; that's discovered from disk.
async function readClientSnippet(source, snippet) {
    for (const ext of ['.mdx', '.md']) {
        const candidate = path.join(source.src, snippet + ext);
        if (await fileExists(candidate)) {
            const raw = await fs.readFile(candidate, 'utf8');
            const { body } = splitFrontmatter(raw);
            return body.trim();
        }
    }
    return null;
}

function isInsideFencedCode(body, index) {
    const prefix = body.slice(0, index);
    const backtickFences = prefix.match(/^```/gm)?.length ?? 0;
    const tildeFences = prefix.match(/^~~~/gm)?.length ?? 0;
    return backtickFences % 2 === 1 || tildeFences % 2 === 1;
}

function ensureTabsImport(body) {
    const importRe = /import\s+\{([^}]+)\}\s+from\s+['"]@astrojs\/starlight\/components['"];?/;
    const existing = body.match(importRe);
    if (!existing) {
        return `import { Tabs, TabItem } from '@astrojs/starlight/components';\n\n${body}`;
    }

    const names = existing[1]
        .split(',')
        .map((name) => name.trim())
        .filter(Boolean);
    for (const name of ['Tabs', 'TabItem']) {
        if (!names.includes(name)) names.push(name);
    }

    return body.replace(importRe, `import { ${names.join(', ')} } from '@astrojs/starlight/components';`);
}

async function expandChronicleClientTabs(body, ctx) {
    if (ctx.product.key !== 'chronicle' || !body.includes('<ChronicleClientTabs')) {
        return { body, used: false };
    }

    const componentRe = /^[ \t]*<ChronicleClientTabs\s+([^>]*)\/>[ \t]*$/gm;
    const parts = [];
    let expandedAny = false;
    let lastIndex = 0;

    for (const match of body.matchAll(componentRe)) {
        const index = match.index ?? 0;
        if (isInsideFencedCode(body, index)) {
            continue;
        }

        const attrs = match[1];
        const snippet = getAttr(attrs, 'snippet');
        if (!snippet) {
            throw new Error(`[sync] ChronicleClientTabs in ${ctx.srcPath} is missing snippet="..."`);
        }

        const syncKey = getAttr(attrs, 'syncKey') ?? 'chronicle-client';

        const tabs = [];
        for (const source of CHRONICLE_CLIENT_SNIPPETS) {
            const content = await readClientSnippet(source, snippet);
            if (content === null) continue;
            tabs.push({ source, content });
        }

        if (!tabs.length) {
            throw new Error(
                `[sync] ChronicleClientTabs snippet "${snippet}" in ${ctx.srcPath} has no matching snippet in any client repo`
            );
        }

        const expanded = [
            `<Tabs syncKey="${syncKey}">`,
            ...tabs.flatMap(({ source, content }) => [
                `<TabItem label="${source.label}">`,
                '',
                content,
                '',
                `</TabItem>`,
            ]),
            `</Tabs>`,
        ].join('\n');

        parts.push(body.slice(lastIndex, index), expanded);
        lastIndex = index + match[0].length;
        expandedAny = true;
    }

    if (!expandedAny) {
        return { body, used: false };
    }

    parts.push(body.slice(lastIndex));
    const result = parts.join('');
    return { body: expandedAny ? ensureTabsImport(result) : result, used: expandedAny };
}

async function convertFile(raw, ctx) {
    const { fmText, body, hasFm } = splitFrontmatter(raw);
    // Parse source front matter and carry over only Starlight-supported keys
    // (title, description, sidebar). DocFX keys (uid, applyTo, storybook, …) are
    // dropped — they'd fail Starlight's strict schema.
    let src = {};
    if (hasFm) {
        try {
            src = yaml.load(fmText) || {};
        } catch {
            src = {};
        }
    }
    const title = src.title || firstH1(body) || humanize(ctx.basename);

    let out = stripLeadingH1(body);
    out = await inlineIncludes(out, ctx.dir, ctx.srcPath ?? path.join(ctx.dir, ctx.basename));
    ({ body: out } = await expandChronicleClientTabs(out, ctx));
    out = convertAlerts(out);
    out = convertXref(out);
    out = fixLinks(out, ctx);

    const fm = { title };
    if (src.description) fm.description = src.description;
    if (src.sidebar) fm.sidebar = src.sidebar; // order/label/badge, when authors set it
    if (src.tableOfContents !== undefined) fm.tableOfContents = src.tableOfContents;
    const fmYaml = yaml.dump(fm, { lineWidth: -1 }).trimEnd();
    return `---\n${fmYaml}\n---\n\n` + out.replace(/\s*$/, '') + '\n';
}

// True when `parentDir` contains a `<dirName>.md` file (case-insensitive). DocFX
// often has both `foo.md` (section landing) and `foo/index.md`, which collide on
// the slug `.../foo`; when that happens we demote `foo/index.md` to `overview`.
async function hasSiblingLanding(parentDir, dirName) {
    try {
        const entries = await fs.readdir(parentDir);
        const target = (dirName + '.md').toLowerCase();
        return entries.some((n) => n.toLowerCase() === target);
    } catch {
        return false;
    }
}

async function walk(srcDir, outDir, product, options = {}) {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await fs.mkdir(outDir, { recursive: true });
    const demoteIndex = await hasSiblingLanding(path.dirname(srcDir), path.basename(srcDir));
    for (const entry of entries) {
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            if (product.key === 'chronicle' && !options.slugBase && path.resolve(srcDir) === path.resolve(product.src) && entry.name === 'clients') continue;
            await walk(path.join(srcDir, entry.name), path.join(outDir, entry.name), product, options);
            continue;
        }
        // Skip repo READMEs (e.g. the .github org landing) — not site content.
        if (entry.name.toLowerCase() === 'readme.md') continue;
        const ext = path.extname(entry.name).toLowerCase();
        const srcPath = path.join(srcDir, entry.name);
        if (ext === '.md' || ext === '.mdx') {
            const raw = await fs.readFile(srcPath, 'utf8');
            const converted = await convertFile(raw, {
                dir: srcDir,
                basename: entry.name,
                srcPath,
                product,
                contentRoot: options.contentRoot,
                slugBase: options.slugBase,
            });
            // Keep the source extension: `.md` stays Markdown, `.mdx` stays MDX so
            // authored getting-started pages can use Starlight components (<Steps>,
            // <Tabs>, <Aside>, <FileTree>). The converter's transforms are safe on MDX.
            let outName = entry.name;
            if (demoteIndex && /^index\.mdx?$/i.test(entry.name)) {
                outName = ext === '.mdx' ? 'overview.mdx' : 'overview.md';
            }
            await fs.writeFile(path.join(outDir, outName), converted, 'utf8');
        } else if (ASSET_EXT.has(ext)) {
            await fs.copyFile(srcPath, path.join(outDir, entry.name));
        }
        // toc.yml and other files are intentionally skipped (sidebar handled separately).
    }
}

async function availableChronicleClientDocs() {
    const available = [];
    for (const client of CHRONICLE_CLIENT_DOCS) {
        try {
            await fs.access(client.src);
            available.push(client);
        } catch {
            // Client repositories are optional for local partial builds.
        }
    }
    return available;
}

async function writeChronicleClientsLanding(outDir, clients) {
    if (!clients.length) return;

    const clientsDir = path.join(outDir, 'clients');
    await fs.mkdir(clientsDir, { recursive: true });
    const topicLinks = CHRONICLE_SHARED_TOPICS
        .map((topic) => `- [${topic.label}](${topic.href})`)
        .join('\n');
    const clientLinks = clients
        .map((client) => `- [${client.label}](/chronicle/clients/${client.key}/)`)
        .join('\n');

    const body = `---\ntitle: Client SDKs\n---\n\nChronicle concepts, guides, and feature workflows live in the shared Chronicle docs and use language tabs when the client APIs differ. Use the client SDK sections for installation, connection setup, runtime integration, language idioms, and API reference details.\n\n## Shared Chronicle topics\n\n${topicLinks}\n\n## Client SDK details\n\n${clientLinks}\n`;

    await fs.writeFile(path.join(clientsDir, 'index.md'), body, 'utf8');
}

async function syncChronicleClientDocs(outDir, product) {
    const clients = await availableChronicleClientDocs();
    await writeChronicleClientsLanding(outDir, clients);

    for (const client of clients) {
        await walk(
            client.src,
            path.join(outDir, 'clients', client.key),
            product,
            {
                contentRoot: client.src,
                slugBase: `chronicle/clients/${client.key}`,
            }
        );
    }
}

// ---- Sidebar generation from DocFX toc.yml ----

// Replicates Astro's content-collection slug rule (github-slugger semantics):
// lowercase per segment, keep a-z 0-9 '_' '-', strip other punctuation
// (so `react.mvvm` -> `reactmvvm`, `CODE_OF_CONDUCT` -> `code_of_conduct`).
function slugify(p) {
    return p
        .replace(/\\/g, '/')
        .split('/')
        .map((seg) => seg.toLowerCase().replace(/[^a-z0-9_-]+/g, ''))
        .filter(Boolean)
        .join('/');
}

let validSlugs = new Set();
let droppedSidebarEntries = 0;

// Collect the slugs of every page actually written for a product, so the
// sidebar can drop entries that point to missing pages (broken toc links).
async function collectSlugs(dirAbs, slugBase, set) {
    let entries;
    try {
        entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (e.isDirectory()) {
            await collectSlugs(path.join(dirAbs, e.name), slugify(path.posix.join(slugBase, e.name)), set);
        } else if (e.name.endsWith('.md') || e.name.endsWith('.mdx')) {
            const base = e.name.replace(/\.mdx?$/, '');
            set.add(base === 'index' ? slugify(slugBase) : slugify(path.posix.join(slugBase, base)));
        }
    }
}

async function entryToItem(e, dirAbs, slugBase) {
    const label = e.name ?? 'Untitled';
    const href = e.href;
    // External links and the auto-generated API section are wired separately — skip.
    if (href && (/^https?:/.test(href) || href.includes('/api/') || href.startsWith('../'))) {
        return null;
    }
    // Group via a sub-folder's toc.yml
    if (href && /toc\.yml$/.test(href)) {
        const subRel = href.replace(/\/?toc\.yml$/, '');
        const subDirAbs = path.resolve(dirAbs, subRel);
        const children = await tocToSidebar(subDirAbs, slugify(path.posix.join(slugBase, subRel)));
        if (!children.length) return null;

        const onlyChild = children.length === 1 ? children[0] : null;
        if (onlyChild?.slug && !onlyChild.items) {
            return { label, slug: onlyChild.slug };
        }

        return { label, collapsed: true, items: children };
    }
    // Inline nested items (e.g. storybook trees)
    if (Array.isArray(e.items)) {
        const children = [];
        for (const c of e.items) {
            const ci = await entryToItem(c, dirAbs, slugBase);
            if (ci) children.push(ci);
        }
        return children.length ? { label, collapsed: true, items: children } : null;
    }
    // Leaf page
    if (href) {
        const clean = href.split('#')[0].split('?')[0];
        if (!/\.mdx?$/.test(clean)) return null;
        const rel = clean.replace(/\.mdx?$/, '').replace(/(^|\/)index$/, '');
        const pageSlug = slugify(rel ? path.posix.join(slugBase, rel) : slugBase);
        if (!validSlugs.has(pageSlug)) {
            droppedSidebarEntries++;
            return null;
        }
        return { label, slug: pageSlug };
    }
    return null;
}

async function tocToSidebar(dirAbs, slugBase) {
    let entries;
    try {
        entries = yaml.load(await fs.readFile(path.join(dirAbs, 'toc.yml'), 'utf8'));
    } catch {
        return [];
    }
    if (!Array.isArray(entries)) return [];
    const items = [];
    for (const e of entries) {
        const item = await entryToItem(e, dirAbs, slugBase);
        if (item) items.push(item);
    }
    return items;
}

// Re-group a product's flat top-level toc sections into Diátaxis buckets
// (Get started / Understand / Guides / Reference) for navigation, without moving
// any files. `buckets` maps section labels to a bucket; "Overview" stays loose at
// the top and anything unmapped falls into a "More" group.
function applyBuckets(items, buckets) {
    const used = new Set();
    const result = [];
    const overview = items.find((i) => i.label === 'Overview');
    if (overview) {
        result.push(overview);
        used.add(overview);
    }
    for (const bucket of buckets) {
        const children = bucket.sections
            .map((section) => items.find((i) => !used.has(i) && i.label === section))
            .filter(Boolean);
        children.forEach((c) => used.add(c));
        if (children.length) {
            const onlyChild = children.length === 1 ? children[0] : null;
            if (onlyChild?.items) {
                result.push({ label: bucket.label, collapsed: true, items: onlyChild.items });
            } else {
                result.push({ label: bucket.label, collapsed: true, items: children });
            }
        }
    }
    // Anything not assigned to a bucket stays as its own top-level group/link.
    for (const i of items) if (!used.has(i)) result.push(i);
    return result;
}

// Decorative sidebar badges — the aspire.dev "Quickstart" / "Tutorial" pills.
// Matched by entry label so they land on the right sections regardless of depth.
const SIDEBAR_BADGES = [
    { match: (label) => /^Getting started/i.test(label), text: 'Quickstart', variant: 'tip' },
    { match: (label) => label === 'Tutorial', text: 'Tutorial', variant: 'success' },
];

function applyBadges(items) {
    for (const item of items) {
        const rule = SIDEBAR_BADGES.find((b) => b.match(item.label || ''));
        if (rule && !item.badge) item.badge = { text: rule.text, variant: rule.variant };
        if (Array.isArray(item.items)) applyBadges(item.items);
    }
    return items;
}

async function chronicleClientSidebarItems() {
    const clients = await availableChronicleClientDocs();
    const items = [];

    for (const client of clients) {
        const slugBase = `chronicle/clients/${client.key}`;
        const clientItems = await tocToSidebar(client.src, slugBase);
        items.push({
            label: client.label,
            collapsed: true,
            items: clientItems.length
                ? clientItems
                : [{ autogenerate: { directory: slugBase } }],
        });
    }

    return items;
}

async function addChronicleClientSidebar(items) {
    const clientItems = await chronicleClientSidebarItems();
    if (!clientItems.length) return items;

    const group = {
        label: 'Client SDKs',
        collapsed: true,
        items: [
            { label: 'Overview', slug: 'chronicle/clients' },
            ...clientItems,
        ],
    };

    const startHereIndex = items.findIndex((item) => item.label === 'Start here');
    if (startHereIndex >= 0) {
        return [
            ...items.slice(0, startHereIndex + 1),
            group,
            ...items.slice(startHereIndex + 1),
        ];
    }

    return [group, ...items];
}

// Emit one Diataxis-bucketed sidebar per product as a `starlight-sidebar-topics`
// topic ({ label, link, icon, items }). The plugin renders the product icons as a
// switchable rail at the top of the sidebar and shows the matching product's nav
// for the current page — the aspire.dev "topics" pattern, one topic per product.
async function generateSidebar() {
    const topics = [];
    for (const product of PRODUCTS) {
        try {
            await fs.access(product.src);
        } catch {
            continue;
        }
        let items;
        if (product.sidebarMode === 'toc') {
            validSlugs = new Set();
            await collectSlugs(path.join(webRoot, 'src', 'content', 'docs', product.key), product.key, validSlugs);
            items = await tocToSidebar(product.src, product.key);
            if (items.length === 0) items = [{ autogenerate: { directory: product.key } }];
            else if (product.buckets) items = applyBuckets(items, product.buckets);
            if (product.key === 'chronicle') items = await addChronicleClientSidebar(items);
        } else {
            items = [{ autogenerate: { directory: product.key } }];
        }
        applyBadges(items);
        topics.push({ id: product.key, label: product.label, link: product.key, icon: product.icon, items });
    }
    const genDir = path.join(webRoot, 'src', 'generated');
    await fs.mkdir(genDir, { recursive: true });
    await fs.writeFile(path.join(genDir, 'topics.json'), JSON.stringify(topics, null, 2) + '\n');
    console.log(
        `[sync] topics -> src/generated/topics.json (${topics.length} product topics, ${droppedSidebarEntries} broken toc entries dropped)`
    );
}

async function main() {
    const targets = only ? PRODUCTS.filter((p) => p.key === only) : PRODUCTS;
    if (only && targets.length === 0) {
        console.error(`Unknown product "${only}". Known: ${PRODUCTS.map((p) => p.key).join(', ')}`);
        process.exit(1);
    }
    for (const product of targets) {
        const outDir = path.join(webRoot, 'src', 'content', 'docs', product.key);
        try {
            await fs.access(product.src);
        } catch {
            console.warn(`[sync] SKIP ${product.key}: source not found at ${product.src}`);
            continue;
        }
        await fs.rm(outDir, { recursive: true, force: true });
        await walk(product.src, outDir, product);
        if (product.key === 'chronicle') {
            await syncChronicleClientDocs(outDir, product);
        }
        const count = await countFiles(outDir);
        console.log(`[sync] ${product.key}: ${count} pages -> ${path.relative(webRoot, outDir)}`);
    }
    await generateSidebar();
    await clearStaleAstroContentCache();
}

async function countFiles(dir) {
    let n = 0;
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
        if (e.isDirectory()) n += await countFiles(path.join(dir, e.name));
        else if (e.name.endsWith('.md') || e.name.endsWith('.mdx')) n++;
    }
    return n;
}

function collectGeneratedContentRefs(value, refs) {
    if (typeof value === 'string') {
        if (/^src\/content\/docs\/.+\.mdx?$/.test(value)) {
            refs.add(value);
        }
        return;
    }

    if (Array.isArray(value)) {
        for (const item of value) {
            collectGeneratedContentRefs(item, refs);
        }
        return;
    }

    if (value && typeof value === 'object') {
        for (const item of Object.values(value)) {
            collectGeneratedContentRefs(item, refs);
        }
    }
}

async function clearStaleAstroContentCache() {
    const cacheDir = path.join(webRoot, 'node_modules', '.astro');
    const dataStorePath = path.join(cacheDir, 'data-store.json');

    let raw;
    try {
        raw = await fs.readFile(dataStorePath, 'utf8');
    } catch {
        return;
    }

    let dataStore;
    try {
        dataStore = JSON.parse(raw);
    } catch {
        await fs.rm(cacheDir, { recursive: true, force: true });
        console.log('[sync] cleared invalid Astro content cache');
        return;
    }

    const refs = new Set();
    collectGeneratedContentRefs(dataStore, refs);
    const missing = [...refs].filter((ref) => !existsSync(path.join(webRoot, ref)));

    if (missing.length) {
        await fs.rm(cacheDir, { recursive: true, force: true });
        console.log(`[sync] cleared stale Astro content cache (${missing.length} missing generated source refs)`);
    }
}

await main();
