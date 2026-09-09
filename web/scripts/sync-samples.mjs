// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(scriptDirectory, '..');
const candidates = [
    path.resolve(webRoot, '../../Samples/samples.json'),
    path.resolve(webRoot, '../Samples/samples.json'),
];

let sourcePath;
for (const candidate of candidates) {
    try {
        await access(candidate);
        sourcePath = candidate;
        break;
    } catch {
        // Try the next supported repository layout.
    }
}

if (!sourcePath) {
    throw new Error(
        `Could not find the Samples catalog. Expected one of:\n${candidates.map(candidate => `  - ${candidate}`).join('\n')}`,
    );
}

let catalog;
try {
    catalog = JSON.parse(await readFile(sourcePath, 'utf8'));
} catch (error) {
    throw new Error(`Could not read Samples catalog ${sourcePath}: ${error.message}`);
}
if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.tracks) || !Array.isArray(catalog.samples)) {
    throw new Error(`Unsupported or malformed Samples catalog: ${sourcePath}`);
}

const trackIds = new Set(catalog.tracks.map(track => track.id));
const sampleIds = new Set();
for (const sample of catalog.samples) {
    if (sampleIds.has(sample.id)) {
        throw new Error(`Duplicate sample id '${sample.id}' in ${sourcePath}`);
    }
    sampleIds.add(sample.id);

    if (!trackIds.has(sample.track)) {
        throw new Error(`Sample '${sample.id}' references unknown track '${sample.track}'`);
    }
}

const generatedDirectory = path.resolve(webRoot, 'src/generated');
const outputPath = path.join(generatedDirectory, 'samples.json');
await mkdir(generatedDirectory, { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`);

console.log(`Synced ${catalog.samples.length} samples from ${sourcePath}`);
