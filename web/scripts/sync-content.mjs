// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

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
import { loadVariantDocsConfig } from './variant-docs-config.mjs';
import { assertPublicDocPath, assertPublicDocSource, isPrivateDocPath } from './private-doc-paths.mjs';
import { normalizeMarkdownTables } from './normalize-markdown-tables.mjs';
import { sourceEditUrl } from './source-edit-url.mjs';

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

// Products that document interchangeable implementations along one or more
// axes (Chronicle's client SDK languages today). Everything variant-specific in
// this script is driven from this manifest rather than from product name checks.
const variantDocsConfig = await loadVariantDocsConfig();

function variantAxesFor(productKey) {
    return variantDocsConfig.axesFor(productKey);
}

export const PRODUCTS = [
    {
        key: 'chronicle', label: 'Chronicle', icon: 'seti:db', sidebarMode: 'toc',
        src: variantDocsConfig.getProduct('chronicle')?.sharedDocsRoot ?? firstExisting(
            path.join(reposRoot, 'Chronicle', 'Documentation'),
            path.join(docRepoRoot, 'Chronicle', 'Documentation')),
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
            { label: 'Concepts and architecture', sections: ['Why Arc', 'CQRS without event sourcing', 'Vertical slices', 'Understanding the proxy boundary', 'Understanding identity and access', 'HTTP contract', 'Glossary'] },
            // The backend languages sit beside each other here. 'Kotlin and Java'
            // is appended to these sections by the variant-docs sidebar injection.
            { label: 'Backend', sections: ['Backend overview', 'C#'] },
            { label: 'Frontend', sections: ['Frontend'] },
            { label: 'Operations and reference', sections: ['Troubleshooting'] },
        ],
    },
    {
        key: 'components', label: 'Components', icon: 'laptop', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Components', 'Documentation'),
            path.join(docRepoRoot, 'Components', 'Documentation')),
        buckets: [
            { label: 'Start here', sections: ['Getting started', 'Tutorial', 'Choosing a component'] },
            { label: 'Design and styling', sections: ['Why Components', 'UI foundation', 'Coming from PrimeReact', 'Styling'] },
            { label: 'Recipes', sections: ['Building a form', 'Displaying data', 'Multi-step form', 'A list screen with actions'] },
            {
                label: 'Component library',
                sections: [
                    'Storybook', 'Canvas', 'Chat', 'CommandDialog', 'CommandForm', 'CommandStepper', 'StepperCommandDialog', 'DataPage',
                    'DataTables', 'Dialogs', 'Filter', 'Dropdown', 'Display', 'Notifications', 'Toolbar', 'ObjectNavigationalBar',
                    'ObjectContentEditor', 'PivotViewer', 'SchemaEditor', 'TimeMachine', 'Common',
                ],
            },
            { label: 'Reference', sections: ['Architecture decisions', 'Renderer adapters', 'Types', 'Migration'] },
        ],
    },
    {
        // AuthProxy — the ASP.NET Core gateway that sits in front of a Cratis app's
        // backend and frontend services and owns the edge concerns (authentication,
        // tenancy, identity enrichment, invites/lobby).
        key: 'authproxy', label: 'AuthProxy', icon: 'seti:lock', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'AuthProxy', 'Documentation'),
            path.join(docRepoRoot, 'AuthProxy', 'Documentation')),
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
            { label: 'Understand', sections: ['Why Screenplay', 'Language overview', 'Concepts', 'Policies', 'Modules, features and slices', 'Interoperability and extensions'] },
            {
                label: 'Language constructs',
                sections: ['Events', 'Commands', 'Queries', 'Projections', 'Captures', 'Constraints', 'Reactors', 'Screens'],
            },
            { label: 'Reference', sections: ['Sub-language pluggability', 'Grammar', 'Glossary', 'Frequently asked questions'] },
        ],
        // Family sources stay under the single Screenplay documentation topic. This is
        // catalog/navigation membership only; CLI adapters and render targets still
        // require independent admission through their reviewed runtime rosters.
        familySources: [
            {
                label: 'Stage',
                sidebarLabel: 'Guides',
                path: 'stage/guides',
                src: firstExisting(
                    path.join(reposRoot, 'Stage', 'Documentation', 'guides'),
                    path.join(docRepoRoot, 'Stage', 'Documentation', 'guides')),
            },
            {
                label: 'Generation',
                sidebarLabel: 'Guides',
                path: 'generation/guides',
                src: firstExisting(
                    path.join(reposRoot, 'Screenplay.Generation', 'Documentation', 'guides'),
                    path.join(docRepoRoot, 'Screenplay.Generation', 'Documentation', 'guides')),
            },
            {
                label: 'CritterStack',
                group: 'Ecosystem examples',
                path: 'ecosystem-examples/critter-stack',
                src: firstExisting(
                    path.join(reposRoot, 'Screenplay.CritterStack', 'Documentation'),
                    path.join(docRepoRoot, 'Screenplay.CritterStack', 'Documentation')),
            },
        ],
    },
    {
        // Prologue — captures what an existing system actually does (HTTP commands, database
        // changes, telemetry) and interprets that into an event model. Self-contained: no
        // dependency on Studio or Orleans. Its output is a Screenplay `.play` file, so it sits
        // right after Screenplay in the product list.
        key: 'prologue', label: 'Prologue', icon: 'magnifier', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Prologue', 'Documentation'),
            path.join(docRepoRoot, 'Prologue', 'Documentation')),
        buckets: [
            { label: 'Get started', sections: ['Getting started'] },
            { label: 'Understand', sections: ['Why Prologue', 'How Prologue works', 'Architecture'] },
            { label: 'Guides', sections: ['Guides'] },
            { label: 'Reference', sections: ['Reference'] },
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
            { label: 'Creating Projects', sections: ['Creating Projects'] },
            { label: 'Commands', sections: ['Chronicle', 'Arc'] },
            { label: 'Reference', sections: ['Reference'] },
        ],
    },
    {
        // The `dotnet new` creation templates for scaffolding a new Cratis application
        // (Cratis.Templates on NuGet), from a minimal Chronicle console app to the
        // full-stack Arc web application.
        key: 'templates', label: 'Templates', icon: 'add-document', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Templates', 'Documentation'),
            path.join(docRepoRoot, 'Templates', 'Documentation')),
        buckets: [
            { label: 'Start here', sections: ['Overview', 'Getting Started'] },
            { label: 'The templates', sections: ['Cratis Web Application', 'Chronicle Console', 'Chronicle Web', 'Cratis Aspire'] },
        ],
    },
    {
        // The Chronicle MCP server — connects an AI agent to a running store over the Model Context
        // Protocol, for both operating the store and design-time, schema-grounded artifact generation.
        key: 'chronicle-mcp', label: 'Chronicle MCP', icon: 'node', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Chronicle.Mcp', 'Documentation'),
            path.join(docRepoRoot, 'Chronicle.Mcp', 'Documentation')),
        buckets: [
            { label: 'Start here', sections: ['Getting started', 'Configuration'] },
            { label: 'Understand', sections: ['How it works'] },
            { label: 'Capabilities', sections: ['Operate-side', 'Design-time'] },
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
    {
        // EventModelers.ai build kits — one per language, each a real-time agent that turns
        // Eventmodelers board slices into Cratis (Arc + Chronicle) vertical slices. These three
        // get pulled out of the icon rail in astro.config.mjs and nested under the "Cratis Stack"
        // topic's "EventModelers.ai" group, the same way chronicle-mcp/prompter nest under "AI".
        key: 'eventmodelers-ai/csharp', label: 'C#', icon: 'code-branch', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Eventmodelers-Build-Kit-CSharp', 'Documentation'),
            path.join(docRepoRoot, 'Eventmodelers-Build-Kit-CSharp', 'Documentation')),
    },
    {
        key: 'eventmodelers-ai/kotlin', label: 'Kotlin', icon: 'code-branch', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Eventmodelers-Build-Kit-Kotlin', 'Documentation'),
            path.join(docRepoRoot, 'Eventmodelers-Build-Kit-Kotlin', 'Documentation')),
    },
    {
        key: 'eventmodelers-ai/java', label: 'Java', icon: 'code-branch', sidebarMode: 'toc',
        src: firstExisting(
            path.join(reposRoot, 'Eventmodelers-Build-Kit-Java', 'Documentation'),
            path.join(docRepoRoot, 'Eventmodelers-Build-Kit-Java', 'Documentation')),
    },
];

// The Cratis/.github org repo also carries a `release-digests/` folder of
// weekly cross-repo digests (one file per week, named `<start>-to-<end>.md`).
// These are site-level pages surfaced from the "Cratis Stack" nav rather than
// their own product topic, so they are synced separately from PRODUCTS below.
const RELEASE_DIGESTS_SRC = firstExisting(
    path.join(reposRoot, '.github', 'release-digests'),
    path.join(docRepoRoot, 'GitHubLanding', 'release-digests'));

const ASSET_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif', '.html', '.js', '.css', '.json']);
const SKIP_DIRS = new Set([
    'node_modules', 'obj', 'bin', '.git', 'storybook-static', '.vitepress',
    // Shared Markdown snippets are included into pages but should not become pages.
    '_includes', '_shared', '_snippets',
    // Variant-owned snippets are expanded into a product's shared pages through
    // its axis macro; they are not standalone public docs pages. Derived from
    // the configured snippet roots so a new axis needs no change here.
    ...variantDocsConfig.snippetRootBasenames,
    // the org GitHub landing page (duplicates our front door) — not site content
    'profile',
    // synced separately by syncReleaseDigests() into site-level release-digests/ pages
    'release-digests',
    // the managed Cratis AI corpus (project rules for AI coding assistants) — tooling
    // config, not documentation content. `.cratis` is unambiguous as a directory
    // basename; unlike `isPrivateDocPath`, this only affects the content-sync walk
    // and never touches link-target validation, so real `/.cratis/...` Arc runtime
    // routes referenced in doc prose (e.g. `/.cratis/logout`) stay valid links.
    '.cratis',
]);

// Repository control files that live at the repo root for tooling/AI but are
// not documentation. Checked case-insensitively at the product source root only.
const REPO_BOOTSTRAP_FILES = new Set([
    'agents.md', 'claude.md', 'gemini.md',
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
    assertPublicDocPath(url);

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

async function inlineIncludes(body, dir, sourcePath, contentRoot) {
    const includeRe = /\[!INCLUDE\s*\[[^\]]*\]\(([^)]+)\)\]/g;
    let result = body;
    const matches = [...body.matchAll(includeRe)];
    for (const m of matches) {
        const incPath = path.resolve(dir, m[1]);
        try {
            const rootPrefix = path.resolve(contentRoot) + path.sep;
            // The configured source root is trusted, even when its name is
            // .github or a fixture lives beneath .ai-work. Keep raw descendant
            // segments intact so normalization cannot hide .ai-work/../ paths.
            const relativeInclude = path.isAbsolute(m[1]) && m[1].startsWith(rootPrefix)
                ? m[1].slice(rootPrefix.length)
                : m[1];
            assertPublicDocPath(relativeInclude);
            await assertPublicDocSource(incPath, contentRoot);
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

// Returns null when the variant repo has no snippet for this id — that just
// means the tab is omitted, not an error. A product's shared docs don't track
// which variants apply to a given example; that's discovered from disk.
async function readVariantSnippet(source, snippet) {
    assertPublicDocPath(snippet);
    for (const ext of ['.mdx', '.md']) {
        const candidate = path.join(source.src, snippet + ext);
        if (await fileExists(candidate)) {
            await assertPublicDocSource(candidate, source.src);
            const raw = await fs.readFile(candidate, 'utf8');
            const { body } = splitFrontmatter(raw);
            return body.trim();
        }
    }
    return null;
}

function isInsideFencedCode(body, index) {
    let fence = null;
    for (const line of body.slice(0, index).split('\n')) {
        const match = line.match(/^\s*(`{3,}|~{3,})/);
        if (!match) continue;
        const marker = match[1][0];
        const length = match[1].length;
        if (!fence) {
            fence = { marker, length };
        } else if (marker === fence.marker && length >= fence.length && /^\s*[`~]+\s*$/.test(line)) {
            fence = null;
        }
    }
    return fence !== null;
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

// Expands one axis's macro (`<Macro snippet="..." />`) into a Starlight <Tabs>
// block built from the variant-owned snippets that actually exist on disk.
async function expandAxisMacro(body, ctx, axis) {
    if (!body.includes(`<${axis.macro}`)) {
        return { body, used: false };
    }

    const componentRe = new RegExp(`^[ \\t]*<${axis.macro}\\s+([^>]*)\\/>[ \\t]*$`, 'gm');
    const parts = [];
    let expandedAny = false;
    let lastIndex = 0;

    for (const match of body.matchAll(componentRe)) {
        const index = match.index ?? 0;
        if (isInsideFencedCode(body, index)) {
            continue;
        }

        if (path.extname(ctx.srcPath ?? ctx.basename).toLowerCase() !== '.mdx') {
            throw new Error(
                `[sync] Cannot expand ${axis.macro} in Markdown source ${ctx.srcPath ?? ctx.basename}; rename the source file to .mdx`
            );
        }

        const attrs = match[1];
        const snippet = getAttr(attrs, 'snippet');
        if (!snippet) {
            throw new Error(`[sync] ${axis.macro} in ${ctx.srcPath} is missing snippet="..."`);
        }

        // Every axis carries its own syncKey: Starlight syncs tab selection by
        // label in one flat localStorage namespace, so a shared key would make
        // one axis's tab choice drive an unrelated axis's tabs.
        const syncKey = getAttr(attrs, 'syncKey') ?? axis.syncKey;

        // A page that belongs to one variant's own docs still wants tabs, just not
        // across every variant of the axis: the JVM backend's pages offer Kotlin and
        // Java and have no business offering C#. Naming a subset keeps the axis's
        // syncKey, so a reader's language choice still follows them onto shared pages.
        const requestedVariants = getAttr(attrs, 'variants');
        let snippetVariants = axis.snippetVariants;
        if (requestedVariants) {
            const keys = requestedVariants.split(',').map(_ => _.trim()).filter(Boolean);
            const unknown = keys.filter(key => !axis.snippetVariants.some(variant => variant.key === key));
            if (unknown.length) {
                throw new Error(
                    `[sync] ${axis.macro} in ${ctx.srcPath} names ${axis.key} variant(s) that do not exist: `
                    + `${unknown.join(', ')}. Known variants: ${axis.snippetVariants.map(_ => _.key).join(', ')}`
                );
            }
            // Axis order, not the order they were written in, so tab order is the same
            // on every page whatever the author typed.
            snippetVariants = axis.snippetVariants.filter(variant => keys.includes(variant.key));
        }

        const tabs = [];
        const absent = [];
        for (const source of snippetVariants) {
            const content = await readVariantSnippet(source, snippet);
            if (content === null) {
                absent.push(source.label);
                continue;
            }
            tabs.push({ source, content });
        }

        // A registered variant with no snippet loses its tab, and the page then
        // quietly reads as if that language were never supported. Genuine absence
        // has its own spelling — a snippet saying so outright — so a missing file
        // is an oversight, and the only sign of it was a tab nobody saw.
        if (absent.length && axis.warnOnMissingSnippet) {
            console.warn(
                `[sync] WARNING: ${ctx.srcPath}: snippet "${snippet}" has no ${absent.join(', ')} version, `
                + `so that tab is missing. Add it, or add a snippet stating the language does not support this.`
            );
        }

        if (!tabs.length) {
            throw new Error(
                `[sync] ${axis.macro} snippet "${snippet}" in ${ctx.srcPath} has no matching snippet in any ${axis.key} repo`
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
    return { body: parts.join(''), used: true };
}

// Expands every axis configured for the page's product. `ctx.variantAxes` lets
// a caller (tests) supply axes directly instead of going through the manifest.
async function expandVariantTabs(body, ctx) {
    const axes = ctx.variantAxes ?? variantAxesFor(ctx.product.key);
    if (!axes.length) {
        return { body, used: false };
    }

    let current = body;
    let expandedAny = false;
    for (const axis of axes) {
        const result = await expandAxisMacro(current, ctx, axis);
        current = result.body;
        expandedAny = expandedAny || result.used;
    }

    if (!expandedAny) {
        return { body, used: false };
    }

    return { body: ensureTabsImport(current), used: true };
}

export async function convertFile(raw, ctx) {
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
    out = await inlineIncludes(out, ctx.dir, ctx.srcPath ?? path.join(ctx.dir, ctx.basename), ctx.contentRoot ?? ctx.product.src ?? ctx.dir);
    ({ body: out } = await expandVariantTabs(out, ctx));
    out = convertAlerts(out);
    out = convertXref(out);
    out = normalizeMarkdownTables(fixLinks(out, ctx));

    const fm = { title, editUrl: sourceEditUrl(ctx.srcPath, reposRoot, docRepoRoot) };
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

export async function walk(srcDir, outDir, product, options = {}) {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    await fs.mkdir(outDir, { recursive: true });
    const demoteIndex = await hasSiblingLanding(path.dirname(srcDir), path.basename(srcDir));
    const contentRoot = options.contentRoot ?? product.src;
    const isProductRoot = path.resolve(srcDir) === path.resolve(contentRoot);
    for (const entry of entries) {
        if (isPrivateDocPath(entry.name)) continue;
        if (entry.isSymbolicLink()) {
            const source = path.join(srcDir, entry.name);
            await assertPublicDocSource(source, contentRoot);
            // Directory symlinks were never recursive inputs; public file aliases
            // remain supported without allowing aliases into private work.
            if (!(await fs.stat(source)).isFile()) continue;
        }
        if (entry.isDirectory()) {
            if (SKIP_DIRS.has(entry.name)) continue;
            // A variant's public docs that live inside this product's own tree are
            // mounted separately by syncVariantDocs(); don't double-walk them.
            if (!options.slugBase
                && variantDocsConfig.nestedPublicDocRootsFor(product.key)
                    .has(path.resolve(srcDir, entry.name))) continue;
            await walk(path.join(srcDir, entry.name), path.join(outDir, entry.name), product, options);
            continue;
        }
        // Skip repo READMEs (e.g. the .github org landing) — not site content.
        if (entry.name.toLowerCase() === 'readme.md') continue;
        // Skip repository control bootstrap files at the product root only.
        // Nested documentation pages named agents.md, claude.md, or gemini.md
        // elsewhere in the tree remain valid authored content.
        if (isProductRoot && REPO_BOOTSTRAP_FILES.has(entry.name.toLowerCase())) continue;
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

async function availableVariantDocs(axis) {
    const available = [];
    const missing = [];
    for (const variant of axis.publicDocsVariants) {
        try {
            await fs.access(variant.src);
            available.push(variant);
        } catch {
            // Variant repositories are optional so a local partial build still works.
            missing.push(variant);
        }
    }
    // Say so. A configured variant that is simply absent used to vanish in
    // silence: its pages, its sidebar group and its side of every language tab
    // all disappeared from a build that otherwise looked completely healthy,
    // which is exactly how a variant ships missing from production.
    for (const variant of missing) {
        console.warn(
            `[sync] WARNING: ${axis.productKey}/${axis.key}: variant "${variant.key}" is configured but its docs were not found at ${variant.src} — its pages, sidebar group and language tabs will be absent from this build.`
        );
    }
    return available;
}

function variantDocsSlugBase(axis, variantKey) {
    return `${axis.productKey}/${axis.mount.route}/${variantKey}`;
}

async function writeVariantDocsLanding(outDir, axis, variants) {
    if (!variants.length) return;

    const mountDir = path.join(outDir, axis.mount.route);
    await fs.mkdir(mountDir, { recursive: true });

    // A product may author its own page at the mount route — Arc's backend route
    // is a real folder with a hand-written overview, unlike Chronicle's clients/
    // which exists only as a mount point. The walk runs first, so if a page is
    // already there it is the product's, and generating over it would silently
    // replace prose someone wrote with a generated stub.
    const landingPath = path.join(mountDir, 'index.md');
    for (const existing of ['index.md', 'index.mdx']) {
        try {
            await fs.access(path.join(mountDir, existing));
            console.log(`[sync] ${axis.productKey}/${axis.key}: keeping the authored ${axis.mount.route}/${existing}; not generating a mount landing over it`);
            return;
        } catch {
            // Nothing authored here, so the generated landing is the only page.
        }
    }
    const { title, intro, sharedHeading, variantHeading } = axis.mount.landing;
    const topicLinks = axis.sharedTopics
        .map((topic) => `- [${topic.label}](${topic.href})`)
        .join('\n');
    const variantLinks = variants
        .map((variant) => `- [${variant.label}](/${variantDocsSlugBase(axis, variant.key)}/)`)
        .join('\n');

    // The landing is generated from configuration and has no authored source
    // file, so disable the site-wide edit link rather than pointing at this copy.
    const body = `---\ntitle: ${title}\neditUrl: false\n---\n\n${intro}\n\n## ${sharedHeading}\n\n${topicLinks}\n\n## ${variantHeading}\n\n${variantLinks}\n`;

    await fs.writeFile(landingPath, body, 'utf8');
}

async function syncVariantDocs(outDir, product) {
    for (const axis of variantAxesFor(product.key)) {
        const variants = await availableVariantDocs(axis);
        await writeVariantDocsLanding(outDir, axis, variants);

        for (const variant of variants) {
            await walk(
                variant.src,
                path.join(outDir, axis.mount.route, variant.key),
                product,
                {
                    contentRoot: variant.src,
                    slugBase: variantDocsSlugBase(axis, variant.key),
                }
            );
        }
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
// Every toc entry whose target page was not generated. A renamed file whose
// toc.yml was never updated vanishes from the sidebar, and a silent drop makes
// that look like a clean build — so the drops are collected (not just counted)
// and `main` fails the sync when there are any.
const droppedSidebarEntries = [];
// The product whose sidebar is currently being built, so a dropped entry can be
// attributed to it. A targeted sync (`sync-content.mjs <product>`) only
// generates one product's pages, so every other product legitimately has no
// slugs and must not fail the gate.
let currentSidebarProduct = null;

// Collect the slugs of every page actually written for a product, so the
// sidebar can drop entries that point to missing pages (broken toc links).
export async function collectSlugs(dirAbs, slugBase, set) {
    let entries;
    try {
        entries = await fs.readdir(dirAbs, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries) {
        if (isPrivateDocPath(e.name) || e.isSymbolicLink()) continue;
        if (e.isDirectory()) {
            await collectSlugs(path.join(dirAbs, e.name), slugify(path.posix.join(slugBase, e.name)), set);
        } else if (e.name.endsWith('.md') || e.name.endsWith('.mdx')) {
            const base = e.name.replace(/\.mdx?$/, '');
            set.add(base === 'index' ? slugify(slugBase) : slugify(path.posix.join(slugBase, base)));
        }
    }
}

function resolvedTocSlug(href, slugBase) {
    const clean = href.split('#')[0].split('?')[0];
    if (!/\.mdx?$/i.test(clean)) return null;
    const rel = clean.replace(/\.mdx?$/i, '').replace(/(^|\/)index$/i, '');
    const joined = path.posix.normalize(rel ? path.posix.join(slugBase, rel) : slugBase);
    const productSlug = slugBase.split('/').filter(Boolean)[0];
    if (joined !== productSlug && !joined.startsWith(productSlug + '/')) {
        throw new Error(`[sync] toc href "${href}" escapes the ${productSlug} documentation root`);
    }
    return slugify(joined);
}

function pageTocItem(label, href, slugBase, slugs, dirAbs) {
    const pageSlug = resolvedTocSlug(href, slugBase);
    if (!pageSlug) return null;
    if (!slugs.has(pageSlug)) {
        // Record what was dropped and where it was declared, so the failure the
        // gate raises in `main` names a toc entry someone can go and fix.
        droppedSidebarEntries.push({
            label,
            href,
            slug: pageSlug,
            product: currentSidebarProduct,
            toc: dirAbs ? path.relative(webRoot, path.join(dirAbs, 'toc.yml')) : '(unknown toc.yml)',
        });
        return null;
    }
    return { label, slug: pageSlug };
}

export async function entryToItem(e, dirAbs, slugBase, slugs = validSlugs) {
    const label = e.name ?? 'Untitled';
    const href = e.href;
    if (href && isPrivateDocPath(href)) return null;
    // External links and the auto-generated API section are wired separately — skip.
    if (href && (/^https?:/.test(href) || href.includes('/api/'))) {
        return null;
    }
    // Group via a sub-folder's toc.yml.
    if (href && /toc\.ya?ml$/i.test(href)) {
        if (Array.isArray(e.items)) {
            throw new Error(`[sync] toc entry "${label}" cannot combine a toc.yml href with inline items`);
        }
        const subRel = href.replace(/\/?toc\.ya?ml$/i, '');
        const subDirAbs = path.resolve(dirAbs, subRel);
        if (existsSync(subDirAbs)) await assertPublicDocSource(subDirAbs, dirAbs);
        const children = await tocToSidebar(subDirAbs, slugify(path.posix.join(slugBase, subRel)), slugs);
        if (!children.length) return null;

        const onlyChild = children.length === 1 ? children[0] : null;
        if (onlyChild?.slug && !onlyChild.items) {
            return { label, slug: onlyChild.slug };
        }

        return { label, collapsed: true, items: children };
    }
    // DocFX permits a page href and nested items together. Starlight groups are
    // not links, so retain the page as an explicit Overview child instead of
    // silently discarding it. Relative ../ page targets are normalized against
    // the current product slug and accepted only when the generated page exists.
    if (Array.isArray(e.items)) {
        const children = [];
        if (href) {
            const landing = pageTocItem('Overview', href, slugBase, slugs, dirAbs);
            if (landing) children.push(landing);
        }
        for (const c of e.items) {
            const ci = await entryToItem(c, dirAbs, slugBase, slugs);
            if (ci && !children.some((child) => child.slug && child.slug === ci.slug)) children.push(ci);
        }
        return children.length ? { label, collapsed: true, items: children } : null;
    }
    // Leaf page
    if (href) {
        return pageTocItem(label, href, slugBase, slugs, dirAbs);
    }
    return null;
}

export async function tocToSidebar(dirAbs, slugBase, slugs = validSlugs) {
    const tocPath = path.join(dirAbs, 'toc.yml');
    let entries;
    try {
        await assertPublicDocSource(tocPath, dirAbs);
        entries = yaml.load(await fs.readFile(tocPath, 'utf8'));
    } catch (error) {
        if (error?.code === 'ENOENT') return [];
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`[sync] Failed to read toc ${tocPath}: ${message}`, { cause: error });
    }
    if (!Array.isArray(entries)) {
        throw new Error(`[sync] toc ${tocPath} must contain a top-level array`);
    }
    const items = [];
    for (const e of entries) {
        const item = await entryToItem(e, dirAbs, slugBase, slugs);
        if (item) items.push(item);
    }
    return items;
}

// Re-group a product's flat top-level toc sections into Diátaxis buckets
// (Get started / Understand / Guides / Reference) for navigation, without moving
// any files. `buckets` maps section labels to a bucket; "Overview" stays loose at
// the top and anything unmapped falls into a "More" group.
export function applyBuckets(items, buckets) {
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

// True when the product's own documentation supplies the page at the mount route,
// rather than the mount generating one. Mirrors the check in writeVariantDocsLanding.
async function productAuthorsMountLanding(axis) {
    const product = PRODUCTS.find((candidate) => candidate.key === axis.productKey);
    if (!product) return false;
    for (const name of ['index.md', 'index.mdx']) {
        try {
            await fs.access(path.join(product.src, axis.mount.route, name));
            return true;
        } catch {
            // Not authored under this name.
        }
    }
    return false;
}

async function variantSidebarItems(axis) {
    const variants = await availableVariantDocs(axis);
    const items = [];

    for (const variant of variants) {
        const slugBase = variantDocsSlugBase(axis, variant.key);
        const variantItems = await tocToSidebar(variant.src, slugBase);
        const resolved = variantItems.length
            ? variantItems
            : [{ autogenerate: { directory: slugBase } }];

        // With several variants each needs its own group to tell them apart. With
        // one, that group sits inside the axis group and repeats its label, so the
        // reader opens "Kotlin and Java" to find "Kotlin and Java". Hoist it.
        if (variants.length === 1) {
            items.push(...resolved);
            continue;
        }

        items.push({
            label: variant.label,
            collapsed: true,
            items: resolved,
        });
    }

    return items;
}

// One sidebar group per axis, split by when it has to be injected:
//   - `into-bucket` groups go in BEFORE applyBuckets, so normal bucketing
//     absorbs them as a child of the target bucket;
//   - `after-bucket` groups go in AFTER applyBuckets, so they stay a peer of
//     the buckets, positioned right after the anchor bucket.
export async function variantSidebarInjections(product) {
    const before = [];
    const after = [];

    for (const axis of variantAxesFor(product.key)) {
        const axisItems = await variantSidebarItems(axis);
        if (!axisItems.length) continue;

        // The mount route's landing is only this group's overview when the mount
        // generated it. Where the product authors that page itself it belongs to
        // the product, is already reachable from its own toc, and repeating it
        // here gives the group two overviews — one of them somebody else's page.
        const mountLanding = { label: 'Overview', slug: `${axis.productKey}/${axis.mount.route}` };
        const ownsLanding = !(await productAuthorsMountLanding(axis));

        const group = {
            label: axis.sidebar.groupLabel,
            collapsed: true,
            items: ownsLanding ? [mountLanding, ...axisItems] : axisItems,
        };

        (axis.sidebar.injectMode === 'into-bucket' ? before : after).push({ axis, group });
    }

    return { before, after };
}

// `into-bucket` is declarative: the injected group is a normal top-level item
// and the target bucket simply learns to claim its label, so the existing
// bucketing logic places it without a second positioning mechanism.
export function bucketsWithInjectedSections(buckets, injections) {
    if (!buckets || !injections.length) return buckets;

    return buckets.map((bucket) => {
        const claimed = injections
            .filter(({ axis }) => axis.sidebar.targetBucket === bucket.label)
            .map(({ group }) => group.label)
            .filter((label) => !bucket.sections.includes(label));
        return claimed.length ? { ...bucket, sections: [...bucket.sections, ...claimed] } : bucket;
    });
}

export function applyAfterBucketInjections(items, injections) {
    let result = items;
    for (const { axis, group } of injections) {
        const anchorIndex = result.findIndex((item) => item.label === axis.sidebar.anchorBucket);
        result = anchorIndex >= 0
            ? [...result.slice(0, anchorIndex + 1), group, ...result.slice(anchorIndex + 1)]
            : [group, ...result];
    }
    return result;
}

async function familySourceSidebarItems(product) {
    const items = [];
    const groups = new Map();

    for (const source of product.familySources ?? []) {
        try {
            await fs.access(source.src);
        } catch {
            continue;
        }

        const slugBase = slugify(path.posix.join(product.key, source.path));
        let sourceItems = await tocToSidebar(source.src, slugBase);
        if (sourceItems.length === 0) {
            sourceItems = [{ autogenerate: { directory: slugBase } }];
        }
        if (source.sidebarLabel) {
            sourceItems = [{ label: source.sidebarLabel, collapsed: true, items: sourceItems }];
        }

        const sourceGroup = {
            label: source.label,
            collapsed: true,
            items: sourceItems,
        };
        if (source.group) {
            if (!groups.has(source.group)) groups.set(source.group, []);
            groups.get(source.group).push(sourceGroup);
        } else {
            items.push(sourceGroup);
        }
    }

    for (const [label, groupItems] of groups) {
        items.push({ label, collapsed: true, items: groupItems });
    }
    return items;
}

// ISO-8601 week number (and the year that week belongs to, which can differ
// from the calendar year for the last/first days of December/January).
function isoWeekInfo(date) {
    const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
    const dayNumber = (target.getUTCDay() + 6) % 7; // Monday = 0 .. Sunday = 6
    target.setUTCDate(target.getUTCDate() - dayNumber + 3); // nearest Thursday
    const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
    const firstDayNumber = (firstThursday.getUTCDay() + 6) % 7;
    firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNumber + 3);
    const week = 1 + Math.round((target - firstThursday) / (7 * 86400000));
    return { week, year: target.getUTCFullYear() };
}

const SHORT_MONTH = new Intl.DateTimeFormat('en-US', { month: 'short', timeZone: 'UTC' });
const LONG_MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', timeZone: 'UTC' });

// Turns a `<start>-to-<end>.md` release-digest filename into a human-readable
// date range plus its ISO week number, so the sidebar and page title read as
// "May 18 - 25, 2026 (Week 21)" instead of the raw ISO filename.
function formatReleaseDigestRange(startIso, endIso) {
    const start = new Date(`${startIso}T00:00:00Z`);
    const end = new Date(`${endIso}T00:00:00Z`);
    const startYear = start.getUTCFullYear();
    const endYear = end.getUTCFullYear();
    const startDay = start.getUTCDate();
    const endDay = end.getUTCDate();

    let shortRange;
    let longRange;
    if (startYear !== endYear) {
        shortRange = `${SHORT_MONTH.format(start)} ${startDay}, ${startYear} - ${SHORT_MONTH.format(end)} ${endDay}, ${endYear}`;
        longRange = `${LONG_MONTH.format(start)} ${startDay}, ${startYear} - ${LONG_MONTH.format(end)} ${endDay}, ${endYear}`;
    } else if (start.getUTCMonth() !== end.getUTCMonth()) {
        shortRange = `${SHORT_MONTH.format(start)} ${startDay} - ${SHORT_MONTH.format(end)} ${endDay}, ${endYear}`;
        longRange = `${LONG_MONTH.format(start)} ${startDay} - ${LONG_MONTH.format(end)} ${endDay}, ${endYear}`;
    } else {
        shortRange = `${SHORT_MONTH.format(start)} ${startDay} - ${endDay}, ${endYear}`;
        longRange = `${LONG_MONTH.format(start)} ${startDay} - ${endDay}, ${endYear}`;
    }

    const { week, year: isoYear } = isoWeekInfo(start);
    return { shortRange, longRange, week, isoYear };
}

// Syncs the Cratis/.github `release-digests/` folder into site-level pages
// under `release-digests/`, and writes the sidebar entries (sorted descending
// by filename, which is the week's start date) to src/generated/. Unlike the
// PRODUCTS loop this isn't a product topic: it's a plain nav group hung off
// the "Cratis Stack" topic in astro.config.mjs.
async function syncReleaseDigests() {
    const outDir = path.join(webRoot, 'src', 'content', 'docs', 'release-digests');
    await fs.rm(outDir, { recursive: true, force: true });

    const genDir = path.join(webRoot, 'src', 'generated');
    await fs.mkdir(genDir, { recursive: true });
    const genPath = path.join(genDir, 'release-digests.json');

    let entries;
    try {
        entries = await fs.readdir(RELEASE_DIGESTS_SRC, { withFileTypes: true });
    } catch {
        console.warn(`[sync] SKIP release-digests: source not found at ${RELEASE_DIGESTS_SRC}`);
        await fs.writeFile(genPath, '[]\n');
        return;
    }

    const pattern = /^(\d{4}-\d{2}-\d{2})-to-(\d{4}-\d{2}-\d{2})\.md$/;
    const digests = entries
        .filter((e) => e.isFile() && pattern.test(e.name))
        .map((e) => {
            const [, start, end] = e.name.match(pattern);
            return { file: e.name, slug: e.name.replace(/\.md$/, ''), start, end };
        })
        // Descending by filename == descending by start date (ISO dates sort lexicographically).
        .sort((a, b) => (a.file < b.file ? 1 : a.file > b.file ? -1 : 0));

    if (digests.length === 0) {
        await fs.writeFile(genPath, '[]\n');
        console.log('[sync] release-digests: 0 pages (none found)');
        return;
    }

    await fs.mkdir(outDir, { recursive: true });
    const sidebarEntries = [];
    for (const digest of digests) {
        const raw = await fs.readFile(path.join(RELEASE_DIGESTS_SRC, digest.file), 'utf8');
        const { shortRange, longRange, week, isoYear } = formatReleaseDigestRange(digest.start, digest.end);
        const title = `Release digest: ${longRange} (Week ${week})`;
        const description = `Cross-repository release digest for the week of ${longRange}, ISO week ${week} of ${isoYear}.`;
        const body = stripLeadingH1(convertAlerts(raw));
        const editUrl = sourceEditUrl(path.join(RELEASE_DIGESTS_SRC, digest.file), reposRoot, docRepoRoot);
        const frontmatter = [
            '---',
            `title: ${quoteYaml(title)}`,
            `description: ${quoteYaml(description)}`,
            `editUrl: ${editUrl ? quoteYaml(editUrl) : 'false'}`,
            '---',
            '',
        ].join('\n');
        await fs.writeFile(path.join(outDir, `${digest.slug}.md`), frontmatter + body);
        sidebarEntries.push({ slug: digest.slug, label: `${shortRange} · Week ${week}` });
    }

    await fs.writeFile(genPath, JSON.stringify(sidebarEntries, null, 2) + '\n');
    console.log(`[sync] release-digests: ${digests.length} pages -> ${path.relative(webRoot, outDir)}`);
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
            currentSidebarProduct = product.key;
            await collectSlugs(path.join(webRoot, 'src', 'content', 'docs', product.key), product.key, validSlugs);
            items = await tocToSidebar(product.src, product.key);
            const injections = await variantSidebarInjections(product);
            if (items.length === 0) items = [{ autogenerate: { directory: product.key } }];
            else {
                if (injections.before.length) items = [...injections.before.map(({ group }) => group), ...items];
                if (product.buckets) items = applyBuckets(items, bucketsWithInjectedSections(product.buckets, injections.before));
            }
            items = applyAfterBucketInjections(items, injections.after);
        } else {
            items = [{ autogenerate: { directory: product.key } }];
        }
        items.push(...await familySourceSidebarItems(product));
        applyBadges(items);
        topics.push({ id: product.key, label: product.label, link: product.key, icon: product.icon, items });
    }
    const genDir = path.join(webRoot, 'src', 'generated');
    await fs.mkdir(genDir, { recursive: true });
    await fs.writeFile(path.join(genDir, 'topics.json'), JSON.stringify(topics, null, 2) + '\n');
    console.log(
        `[sync] topics -> src/generated/topics.json (${topics.length} product topics, ${droppedSidebarEntries.length} broken toc entries dropped)`
    );
}

// A dropped toc entry is a page that silently disappeared from the sidebar:
// the file was renamed, moved or deleted and its toc.yml was not updated. The
// build stays green and nobody notices, so this is a gate, not a warning.
function assertNoDroppedSidebarEntries() {
    // A targeted sync regenerates one product, so drops belonging to products
    // that were never generated in this run are expected and not a defect.
    const relevant = only
        ? droppedSidebarEntries.filter((entry) => entry.product === only)
        : droppedSidebarEntries;
    const skipped = droppedSidebarEntries.length - relevant.length;
    if (skipped > 0) {
        console.log(`[sync] ignoring ${skipped} dropped toc entries from products not generated by this targeted sync`);
    }
    if (!relevant.length) return;
    console.error(`[sync] ${relevant.length} toc ${relevant.length === 1 ? 'entry points' : 'entries point'} at pages that were not generated:`);
    for (const entry of relevant) {
        console.error(`  ${entry.toc}: "${entry.label}" -> ${entry.href} (expected page slug "${entry.slug}")`);
    }
    console.error('[sync] Fix the toc.yml href, or restore/rename the page it points at. Do not delete the entry to make this pass unless the page is really gone.');
    process.exit(1);
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
        await syncVariantDocs(outDir, product);
        for (const source of product.familySources ?? []) {
            const sourceOutDir = path.join(outDir, source.path);
            try {
                await fs.access(source.src);
            } catch {
                console.warn(`[sync] SKIP ${product.key}/${source.path}: source not found at ${source.src}`);
                continue;
            }
            await walk(source.src, sourceOutDir, product, {
                contentRoot: source.src,
                slugBase: path.posix.join(product.key, source.path),
            });
            const sourceCount = await countFiles(sourceOutDir);
            console.log(`[sync] ${product.key}/${source.path}: ${sourceCount} pages -> ${path.relative(webRoot, sourceOutDir)}`);
        }
        const count = await countFiles(outDir);
        console.log(`[sync] ${product.key}: ${count} pages -> ${path.relative(webRoot, outDir)}`);
    }
    if (!only) await syncReleaseDigests();
    await generateSidebar();
    await clearStaleAstroContentCache();
    assertNoDroppedSidebarEntries();
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

if (process.argv[1] && await fs.realpath(process.argv[1]) === await fs.realpath(fileURLToPath(import.meta.url))) {
    await main();
}
