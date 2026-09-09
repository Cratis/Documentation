// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Build every required .NET and TypeScript reference before replacing public/api.
// Run from web with npm run build:api. Requires the .NET SDK, DocFX, and restored
// documentation/product JavaScript dependencies. Nothing is published remotely.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyApiLinks } from './verify-api-links.mjs';
import { apiLibraries, metadataConfiguration, readMetadata, reconcileMetadata, saveMetadata } from './api-metadata.mjs';
import { writeApiRedirects } from './api-redirects.mjs';

const web = path.resolve(import.meta.dirname, '..');
const repositories = path.resolve(web, '..', '..');
const apiBuild = path.join(web, 'api-build');
const generatedSite = path.join(apiBuild, '_site');
const publicApi = path.join(web, 'public', 'api');
const typeDoc = path.join(web, 'node_modules', '.bin', 'typedoc');
const localDocFx = path.join(os.homedir(), '.dotnet', 'tools', 'docfx');
const docFx = existsSync(localDocFx) ? localDocFx : 'docfx';
const config = JSON.parse(readFileSync(path.join(apiBuild, 'docfx.json'), 'utf8'));
const metadataConfig = metadataConfiguration(config, apiBuild);
const typeScriptPackages = [
    { name: 'Arc', source: 'Arc/Source/JavaScript/Arc', output: 'arc/javascript/arc' },
    { name: 'Arc.React', source: 'Arc/Source/JavaScript/Arc.React', output: 'arc/javascript/arc.react' },
    { name: 'Arc.React.MVVM', source: 'Arc/Source/JavaScript/Arc.React.MVVM', output: 'arc/javascript/arc.react.mvvm' },
    { name: 'Arc.Vite', source: 'Arc/Source/JavaScript/Arc.Vite', output: 'arc/javascript/arc.vite' },
    { name: 'Fundamentals', source: 'Fundamentals/Source/JavaScript', output: 'fundamentals/javascript' },
];

function run(program, argumentsList, cwd = web) {
    console.log(`\n+ ${program} ${argumentsList.map(argument => JSON.stringify(argument)).join(' ')}`);
    execFileSync(program, argumentsList, { stdio: 'inherit', cwd });
}

for (const packageDefinition of typeScriptPackages) {
    for (const filename of ['index.ts', 'tsconfig.json']) {
        const requiredFile = path.join(repositories, packageDefinition.source, filename);
        if (!existsSync(requiredFile)) throw new Error(`Missing required ${packageDefinition.name} API input: ${requiredFile}`);
    }
}
if (!existsSync(typeDoc)) throw new Error('TypeDoc is missing. Restore the documentation site dependencies first.');

console.log('== [1/4] Build reference assemblies with warnings treated as errors ==');
for (const { project } of apiLibraries) {
    run('dotnet', ['build', path.join(repositories, project), '-c', 'Release', '-warnaserror', '-p:CratisProxiesOutputPath=']);
}

console.log('== [2/4] Generate DocFX API reference ==');
for (const directory of ['_site', '_meta', 'dotnet', 'chronicle', 'arc', 'fundamentals']) {
    rmSync(path.join(apiBuild, directory), { recursive: true, force: true });
}
// Check exact assembly and XML inputs: a missing glob must never look like a successful empty batch.
for (const source of metadataConfig.metadata.at(-1).src) {
    for (const filename of [source.files[0], source.files[0].replace(/\.dll$/, '.xml')]) {
        if (!existsSync(path.join(source.src, filename))) throw new Error(`Missing compiled API input: ${path.join(source.src, filename)}`);
    }
}
mkdirSync(path.join(apiBuild, '_meta'), { recursive: true });
const metadataConfigPath = path.join(apiBuild, '_meta', 'metadata.json');
writeFileSync(metadataConfigPath, `${JSON.stringify(metadataConfig, null, 2)}\n`);
run(docFx, ['metadata', metadataConfigPath, '--warningsAsErrors'], apiBuild);
const combined = readMetadata(path.join(apiBuild, 'dotnet'));
const audit = reconcileMetadata(apiLibraries.map(library => ({ library, metadata: readMetadata(path.join(apiBuild, '_meta', library.legacy)) })), combined);
saveMetadata(combined);
console.log(`Validated ${audit.uniqueUids} unique API UIDs from ${audit.sourceItems} source items across ${audit.assemblies.length} assemblies.`);
run(docFx, ['build', 'docfx.json', '--warningsAsErrors'], apiBuild);
if (!existsSync(path.join(generatedSite, 'index.html'))) throw new Error('DocFX did not generate the API landing page.');
console.log(`Created ${writeApiRedirects(generatedSite, audit)} validated legacy API page redirects.`);

console.log('== [3/4] Generate every required TypeDoc package ==');
for (const packageDefinition of typeScriptPackages) {
    const source = path.join(repositories, packageDefinition.source);
    const destination = path.join(generatedSite, packageDefinition.output);
    run(typeDoc, [
        '--out', destination,
        '--tsconfig', path.join(source, 'tsconfig.json'),
        '--name', packageDefinition.name,
        // Deliberately not --treatWarningsAsErrors: TypeDoc warns about TSDoc
        // hygiene in the *product* repositories (unused @param names and the
        // like). Those are owned by Arc/Fundamentals, so gating the docs build
        // on them would break this site's CI for changes it cannot make. The
        // generated-output and link checks below remain hard gates.
        '--excludeExternals',
        '--readme', 'none',
        path.join(source, 'index.ts'),
    ]);
    if (!existsSync(path.join(destination, 'index.html'))) throw new Error(`TypeDoc did not generate ${packageDefinition.name}.`);
}

console.log('== [4/4] Validate links and replace the local API output ==');
const verification = verifyApiLinks(generatedSite);
console.log(`Checked ${verification.checked} API links across ${verification.pages} HTML pages; ${verification.deferredSiteLinks} narrative-site links remain under the complete site link check.`);
for (const issue of verification.issues) console.error(`${path.relative(generatedSite, issue.file)} -> ${issue.href}: ${issue.reason}`);
if (verification.issues.length) throw new Error(`Generated API reference has ${verification.issues.length} broken links or anchors. Existing public/api was not replaced.`);

// Keep the last complete output recoverable until the validated replacement is in
// place. A failed generator or link check never exposes a partially generated site.
const scratch = path.join(web, '..', '.ai-work', 'docs-readiness', 'api-build');
mkdirSync(scratch, { recursive: true });
const backupDirectory = mkdtempSync(path.join(scratch, 'previous-'));
const previousApi = path.join(backupDirectory, 'api');
mkdirSync(path.dirname(publicApi), { recursive: true });
const hadPreviousOutput = existsSync(publicApi);
if (hadPreviousOutput) renameSync(publicApi, previousApi);
try {
    renameSync(generatedSite, publicApi);
} catch (error) {
    if (hadPreviousOutput) renameSync(previousApi, publicApi);
    throw error;
}
rmSync(backupDirectory, { recursive: true, force: true });
console.log(`\nComplete API reference generated under web/public/api (${readdirSync(publicApi).length} root entries).`);
