// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Navigation for products that explicitly publish README files as indexes.
// Read only the synced pages, so excluded and private source files cannot leak into navigation.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export function skipReadme(entryName, readmeIndex, entries) {
    if (entryName.toLowerCase() !== 'readme.md') return false;
    return !readmeIndex || entries.some((entry) => /^index\.mdx?$/i.test(entry.name));
}

function titleFromName(name) {
    return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function navigationEntry(directory, slugBase, entry) {
    const source = path.join(directory, entry.name);
    const basename = entry.name.replace(/\.mdx?$/i, '');
    const segment = basename.toLowerCase().replace(/[^a-z0-9_-]+/g, '');
    const slug = `${slugBase}/${segment}`;
    if (entry.isDirectory()) {
        const group = await readmeNavigation(source, slug);
        return group.items.length ? group : null;
    }
    if (!entry.isFile() || !/\.mdx?$/i.test(entry.name)) return null;
    const raw = await fs.readFile(source, 'utf8');
    const frontmatter = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    const metadata = frontmatter ? yaml.load(frontmatter[1]) : {};
    return { label: metadata?.title ?? titleFromName(basename), slug: basename === 'index' ? slugBase : slug };
}

async function navigationEntries(directory) {
    try {
        return await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

export async function readmeNavigation(directory, slugBase) {
    const entries = await navigationEntries(directory);
    entries.sort((left, right) => left.name.localeCompare(right.name));
    const items = [];
    let label = titleFromName(path.basename(directory));
    for (const entry of entries) {
        const item = await navigationEntry(directory, slugBase, entry);
        if (!item) continue;
        if (item.slug === slugBase) {
            label = item.label;
            items.unshift({ label: 'Overview', slug: slugBase });
        } else {
            items.push(item);
        }
    }
    return { label, collapsed: true, items };
}
