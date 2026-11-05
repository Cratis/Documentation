// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { stripMdxSyntax } from './strip-mdx-syntax.mjs';

describe('MDX stripping for Markdown mirrors', () => {
    it('removes imports and component tag lines but keeps prose and frontmatter', () => {
        const source = "---\ntitle: A\n---\nimport { Card } from '@astrojs/starlight/components';\nimport Foo from './foo.astro';\n\n<Card title=\"x\">\n\nReal prose stays.\n\n</Card>\n\n<Foo\n  a=\"1\"\n  b=\"2\"\n/>\n\nMore prose.\n";
        assert.equal(stripMdxSyntax(source), '---\ntitle: A\n---\n\n**x**\n\nReal prose stays.\n\nMore prose.\n');
    });

    it('turns tab items into labelled sections', () => {
        const out = stripMdxSyntax('Intro.\n\n<Tabs syncKey="k">\n<TabItem label="C#">\n\n```cs\nvar x = 1;\n```\n\n</TabItem>\n</Tabs>\n');
        assert.equal(out, 'Intro.\n\n**C#**\n\n```cs\nvar x = 1;\n```\n');
    });

    it('never touches code fences, including indented list fences', () => {
        const source = "```mdx\nimport { A } from 'a';\n<Card>\n```\n\n- ```mdx\n  <Card />\n  ```\n";
        assert.equal(stripMdxSyntax(source), source);
    });

    it('keeps standard HTML and converts inline components to readable text', () => {
        const source = 'A <kbd>Ctrl</kbd> and <Badge text="x" /> inline.\n\n<details>\n<summary>S</summary>\n</details>\n';
        assert.equal(stripMdxSyntax(source), source.replace('<Badge text="x" />', '**x**'));
    });
});

describe('literal MDX text', () => {
    it('removes comments and export templates rather than exposing raw MDX', () => {
        const source = 'Prose.\n\n{/*\n<Card />\n*/}\n\nexport const x = `\n<Card />\n`;\n\n<Card />\n\nEnd.\n';
        assert.equal(stripMdxSyntax(source), 'Prose.\n\nEnd.\n');
    });
});

describe('blank lines', () => {
    it('collapses runs outside code fences but keeps them inside', () => {
        const source = 'import X from "x";\n\n\n\nProse.\n\n\n\n```text\na\n\n\n\nb\n```\n';
        assert.equal(stripMdxSyntax(source), 'Prose.\n\n```text\na\n\n\n\nb\n```\n');
    });
});

describe('nested and multiline components', () => {
    it('keeps inline children and turns static labels and link cards into Markdown', () => {
        const source = `import {
    Tabs,
    TabItem,
} from '@astrojs/starlight/components';

<Tabs>
<TabItem
    label={'TypeScript'}
>
Use <Badge>typed events</Badge> and a \`<Generic<T>>\`.

<LinkCard title="Get started" href="/chronicle/get-started/" />

</TabItem>
<TabItem label={\`C#\`}>
\`\`\`cs
var label = "<TabItem>";


\`\`\`
</TabItem>
</Tabs>
`;
        const output = stripMdxSyntax(source);
        assert.match(output, /\*\*TypeScript\*\*/);
        assert.match(output, /Use typed events and a `<Generic<T>>`\./);
        assert.match(output, /\[Get started\]\(\/chronicle\/get-started\/\)/);
        assert.match(output, /\*\*C#\*\*/);
        assert.match(output, /```cs\nvar label = "<TabItem>";\n\n\n```/);
        assert.doesNotMatch(output, /import |<Tabs>|<Badge>|<LinkCard/);
    });

    it('preserves SimpleCard link props and LinkCard descriptions', () => {
        const source = '<SimpleCard title="Commands" link="/arc/commands/#handlers" />\n\n<LinkCard title="Events" href="/chronicle/events/" description="Record what happened." />\n';
        assert.equal(stripMdxSyntax(source), '[Commands](/arc/commands/#handlers)\n\n[Events](/chronicle/events/) — Record what happened.\n');
    });

    it('preserves static expression card props without evaluating dynamic props', () => {
        const source = '<SimpleCard title={"Queries"} link={\`/arc/queries/\`} description={"Read the result."} />\n\n<LinkCard title="Dynamic" href={destination} description={summary} />\n';
        assert.equal(stripMdxSyntax(source), '[Queries](/arc/queries/) — Read the result.\n\n**Dynamic**\n');
    });

    it('keeps card children after the linked title and description', () => {
        const source = '<SimpleCard title="Commands" link="/arc/commands/" description="Run a command.">\n\nKeep this explanation.\n\n</SimpleCard>\n';
        assert.equal(stripMdxSyntax(source), '[Commands](/arc/commands/) — Run a command.\n\nKeep this explanation.\n');
    });

    it('removes expressions outside code but leaves code examples intact', () => {
        const source = 'export const value = 42;\n\nCount: {value}. Use `{value}`. <Badge>{"Preview"}</Badge>\n';
        assert.equal(stripMdxSyntax(source), 'Count: . Use `{value}`. Preview\n');
    });
});
