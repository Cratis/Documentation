import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const distRoot = path.join(webRoot, 'dist');
const manifest = JSON.parse(await fs.readFile(path.join(webRoot, 'public-surface.json'), 'utf8'));
const errors = [];

const approvedSentences = [
    'Chronicle uses a .NET/Orleans actor-based kernel behind gRPC/HTTP surfaces and supports multiple event stores, namespaces, and persistent event-store subscriptions with outbox/inbox sequences.',
    'Chronicle and its bundled local Workbench are available as MIT-licensed self-hosted software; authorized local use is separate from paid Cratis support, hosted coordination, or managed operational responsibility.',
    'Arc is an opinionated CQRS application framework for ASP.NET Core with commands, queries, validation, authorization, and TypeScript proxy generation.',
    'Components is a React component library aligned with Arc application patterns.',
    'The Cratis CLI provides terminal workflows for inspecting and diagnosing Chronicle.',
    'Chronicle Workbench provides a bundled local browser surface for authorized inspection of Chronicle runtime state and preview of supported projection behavior.',
];

const blockedText = [
    'Event sourcing you can actually be productive with',
    'Everything fits together',
    'Predictable for AI',
    'Production readiness',
    'The Cratis Stack',
    'Chronicle is an event-sourcing database and processing runtime with a first-class .NET SDK and additional TypeScript, Python, Java, Kotlin/JVM, and Elixir clients',
];

async function exists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

async function* walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* walk(full);
        else if (entry.isFile()) yield full;
    }
}

function visibleText(html) {
    return html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
}

function outputForRoute(route) {
    if (route === '/') return 'index.html';
    if (route === '/404.html') return '404.html';
    return `${route.replace(/^\//, '').replace(/\/$/, '')}/index.html`;
}

const expectedHtml = new Set(manifest.routes.map((entry) => outputForRoute(entry.route)));
const actualHtml = new Set();
const actualFiles = new Set();
const allHtml = [];

if (!(await exists(distRoot))) {
    errors.push('dist is missing');
} else {
    for await (const file of walk(distRoot)) {
        const relative = path.relative(distRoot, file).replaceAll('\\', '/');
        actualFiles.add(relative);
        if (relative.toLowerCase().endsWith('.html')) {
            actualHtml.add(relative);
            allHtml.push({ relative, html: await fs.readFile(file, 'utf8') });
        }
        if (relative.toLowerCase().endsWith('.md')) {
            errors.push(`raw Markdown mirror is not allowlisted: ${relative}`);
        }
    }
}

for (const expected of expectedHtml) {
    if (!actualHtml.has(expected)) errors.push(`allowlisted HTML route is missing: ${expected}`);
}
for (const actual of actualHtml) {
    if (!expectedHtml.has(actual)) errors.push(`unlisted HTML route was built: ${actual}`);
}

const indexEntry = allHtml.find((entry) => entry.relative === 'index.html');
if (indexEntry) {
    const text = visibleText(indexEntry.html);
    for (const sentence of approvedSentences) {
        const count = text.split(sentence).length - 1;
        if (count !== 1) {
            errors.push(`front page must contain approved sentence exactly once (${count} found): ${sentence}`);
        }
    }
    const requiredLinks = ['/chronicle/', '/arc/', '/components/', '/cli/'];
    for (const href of requiredLinks) {
        if (!indexEntry.html.includes(`href="${href}"`)) errors.push(`front page is missing canonical product link: ${href}`);
    }
    if (!/<title>[^<]*Cratis documentation[^<]*<\/title>/i.test(indexEntry.html)) {
        errors.push('front page title does not identify Cratis documentation');
    }
    if (!/<meta\s+[^>]*name="description"[^>]*content="Canonical technical documentation for Chronicle, Arc, Components, and the Cratis CLI\."/i.test(indexEntry.html)) {
        errors.push('front page description is missing or differs from the reviewed wording');
    }
    const canonicalMatches = [
        /<link\s+[^>]*rel="canonical"[^>]*href="https:\/\/cratis\.io\/"/i,
        /<link\s+[^>]*href="https:\/\/cratis\.io\/"[^>]*rel="canonical"/i,
    ];
    if (!canonicalMatches.some((pattern) => pattern.test(indexEntry.html))) {
        errors.push('front page self-canonical is missing');
    }
}

for (const { relative, html } of allHtml) {
    const text = visibleText(html);
    for (const blocked of blockedText) {
        if (text.includes(blocked)) errors.push(`${relative} contains blocked wording: ${blocked}`);
    }
}

for (const name of ['llms.txt', 'llms-full.txt']) {
    if (await exists(path.join(distRoot, name))) {
        errors.push(`${name} must remain disabled until machine output is explicitly allowlisted`);
    }
}
if (await exists(path.join(distRoot, 'pagefind'))) {
    errors.push('Pagefind must remain disabled until search is explicitly allowlisted');
}
for (const prefix of ['storybook', 'storybook-arc', 'api']) {
    if (await exists(path.join(distRoot, prefix))) {
        errors.push(`${prefix} output is not admitted by the public manifest`);
    }
}

const generated = manifest.generatedArtifacts;
if (!generated || typeof generated !== 'object') {
    errors.push('manifest.generatedArtifacts is missing');
}
const generatedPrefix = generated?.prefix ?? '';
const generatedExtensions = new Set(generated?.extensions ?? []);
const sitemapPattern = new RegExp(generated?.sitemapPattern ?? 'a^');
const staticFiles = new Set(manifest.staticFiles.map((entry) => entry.path));

for (const file of actualFiles) {
    if (expectedHtml.has(file) || staticFiles.has(file) || sitemapPattern.test(file)) continue;
    if (file.startsWith(generatedPrefix)) {
        const extension = path.extname(file).toLowerCase();
        if (generatedExtensions.has(extension)) continue;
    }
    errors.push(`unlisted public artifact was built: ${file}`);
}
for (const file of staticFiles) {
    if (!actualFiles.has(file)) errors.push(`allowlisted static file is missing: ${file}`);
}

const sitemapUrls = new Set();
if (await exists(distRoot)) {
    for await (const file of walk(distRoot)) {
        if (!/^sitemap.*\.xml$/i.test(path.basename(file))) continue;
        const xml = await fs.readFile(file, 'utf8');
        for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
            if (!match[1].endsWith('.xml')) sitemapUrls.add(match[1]);
        }
    }
}
const expectedSitemap = new Set(
    manifest.routes
        .filter((entry) => entry.sitemap)
        .map((entry) => new URL(entry.route, 'https://cratis.io').href)
);
for (const expected of expectedSitemap) {
    if (!sitemapUrls.has(expected)) errors.push(`sitemap is missing allowlisted URL: ${expected}`);
}
for (const actual of sitemapUrls) {
    if (!expectedSitemap.has(actual)) errors.push(`sitemap contains unlisted URL: ${actual}`);
}

if (errors.length) {
    for (const error of errors) console.error(`[public-surface] ${error}`);
    process.exit(1);
}

console.log(`[public-surface] ${expectedHtml.size} exact routes built; sitemap and machine-output boundaries verified`);
