import { createHash } from 'node:crypto';
import { existsSync, promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, '..');
const documentationRoot = path.resolve(webRoot, '..');
const repositoriesRoot = path.resolve(webRoot, '..', '..');
const manifestPath = path.join(webRoot, 'public-surface.json');
const outputRoot = path.join(webRoot, 'src', 'content', 'docs');
const generatedRoot = path.join(webRoot, 'src', 'generated');
const approvedPublicRoot = path.join(webRoot, '.public-approved');
const sourcePublicRoot = path.join(webRoot, 'public');

const allowedClaims = new Set([
    'CLM-011',
    'CLM-012',
    'CLM-013',
    'CLM-014',
    'CLM-028',
    'CLM-032',
]);

const expectedRenderDependencies = [
    ['web/src/components/TopicHero.astro', 'a67bf5552c44b7eb53d86a1b367340d7ca9027222e4226f16e6f58be7ee262ac'],
    ['web/src/components/SimpleCard.astro', '057370dc8bc7bd91262d9ad5b28e79cb7f963093afed136717f4bdf958c75f87'],
    ['web/src/components/YouWillLearn.astro', 'cab0237be9dc77ec09bb7629ab16f66efa2a8e82bd6d09138f5f6ddb4456494e'],
];

const expectedRoutePolicy = [
    ['/', 'index.mdx', 'Documentation', 'web/src/public-pages/index.mdx', ['CLM-011', 'CLM-012', 'CLM-013', 'CLM-014', 'CLM-028', 'CLM-032'], true],
    ['/404.html', '404.md', 'Documentation', 'web/src/public-pages/404.md', [], false],
    ['/chronicle/', 'chronicle/index.mdx', 'Chronicle', 'Documentation/index.mdx', ['CLM-013', 'CLM-014', 'CLM-028', 'CLM-032'], true],
    ['/chronicle/architecture/', 'chronicle/architecture.mdx', 'Chronicle', 'Documentation/architecture.mdx', ['CLM-013', 'CLM-014', 'CLM-028'], true],
    ['/chronicle/workbench/', 'chronicle/workbench/index.mdx', 'Chronicle', 'Documentation/workbench/index.mdx', ['CLM-013', 'CLM-014', 'CLM-032'], true],
    ['/arc/', 'arc/index.mdx', 'Arc', 'Documentation/index.mdx', ['CLM-011', 'CLM-012'], true],
    ['/components/', 'components/index.mdx', 'Components', 'Documentation/index.mdx', ['CLM-011', 'CLM-012'], true],
    ['/cli/', 'cli/index.mdx', 'cli', 'Documentation/index.mdx', ['CLM-013', 'CLM-014'], true],
];

const repositoryRoots = {
    Documentation: documentationRoot,
    Chronicle: firstExisting(
        path.join(repositoriesRoot, 'Chronicle'),
        path.join(documentationRoot, 'Chronicle')
    ),
    Arc: firstExisting(
        path.join(repositoriesRoot, 'Arc'),
        path.join(documentationRoot, 'Arc')
    ),
    Components: firstExisting(
        path.join(repositoriesRoot, 'Components'),
        path.join(documentationRoot, 'Components')
    ),
    cli: firstExisting(
        path.join(repositoriesRoot, 'cli'),
        path.join(documentationRoot, 'CLI'),
        path.join(documentationRoot, 'cli')
    ),
};

function firstExisting(...candidates) {
    return candidates.find((candidate) => existsSync(candidate)) ?? candidates.at(-1);
}

function assertObject(value, name) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error(`${name} must be an object`);
    }
    return value;
}

function assertSafeRelative(value, name) {
    if (typeof value !== 'string' || !value || path.isAbsolute(value)) {
        throw new Error(`${name} must be a non-empty relative path`);
    }
    const normalized = path.posix.normalize(value.replaceAll('\\', '/'));
    if (normalized === '..' || normalized.startsWith('../')) {
        throw new Error(`${name} escapes its owning root`);
    }
    return normalized;
}

function sha256(content) {
    return createHash('sha256').update(content).digest('hex');
}

function assertHash(value, name) {
    if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) {
        throw new Error(`${name} must be a lowercase SHA-256 digest`);
    }
}

function frontmatter(text, sourceName) {
    if (!text.startsWith('---')) return {};
    const end = text.indexOf('\n---', 3);
    if (end === -1) throw new Error(`unterminated frontmatter: ${sourceName}`);
    const parsed = yaml.load(text.slice(3, end));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
}

function pageTopic(route) {
    if (route.startsWith('/chronicle/')) return 'chronicle';
    if (route.startsWith('/arc/')) return 'arc';
    if (route.startsWith('/components/')) return 'components';
    if (route.startsWith('/cli/')) return 'cli';
    return null;
}

function topicsFor(routes) {
    const topics = [
        {
            id: 'chronicle',
            label: 'Chronicle',
            link: 'chronicle',
            icon: 'seti:db',
            items: [
                { label: 'Overview', slug: 'chronicle' },
                { label: 'Architecture', slug: 'chronicle/architecture' },
                { label: 'Workbench', slug: 'chronicle/workbench' },
            ],
        },
        {
            id: 'arc',
            label: 'Arc',
            link: 'arc',
            icon: 'puzzle',
            items: [{ label: 'Overview', slug: 'arc' }],
        },
        {
            id: 'components',
            label: 'Components',
            link: 'components',
            icon: 'laptop',
            items: [{ label: 'Overview', slug: 'components' }],
        },
        {
            id: 'cli',
            label: 'CLI',
            link: 'cli',
            icon: 'rocket',
            items: [{ label: 'Overview', slug: 'cli' }],
        },
    ];

    const available = new Set(routes.map((route) => pageTopic(route)).filter(Boolean));
    return topics.filter((topic) => available.has(topic.id));
}

let manifestValue;
try {
    manifestValue = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
} catch (error) {
    throw new Error(`public-surface.json is not valid JSON: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
}
const manifest = assertObject(manifestValue, 'manifest');
if (manifest.schemaVersion !== 1) throw new Error('manifest.schemaVersion must be 1');
if (!Array.isArray(manifest.routes) || manifest.routes.length === 0) {
    throw new Error('manifest.routes must be a non-empty array');
}
if (!Array.isArray(manifest.staticFiles)) throw new Error('manifest.staticFiles must be an array');
if (!Array.isArray(manifest.renderDependencies)) throw new Error('manifest.renderDependencies must be an array');
const renderDependencies = manifest.renderDependencies.map((entry) => [entry.path, entry.sha256]);
if (JSON.stringify(renderDependencies) !== JSON.stringify(expectedRenderDependencies)) {
    throw new Error('manifest.renderDependencies differs from the owning-surface render dependency policy');
}
const generatedArtifacts = assertObject(manifest.generatedArtifacts, 'manifest.generatedArtifacts');
const expectedGeneratedExtensions = ['.css', '.js', '.png', '.svg', '.woff2'];
if (generatedArtifacts.prefix !== '_astro/' ||
    JSON.stringify(generatedArtifacts.extensions) !== JSON.stringify(expectedGeneratedExtensions) ||
    generatedArtifacts.sitemapPattern !== '^sitemap-(?:index|[0-9]+)\\.xml$') {
    throw new Error('manifest.generatedArtifacts differs from the owning-surface generated-artifact policy');
}

const actualRoutePolicy = manifest.routes.map((entry) => [
    entry.route,
    entry.contentPath,
    entry.source?.repository,
    entry.source?.path,
    entry.claims,
    entry.sitemap,
]);
if (JSON.stringify(actualRoutePolicy) !== JSON.stringify(expectedRoutePolicy)) {
    throw new Error('manifest.routes differs from the owning-surface exact route/source/claim policy');
}
if (manifest.routes.some((entry) => entry.search !== false || entry.machine !== false)) {
    throw new Error('search and machine output must remain disabled for every current route');
}

const declaredClaims = new Set(manifest.approvedClaimIds ?? []);
if (declaredClaims.size !== allowedClaims.size || [...allowedClaims].some((claim) => !declaredClaims.has(claim))) {
    throw new Error('manifest.approvedClaimIds differs from the owning-surface Approved claim allowlist');
}
if (declaredClaims.has('CLM-010')) throw new Error('Draft CLM-010 cannot enter the public manifest');

const seenRoutes = new Set();
const seenContent = new Set();
await fs.rm(outputRoot, { recursive: true, force: true });
await fs.mkdir(outputRoot, { recursive: true });

for (const [index, rawRoute] of manifest.routes.entries()) {
    const route = assertObject(rawRoute, `routes[${index}]`);
    if (typeof route.route !== 'string' || !route.route.startsWith('/')) {
        throw new Error(`routes[${index}].route must start with /`);
    }
    if (seenRoutes.has(route.route)) throw new Error(`duplicate public route: ${route.route}`);
    seenRoutes.add(route.route);

    const contentPath = assertSafeRelative(route.contentPath, `routes[${index}].contentPath`);
    if (seenContent.has(contentPath)) throw new Error(`duplicate content path: ${contentPath}`);
    seenContent.add(contentPath);

    const source = assertObject(route.source, `routes[${index}].source`);
    const repositoryRoot = repositoryRoots[source.repository];
    if (!repositoryRoot) throw new Error(`unknown source repository: ${source.repository}`);
    if (source.repository === 'Documentation') {
        if (source.revision !== 'self') throw new Error(`Documentation source ${route.route} must use revision self`);
    } else if (typeof source.revision !== 'string' || !/^[a-f0-9]{40}$/.test(source.revision)) {
        throw new Error(`routes[${index}].source.revision must be a full commit SHA`);
    }
    const sourcePath = assertSafeRelative(source.path, `routes[${index}].source.path`);
    assertHash(source.sha256, `routes[${index}].source.sha256`);

    if (!Array.isArray(route.claims)) throw new Error(`routes[${index}].claims must be an array`);
    for (const claim of route.claims) {
        if (!allowedClaims.has(claim)) throw new Error(`route ${route.route} uses unapproved claim ${claim}`);
    }
    if (route.claims.includes('CLM-010')) throw new Error(`route ${route.route} uses Draft CLM-010`);

    const absoluteSource = path.join(repositoryRoot, sourcePath);
    const realRepositoryRoot = await fs.realpath(repositoryRoot);
    const realSource = await fs.realpath(absoluteSource);
    if (realSource !== realRepositoryRoot && !realSource.startsWith(`${realRepositoryRoot}${path.sep}`)) {
        throw new Error(`source escapes its owning repository through a symlink: ${source.repository}:${sourcePath}`);
    }
    const content = await fs.readFile(realSource);
    const actualHash = sha256(content);
    if (actualHash !== source.sha256) {
        throw new Error(`source hash drift for ${source.repository}:${sourcePath}; expected ${source.sha256}, got ${actualHash}`);
    }
    const text = content.toString('utf8');
    const metadata = frontmatter(text, `${source.repository}:${sourcePath}`);
    if (metadata.draft === true) {
        throw new Error(`allowlisted source is still Draft: ${source.repository}:${sourcePath}`);
    }
    const normalizedText = text.replace(/\s+/g, ' ').toLowerCase();
    const blockedClientTerms = ['typescript', 'python', 'java', 'kotlin/jvm', 'elixir'];
    const blockedProviderTerms = ['mongodb', 'postgresql', 'sql server', 'sqlite'];
    if (blockedClientTerms.every((term) => normalizedText.includes(term)) ||
        blockedProviderTerms.every((term) => normalizedText.includes(term))) {
        throw new Error(`allowlisted source contains Draft CLM-010 client/provider matrix wording: ${source.repository}:${sourcePath}`);
    }

    const destination = path.join(outputRoot, contentPath);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
    console.log(`[public-sync] ${route.route} <- ${source.repository}:${sourcePath}`);
}

const realDocumentationRoot = await fs.realpath(documentationRoot);
for (const [relative, expectedHash] of expectedRenderDependencies) {
    const source = path.join(documentationRoot, assertSafeRelative(relative, 'render dependency path'));
    const realSource = await fs.realpath(source);
    if (!realSource.startsWith(`${realDocumentationRoot}${path.sep}`)) {
        throw new Error(`render dependency escapes Documentation root: ${relative}`);
    }
    const content = await fs.readFile(realSource);
    const actualHash = sha256(content);
    if (actualHash !== expectedHash) {
        throw new Error(`render dependency hash drift for ${relative}; expected ${expectedHash}, got ${actualHash}`);
    }
}

await fs.rm(approvedPublicRoot, { recursive: true, force: true });
await fs.mkdir(approvedPublicRoot, { recursive: true });
for (const [index, rawStatic] of manifest.staticFiles.entries()) {
    const staticFile = assertObject(rawStatic, `staticFiles[${index}]`);
    const relative = assertSafeRelative(staticFile.path, `staticFiles[${index}].path`);
    assertHash(staticFile.sha256, `staticFiles[${index}].sha256`);
    const source = path.join(sourcePublicRoot, relative);
    const realPublicRoot = await fs.realpath(sourcePublicRoot);
    const realSource = await fs.realpath(source);
    if (realSource !== realPublicRoot && !realSource.startsWith(`${realPublicRoot}${path.sep}`)) {
        throw new Error(`static file escapes public root through a symlink: ${relative}`);
    }
    const content = await fs.readFile(realSource);
    const actualHash = sha256(content);
    if (actualHash !== staticFile.sha256) {
        throw new Error(`static-file hash drift for ${relative}; expected ${staticFile.sha256}, got ${actualHash}`);
    }
    const destination = path.join(approvedPublicRoot, relative);
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, content);
}

await fs.mkdir(generatedRoot, { recursive: true });
await fs.writeFile(
    path.join(generatedRoot, 'topics.json'),
    `${JSON.stringify(topicsFor([...seenRoutes]), null, 2)}\n`
);
await fs.writeFile(
    path.join(generatedRoot, 'public-routes.json'),
    `${JSON.stringify([...seenRoutes].sort(), null, 2)}\n`
);

console.log(`[public-sync] materialized ${seenRoutes.size} exact routes and ${manifest.staticFiles.length} static files`);
