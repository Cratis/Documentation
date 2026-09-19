// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Derives the upgrade-path index from each product's own major-version guide.
//
// The guide is the single source of truth: this reads the `### N to M` sections a product
// already publishes and writes a machine-readable index beside the other generated data. It is
// deliberately not a hand-maintained data file - one would drift from the prose it describes,
// and the drift would be invisible until someone mid-upgrade trusted the wrong one.
//
// Run after sync-content.mjs, which is what puts the product guides under src/content/docs.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTENT_ROOT = path.join(HERE, '..', 'src', 'content', 'docs');
const OUTPUT = path.join(HERE, '..', 'src', 'generated', 'upgrade-paths.json');

const GUIDE_NAME = 'major-versions.md';
const BOUNDARY = /^###\s+(\d+)\s+to\s+(\d+)\s*$/;
// `| [6 → 7](#6-to-7) | Stored state | Inbox observer keys changed |`
const GLANCE_ROW = /^\|\s*\[(\d+)\s*→\s*(\d+)\]\([^)]*\)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*$/;

/** Find every product that publishes a major-version guide. */
async function findGuides(root) {
    const found = [];
    let entries;

    try {
        entries = await fs.readdir(root, { withFileTypes: true });
    } catch {
        return found;
    }

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const guide = path.join(root, entry.name, 'upgrading', GUIDE_NAME);
        try {
            await fs.access(guide);
            found.push({ product: entry.name, guide });
        } catch {
            // A product without an upgrade guide simply does not appear in the picker.
        }
    }

    return found;
}

/** Parse the `### N to M` sections a guide publishes. */
export function parseGuide(markdown) {
    const lines = markdown.split(/\r?\n/);
    const glance = new Map();

    for (const line of lines) {
        const row = GLANCE_ROW.exec(line);
        if (row) {
            glance.set(`${row[1]}-${row[2]}`, { touches: row[3].trim(), summary: row[4].trim() });
        }
    }

    const boundaries = [];
    let current = null;

    for (const line of lines) {
        const heading = BOUNDARY.exec(line);
        if (heading) {
            current = {
                from: Number(heading[1]),
                to: Number(heading[2]),
                title: '',
                released: '',
                action: '',
            };
            boundaries.push(current);
            continue;
        }

        if (!current) continue;
        if (/^##\s/.test(line)) {
            current = null;
            continue;
        }

        // `**Stored observer state** — released 2023-01-10.`
        const title = /^\*\*(.+?)\*\*\s*[—-]\s*released\s+(\d{4}-\d{2}-\d{2})/.exec(line);
        if (title && !current.title) {
            current.title = title[1].trim();
            current.released = title[2];
            continue;
        }

        // Prose is hard-wrapped, so the action continues until the next blank line.
        const action = /^\*\*You do:\*\*\s*(.+)$/.exec(line);
        if (action && !current.action) {
            current.action = action[1].trim();
            current.collecting = true;
            continue;
        }

        if (current.collecting) {
            if (line.trim() === '') {
                current.collecting = false;
            } else {
                current.action = `${current.action} ${line.trim()}`;
            }
        }
    }

    return boundaries.map(({ collecting, ...boundary }) => {
        const glanced = glance.get(`${boundary.from}-${boundary.to}`) ?? { touches: '', summary: '' };
        return {
            ...boundary,
            ...glanced,
            // Not every boundary states an action - 8 to 9 changed only startup, and 9 to 10 left
            // no record at all. The one-line summary is what the picker shows for those.
            action: boundary.action || glanced.summary,
        };
    });
}

async function main() {
    const guides = await findGuides(CONTENT_ROOT);
    const products = [];

    for (const { product, guide } of guides) {
        const boundaries = parseGuide(await fs.readFile(guide, 'utf8'));

        // A guide that exists but parses to nothing means its structure changed and this script
        // silently stopped understanding it. Failing is the point: a picker rendering an empty
        // list looks exactly like a product with no upgrades.
        if (boundaries.length === 0) {
            throw new Error(
                `[sync-upgrade-paths] ${guide} has no '### N to M' boundaries. Either the guide ` +
                    `changed shape or it is empty; a silently empty upgrade picker is worse than a failed build.`
            );
        }

        boundaries.sort((left, right) => left.from - right.from);
        products.push({
            product,
            href: `/${product}/upgrading/major-versions/`,
            boundaries,
        });
        console.log(`[sync-upgrade-paths] ${product}: ${boundaries.length} boundaries`);
    }

    products.sort((left, right) => left.product.localeCompare(right.product));
    await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
    await fs.writeFile(OUTPUT, `${JSON.stringify({ products }, null, 4)}\n`, 'utf8');
    console.log(`[sync-upgrade-paths] wrote ${products.length} product(s) to ${path.relative(process.cwd(), OUTPUT)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
    main().catch((error) => {
        console.error(error.message ?? error);
        process.exit(1);
    });
}
