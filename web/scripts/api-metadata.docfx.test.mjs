// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Explicit native gate: node --test scripts/api-metadata.docfx.test.mjs
// Requires DocFX (DOCFX_PATH may select the installed executable); no silent skip.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { it } from 'node:test';
import { reconcileMetadata, saveMetadata } from './api-metadata.mjs';
import { writeApiRedirects } from './api-redirects.mjs';
import { htmlAnchors, verifyApiLinks } from './verify-api-links.mjs';
import { apiMetadataFixture } from './fixtures/api-metadata.mjs';

it('native DocFX preserves every legacy page anchor and renders both assemblies on merged parents', () => {
    const scratch = path.resolve(import.meta.dirname, '../../.ai-work/docs-readiness/api-native-tests');
    mkdirSync(scratch, { recursive: true });
    const directory = mkdtempSync(path.join(scratch, 'case-'));
    const localDocfx = path.join(os.homedir(), '.dotnet/tools/docfx');
    const docfx = process.env.DOCFX_PATH ?? (existsSync(localDocfx) ? localDocfx : 'docfx');
    const { baselines, combined } = apiMetadataFixture();
    function build(metadata, route, name) {
        metadata.directory = path.join(directory, route);
        mkdirSync(metadata.directory, { recursive: true });
        saveMetadata(metadata);
        // The native template links its logo to the API landing page.
        writeFileSync(path.join(directory, 'index.md'), '# Sample API\n');
        const config = {
            build: {
                content: [{ files: [`${route}/*.yml`, 'index.md'] }],
                output: path.join(directory, name),
                template: ['default', 'modern'],
                globalMetadata: { _disableContribution: true },
            },
        };
        const configPath = path.join(directory, `${name}.json`);
        writeFileSync(configPath, JSON.stringify(config));
        execFileSync(docfx, [
            'build', configPath, '--warningsAsErrors', '--disableGitFeatures',
            '--exportRawModel', '--rawModelOutputFolder', path.join(directory, `${name}-raw`),
        ], { cwd: directory, stdio: 'inherit' });
        const namespaceModel = JSON.parse(readFileSync(path.join(directory, `${name}-raw`, route, 'Sample.raw.json'), 'utf8'));
        assert.deepEqual(namespaceModel.children.map(child => [child.uid, child.type]),
            metadata.items.get('Sample').item.children.map(uid => [uid, 'class']));
        return config.build.output;
    }
    try {
        // Native legacy pages establish the actual anchor contract, including overloads
        // and generic type names; this test never guesses DocFX's UID sanitization.
        const legacySites = baselines.map(({ library, metadata }, index) => build(metadata, library.legacy, `old-${index}`));
        const audit = reconcileMetadata(baselines, combined);
        const site = build(combined, 'dotnet', 'canonical');
        writeApiRedirects(site, audit);
        const links = [];
        baselines.forEach(({ library, metadata }, index) => {
            for (const filename of metadata.documents.keys()) {
                const oldRoute = `${library.legacy}/${filename.replace('.yml', '.html')}`;
                const oldHtml = readFileSync(path.join(legacySites[index], oldRoute), 'utf8');
                const canonicalHtml = readFileSync(path.join(site, audit.routes[oldRoute].target), 'utf8');
                const canonicalAnchors = htmlAnchors(canonicalHtml);
                for (const anchor of htmlAnchors(oldHtml)) {
                    assert.ok(canonicalAnchors.has(anchor), `Lost native legacy anchor ${oldRoute}#${anchor}`);
                    links.push(`<a href="${oldRoute}#${encodeURIComponent(anchor)}">Legacy anchor</a>`);
                }
                links.push(`<a href="${oldRoute}">Legacy page</a>`);
            }
        });
        assert.ok(links.length > 10, 'Expected real native member, overload, and page anchors');
        writeFileSync(path.join(site, 'legacy-links.html'), links.join('\n'));
        assert.deepEqual(verifyApiLinks(site).issues, []);
        const rendered = readFileSync(path.join(site, 'dotnet/Sample.Extensions.html'), 'utf8');
        const rawModel = JSON.parse(readFileSync(path.join(directory, 'canonical-raw/dotnet/Sample.Extensions.raw.json'), 'utf8'));
        assert.deepEqual(rawModel.assemblies, ['Library.A', 'Library.B']);
        // Native modern's class header intentionally renders only assemblies.0.
        // Both assembly labels, descriptions, and source links must remain visible
        // in the reconciled remarks, not merely in the raw model or audit report.
        assert.match(rendered, /Library\.A\.dll/);
        for (const assembly of ['Library.A', 'Library.B']) {
            assert.ok(rendered.includes(`<strong>${assembly}</strong>`));
            assert.ok(rendered.includes(`Extensions from ${assembly}.`));
            assert.ok(rendered.includes(`href="https://example.com/${assembly}/Extensions.cs"`));
        }
        assert.match(rendered, /Sample_Extensions_Add_/);
    } finally {
        rmSync(directory, { recursive: true, force: true });
    }
});
