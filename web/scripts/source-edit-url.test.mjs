// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import path from 'node:path';
import { it } from 'node:test';
import { sourceEditUrl, sourceViewUrl } from './source-edit-url.mjs';

const repos = '/checkout/cratis';
const site = path.join(repos, 'Documentation');
const edit = (file) => sourceEditUrl(file, repos, site);

it('links a product page to its authored sibling checkout', () => {
    assert.equal(edit(path.join(repos, 'Chronicle/Documentation/get-started/index.mdx')),
        'https://github.com/Cratis/Chronicle/edit/main/Documentation/get-started/index.mdx');
    assert.equal(edit(path.join(repos, 'Chronicle.Kotlin/Documentation/guides/client.md')),
        'https://github.com/Cratis/Chronicle.Kotlin/edit/main/Documentation/guides/client.md');
    assert.equal(edit(path.join(repos, 'Arc.Kotlin/Documentation/guides/command.md')),
        'https://github.com/Cratis/Arc.Kotlin/edit/main/Documentation/guides/command.md');
    assert.equal(edit(path.join(repos, 'Arc.TypeScript/Documentation/commands/model-bound/index.md')),
        'https://github.com/Cratis/Arc.TypeScript/edit/main/Documentation/commands/model-bound/index.md');
});

it('links fallback submodules and the organization contributing source', () => {
    assert.equal(edit(path.join(site, 'Arc/Documentation/tutorial/first-slice.mdx')),
        'https://github.com/Cratis/Arc/edit/main/Documentation/tutorial/first-slice.mdx');
    assert.equal(edit(path.join(site, 'GitHubLanding/contributing.md')),
        'https://github.com/Cratis/.github/edit/main/contributing.md');
    assert.equal(edit(path.join(site, 'CLI/Documentation/new.md')),
        'https://github.com/Cratis/cli/edit/main/Documentation/new.md');
});

it('views a snippet file in its owning repository with the same allowlist as editing', () => {
    assert.equal(sourceViewUrl(path.join(repos, 'Chronicle.Kotlin/Documentation/client-snippets-java/events/append.md'), repos, site),
        'https://github.com/Cratis/Chronicle.Kotlin/blob/main/Documentation/client-snippets-java/events/append.md');
    assert.equal(sourceViewUrl(path.join(repos, 'Arc.TypeScript/Documentation/client-snippets/tutorial/first-slice/author-slice.md'), repos, site),
        'https://github.com/Cratis/Arc.TypeScript/blob/main/Documentation/client-snippets/tutorial/first-slice/author-slice.md');
    assert.equal(sourceViewUrl(path.join(repos, 'Unrelated/Documentation/snippet.md'), repos, site), false);
    assert.equal(sourceViewUrl(path.join(site, '.ai-work/snippet.md'), repos, site), false);
});

it('does not send local fixtures or generated site files to an invented repo', () => {
    assert.equal(edit('/private/work/page.md'), false);
    assert.equal(edit(path.join(site, '.ai-work/fixture.md')), false);
    assert.equal(edit(path.join(site, 'web/src/content/docs/arc/index.md')), false);
    assert.equal(edit(path.join(repos, 'Unrelated/Documentation/index.md')), false);
    assert.equal(edit(), false);
});
