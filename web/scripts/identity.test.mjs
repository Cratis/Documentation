// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import * as sync from './sync-content.mjs';
import { familyOf } from './llm-families.mjs';
import { sourceEditUrl } from './source-edit-url.mjs';
import { pageSection } from './page-metadata.mjs';
import { socialPreview } from './social-images.mjs';
import { repositoryForLanding } from '../src/lib/org-stats.mjs';

const webRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const identity = () => sync.PRODUCTS.find((product) => product.key === 'identity');

async function put(root, relative, body) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, body);
}

async function fixture(context, overrides = {}) {
    const root = await fs.mkdtemp(path.join(webRoot, '../.ai-work/identity-spec-'));
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    const product = { key: 'identity', src: path.join(root, 'source'), readmeIndex: true, ...overrides };
    const output = path.join(root, 'output');
    await put(product.src, 'README.md', '# Identity documentation\n\n[Specifications](specs/README.md#conventions).\n');
    await put(product.src, 'specs/README.md', '# Specifications\n\nDraft contracts are not deployed behavior.\n\n[Organisation, workspace and namespace](identity-tenant-model-v1.md).\n');
    await put(product.src, 'specs/identity-tenant-model-v1.md', '# Tenant model: organisation, workspace and namespace\n\n```text\nSpec id: identity-tenant-model\nVersion: 1\nStatus: Signed off\n```\n\nThe `organisation_id` MUST NOT grant product membership.\n\n[Specifications](README.md).\n');
    return { product, output };
}

test('Identity has an explicit public source, opt-in README indexes and real section buckets', () => {
    assert.ok(identity());
    assert.equal(identity().label, 'Identity');
    assert.equal(identity().sidebarMode, 'toc');
    assert.match(identity().src, /[/\\]Identity[/\\]Documentation$/);
    assert.equal(identity().readmeIndex, true);
    assert.deepEqual(sync.PRODUCTS.filter((product) => product.readmeIndex).map((product) => product.key), ['identity']);
    const sections = identity().buckets.flatMap((bucket) => bucket.sections);
    for (const section of ['Specifications', 'Security', 'Deployment']) assert.ok(sections.includes(section));
    assert.deepEqual(identity().excludePages.map((entry) => entry.path), ['inventory/', 'e2e/', 'design/']);
});

test('Identity is discoverable through the topic route, stack, source links and CI checkout', async () => {
    const config = await fs.readFile(path.join(webRoot, 'astro.config.mjs'), 'utf8');
    const stack = await fs.readFile(path.join(webRoot, 'src/content/docs/cratis-stack.mdx'), 'utf8');
    const workflow = await fs.readFile(path.join(webRoot, '../.github/workflows/docs-site.yml'), 'utf8');
    const ignore = await fs.readFile(path.join(webRoot, '.gitignore'), 'utf8');
    assert.match(config, /identity: \['\/identity', '\/identity\/\*\*'\]/);
    assert.match(stack, /link="\/identity\/"/);
    assert.match(workflow, /repository: Cratis\/Identity[\s\S]*?path: Identity/);
    assert.match(ignore, /^src\/content\/docs\/identity\/$/m);
    assert.equal(familyOf('identity')?.id, 'tooling');
    assert.equal(pageSection('identity/specs'), 'Identity');
    assert.equal(socialPreview('/identity/specs/').alt, 'Cratis Identity documentation');
    assert.equal(socialPreview('/identity/specs/').url, 'https://www.cratis.io/og/authproxy.png');
    assert.equal(repositoryForLanding('/identity/'), 'Identity');
    assert.equal(sourceEditUrl('/repos/Identity/Documentation/specs/README.md', '/repos', '/repos/Documentation'),
        'https://github.com/Cratis/Identity/edit/main/Documentation/specs/README.md');
});

test('opt-in README indexes preserve contract text and resolve index and versioned links', async (context) => {
    const { product, output } = await fixture(context);
    await sync.walk(product.src, output, product);
    const landing = await fs.readFile(path.join(output, 'index.md'), 'utf8');
    const specifications = await fs.readFile(path.join(output, 'specs/index.md'), 'utf8');
    const contract = await fs.readFile(path.join(output, 'specs/identity-tenant-model-v1.md'), 'utf8');
    assert.match(landing, /\[Specifications\]\(\/identity\/specs\/#conventions\)/);
    assert.match(specifications, /Draft contracts are not deployed behavior\./);
    assert.match(specifications, /\[Organisation, workspace and namespace\]\(\/identity\/specs\/identity-tenant-model-v1\/\)/);
    assert.match(contract, /Spec id: identity-tenant-model\nVersion: 1\nStatus: Signed off/);
    assert.match(contract, /`organisation_id` MUST NOT grant product membership\./);
    assert.match(contract, /\[Specifications\]\(\/identity\/specs\/\)/);
    await assert.rejects(fs.access(path.join(output, 'README.md')), { code: 'ENOENT' });
});

test('products without the flag still skip READMEs and retain README link targets', async (context) => {
    const { product, output } = await fixture(context, { readmeIndex: false });
    await put(product.src, 'index.md', '# Existing landing\n\n[Readme](specs/README.md).\n');
    await sync.walk(product.src, output, product);
    assert.match(await fs.readFile(path.join(output, 'index.md'), 'utf8'), /\[Readme\]\(\/identity\/specs\/readme\/\)/);
    await assert.rejects(fs.access(path.join(output, 'specs/index.md')), { code: 'ENOENT' });
});

test('an existing index wins over an opt-in README without a slug collision', async (context) => {
    const { product, output } = await fixture(context);
    await put(product.src, 'index.md', '# Existing landing\n\nKeep this landing.\n');
    await sync.walk(product.src, output, product);
    assert.match(await fs.readFile(path.join(output, 'index.md'), 'utf8'), /Keep this landing\./);
});

test('directory exclusions cover future notes, leave similarly named public directories and keep operations docs', async (context) => {
    const { product, output } = await fixture(context, {
        excludePages: ['inventory/', 'e2e/', 'design/'].map((entry) => ({ path: entry, reason: 'Internal work notes.' })),
    });
    for (const directory of ['inventory', 'e2e', 'design']) {
        await put(product.src, `${directory}/future/note.md`, '# Internal note\n');
    }
    for (const directory of ['security', 'deployment', 'design-guide']) {
        await put(product.src, `${directory}/guide.md`, '# Public guide\n');
    }
    await sync.walk(product.src, output, product);
    for (const directory of ['inventory', 'e2e', 'design']) {
        await assert.rejects(fs.access(path.join(output, directory)), { code: 'ENOENT' });
    }
    for (const directory of ['security', 'deployment', 'design-guide']) {
        await fs.access(path.join(output, directory, 'guide.md'));
    }
});

test('README navigation exposes the landing, specifications and nested runbooks with titles from synced pages', async (context) => {
    const { product, output } = await fixture(context);
    await put(product.src, 'security/README.md', '# Security\n');
    await put(product.src, 'security/runbooks/restore.md', '# Restore the fence log\n');
    await put(product.src, 'deployment/container.md', '# Container image contract\n');
    await sync.walk(product.src, output, product);
    const { readmeNavigation } = await import('./readme-navigation.mjs');
    const navigation = await readmeNavigation(output, 'identity');
    assert.equal(navigation.label, 'Identity documentation');
    assert.deepEqual(navigation.items[0], { label: 'Overview', slug: 'identity' });
    const specifications = navigation.items.find((item) => item.label === 'Specifications');
    assert.deepEqual(specifications.items[0], { label: 'Overview', slug: 'identity/specs' });
    assert.ok(specifications.items.some((item) => item.slug === 'identity/specs/identity-tenant-model-v1'));
    assert.equal(navigation.items.find((item) => item.label === 'Deployment').items[0].label, 'Container image contract');
    const security = navigation.items.find((item) => item.label === 'Security');
    const runbooks = security.items.find((item) => item.label === 'Runbooks');
    assert.equal(runbooks.items[0].slug, 'identity/security/runbooks/restore');
});
