// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Run: node --test web/scripts/docs-readiness.test.mjs (from Documentation).
// All writable fixtures stay in this repository's ignored .ai-work directory.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { collectSlugs, convertFile, entryToItem, tocToSidebar, walk } from './sync-content.mjs';
import { emitDocArtifacts } from './emit-doc-artifacts.mjs';
import { normalizeMarkdownTables } from './normalize-markdown-tables.mjs';
import { isPrivateDocPath } from './private-doc-paths.mjs';
import { checkExternalLinks, externalLinkArguments } from './check-external-links.mjs';
import { lintProse } from './lint-prose.mjs';

const webRoot = fileURLToPath(new URL('../', import.meta.url));
const fixturesRoot = path.resolve(webRoot, '../.ai-work/docs-readiness');
const privateDirectories = ['.ai-work', '.pi', '.agents', '.ai', '.claude', '.git', '.github', '.vscode'];

async function fixture(context) {
    await fs.mkdir(fixturesRoot, { recursive: true });
    const root = await fs.mkdtemp(path.join(fixturesRoot, 'regression-'));
    context.after(() => fs.rm(root, { recursive: true, force: true }));
    return root;
}

async function put(root, relative, content) {
    const file = path.join(root, relative);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content);
    return file;
}

function conversionContext(root) {
    return { dir: root, basename: 'index.md', srcPath: path.join(root, 'index.md'), product: { key: 'fixture', src: root } };
}

function stubRunner(results) {
    const calls = [];
    const messages = [];
    return {
        calls, messages,
        run: (...args) => { calls.push(args); return results[calls.length - 1]; },
        logger: { log: (message) => messages.push(message), error: (message) => messages.push(message) },
    };
}

const success = { status: 0 };

test('private paths are recognized before URL decoding, normalization, and slugification', () => {
    for (const directory of privateDirectories) {
        for (const relative of [`product/${directory}/note.md`, `product\\${directory}\\note.md`, `${directory}/../public.md`]) {
            assert.equal(isPrivateDocPath(relative), true, relative);
        }
    }
    assert.equal(isPrivateDocPath('product/%252eai-work/note.md'), true);
    assert.equal(isPrivateDocPath('product/.PI/note.md'), true);
    assert.equal(isPrivateDocPath('product/ai-workflow/agents.md'), false);
});

test('recursive sync and sidebar discovery exclude tooling directories without altering sources', async (context) => {
    const root = await fixture(context);
    const source = path.join(root, '.github'); // The contributing repo itself is a trusted source root.
    const output = path.join(root, 'generated');
    await put(source, 'index.md', '# Public\n\nPublished content.\n');
    for (const directory of privateDirectories) {
        await put(source, `nested/${directory}/work.md`, '# Private\n\nUnpublished work record.\n');
        await put(source, `nested/${directory}/toc.yml`, '- name: Private\n  href: work.md\n');
    }
    const product = { key: 'fixture', src: source };
    await walk(source, output, product);
    assert.deepEqual((await fs.readdir(output)).sort(), ['index.md', 'nested']);
    assert.deepEqual(await fs.readdir(path.join(output, 'nested')), []);
    const slugs = new Set();
    await collectSlugs(source, 'fixture', slugs);
    assert.deepEqual([...slugs], ['fixture']);
    await put(source, 'toc.yml', privateDirectories.map((directory) => `- name: Private\n  href: nested/${directory}/toc.yml`).join('\n'));
    assert.deepEqual(await tocToSidebar(source, 'fixture'), []);
    assert.equal(await entryToItem({ name: 'Encoded private', href: '%2eai-work/toc.yml' }, source, 'fixture'), null);
    for (const directory of privateDirectories) {
        assert.equal(await fs.readFile(path.join(source, `nested/${directory}/work.md`), 'utf8'), '# Private\n\nUnpublished work record.\n');
    }
});

test('private includes, link rewrites, and aliased includes fail closed', async (context) => {
    const root = await fixture(context);
    const privateFile = await put(root, '.ai-work/work.md', '# Private\n\nDo not publish.\n');
    await fs.symlink(privateFile, path.join(root, 'alias.md'));
    for (const body of ['[!INCLUDE [work](.ai-work/work.md)]', '[!INCLUDE [alias](alias.md)]', '[Work](%2eai-work/work.md)']) {
        await assert.rejects(convertFile(body, conversionContext(root)), /private documentation path/);
    }
    await assert.rejects(walk(root, path.join(root, 'generated'), { key: 'fixture', src: root }), /private documentation path/);
    assert.equal(await fs.readFile(privateFile, 'utf8'), '# Private\n\nDo not publish.\n');
});

test('absolute public includes respect a trusted root with a private-named ancestor', async (context) => {
    const root = await fixture(context);
    for (const name of ['.github', '.ai-work/public-docs']) {
        const source = path.join(root, name);
        const publicFile = await put(source, 'building.md', '# Building\n\nPublic building instructions.\n');
        const chapter = path.join(source, 'chapter');
        await fs.mkdir(chapter);
        const conversion = { ...conversionContext(source), dir: chapter, srcPath: path.join(chapter, 'index.md'), contentRoot: source };
        const converted = await convertFile(`[!INCLUDE [public](${publicFile})]`, conversion);
        assert.match(converted, /Public building instructions\./);
    }
});

test('trusted include roots still reject private descendants, escapes, and symlink destinations', async (context) => {
    const root = await fixture(context);
    const source = path.join(root, '.github');
    await put(source, 'public.md', '# Public\n\nPublic content.\n');
    const privateFile = await put(source, '.ai-work/work.md', '# Private\n\nDo not publish.\n');
    const escapedFile = await put(root, '.ai-work/work.md', '# Private sibling\n\nDo not publish.\n');
    await fs.symlink(privateFile, path.join(source, 'alias.md'));
    for (const target of [privateFile, escapedFile, '../.ai-work/work.md', `${source}/.ai-work/../public.md`, path.join(source, 'alias.md')]) {
        await assert.rejects(convertFile(`[!INCLUDE [private](${target})]`, conversionContext(source)), /private documentation path/);
    }
});

test('public prose can explain private work policy and public file aliases still sync', async (context) => {
    const root = await fixture(context);
    const source = path.join(root, 'docs');
    const output = path.join(root, 'generated');
    const prose = 'Keep work records in `.ai-work/`, not `.pi` or `.agents`.\n';
    const publicFile = await put(source, 'policy.md', '# Policy\n\n' + prose);
    await fs.symlink(publicFile, path.join(source, 'alias.md'));
    await walk(source, output, { key: 'fixture', src: source });
    assert.ok((await fs.readFile(path.join(output, 'policy.md'), 'utf8')).endsWith(prose));
    assert.equal(await fs.readFile(path.join(output, 'alias.md'), 'utf8'), await fs.readFile(path.join(output, 'policy.md'), 'utf8'));
    await emitDocArtifacts(output, path.join(root, 'dist'));
    assert.ok((await fs.readFile(path.join(root, 'dist/policy.md'), 'utf8')).endsWith(prose));
});

test('artifact preflight rejects private inputs before emitting any public or private file', async (context) => {
    const root = await fixture(context);
    for (const [index, directory] of privateDirectories.entries()) {
        const source = path.join(root, `source-${index}`);
        const output = path.join(root, `output-${index}`);
        await put(source, 'a-public.md', '# Public\n');
        const privateFile = await put(source, `z-product/${directory}/work.json`, '{"private":true}');
        await assert.rejects(emitDocArtifacts(source, output), /private documentation path/);
        await assert.rejects(fs.access(output), { code: 'ENOENT' });
        assert.equal(await fs.readFile(privateFile, 'utf8'), '{"private":true}');
    }
});

test('artifact preflight rejects symlink aliases into private work', async (context) => {
    const root = await fixture(context);
    const privateFile = await put(root, '.ai-work/work.md', '# Private\n');
    const source = path.join(root, 'docs');
    await fs.mkdir(source);
    await fs.symlink(privateFile, path.join(source, 'public.md'));
    await assert.rejects(emitDocArtifacts(source, path.join(root, 'dist')), /private documentation path/);
});

test('artifact exports preserve public Markdown and asset bytes and routes', async (context) => {
    const root = await fixture(context);
    const source = path.join(root, 'docs');
    const output = path.join(root, 'dist');
    await put(source, 'Product/Guide/index.mdx', '---\ntitle: Guide\n---\n\nPublic body.\n');
    await put(source, 'Product/Guide/Chart.svg', '<svg></svg>');
    assert.deepEqual(await emitDocArtifacts(source, output), { markdownMirrors: 1, staticFiles: 1 });
    assert.equal(await fs.readFile(path.join(output, 'product/guide.md'), 'utf8'), await fs.readFile(path.join(source, 'Product/Guide/index.mdx'), 'utf8'));
    assert.equal(await fs.readFile(path.join(output, 'product/guide/chart.svg'), 'utf8'), '<svg></svg>');
});

test('link conversion normalizes table padding after rewrite, never the source file', async (context) => {
    const root = await fixture(context);
    const source = '# Table\n\n| Page            | Value |\n| :-------------- | ----: |\n| [Go](./Next.md) |  two  spaces |\n';
    const file = await put(root, 'index.md', source);
    const converted = await convertFile(await fs.readFile(file, 'utf8'), conversionContext(root));
    assert.match(converted, /\[Go\]\(\/fixture\/next\/\)/);
    const rows = converted.split('\n').filter((line) => line.startsWith('|'));
    assert.deepEqual(rows, ['| Page | Value |', '| :--- | ---: |', '| [Go](/fixture/next/) | two  spaces |']);
    assert.ok(rows[2].includes('two  spaces'));
    assert.equal(normalizeMarkdownTables(converted), converted);
    assert.equal(await fs.readFile(file, 'utf8'), source);
});

test('table normalization preserves escaped pipes, code spans, alignment and cell interiors', () => {
    const source = '| Left| Center |Right|\n|:---|:---:|---:|\n|a\\|b|`` a|`b ``|two  spaces|\n|`a|b`|x\\\\|` c `|\n';
    const output = normalizeMarkdownTables(source);
    for (const content of ['a\\|b', '`` a|`b ``', 'two  spaces', '`a|b`', 'x\\\\', '` c `']) assert.ok(output.includes(content), content);
    const rows = output.trimEnd().split('\n');
    assert.equal(rows[1], '| :--- | :---: | ---: |');
    assert.equal(normalizeMarkdownTables(output), output);
    assert.equal(normalizeMarkdownTables('Name|Value\n---|---\na|b\n'), '| Name | Value |\n| --- | --- |\n| a | b |\n');
});

test('compact tables preserve wide characters, emoji, and combining characters without width guesses', () => {
    const source = '| Host             | Required |\n| ---------------- | -------: |\n| ａdmin。example   | ✅       |\n| mu\u0308nchen.example | —        |\n';
    const expected = '| Host | Required |\n| --- | ---: |\n| ａdmin。example | ✅ |\n| mu\u0308nchen.example | — |\n';
    assert.equal(normalizeMarkdownTables(source), expected);
    assert.equal(normalizeMarkdownTables(expected), expected);
});

test('compact empty cells share one padding space without changing their meaning', () => {
    const source = '|   | Heading |   |\n| --- | --- | --- |\n| value |    |   |\n';
    const expected = '| | Heading | |\n| --- | --- | --- |\n| value | | |\n';
    assert.equal(normalizeMarkdownTables(source), expected);
    assert.equal(normalizeMarkdownTables(expected), expected);
});

test('fenced and indented table examples and non-table pipe text remain byte-identical', () => {
    const table = '|a|b|\n|---|---|\n|x|y|\n';
    for (const example of [
        '````markdown\n```\n' + table + '```\n````\n',
        '  ~~~~markdown\n~~~\n' + table + '~~~~\n',
        table.split('\n').map((line) => line ? `    ${line}` : '').join('\n'),
        table.split('\n').map((line) => line ? `\t${line}` : '').join('\n'),
        'Pipe | prose\nNot a delimiter\n',
        '| a | b |\n| --- |\n',
    ]) assert.equal(normalizeMarkdownTables(example), example);
    for (const following of ['```markdown | example\n' + table + '```\n', '# Heading | with a pipe\n', '- List | item\n']) {
        assert.equal(normalizeMarkdownTables(table + following), normalizeMarkdownTables(table) + following);
    }
    const windows = table.replaceAll('\n', '\r\n');
    assert.ok(!normalizeMarkdownTables(windows).replaceAll('\r\n', '').includes('\n'));
});

test('external checker explicitly limits lychee to HTTP(S), leaving internal checker separate', () => {
    const runner = stubRunner([success, success]);
    assert.equal(checkExternalLinks(runner), 0);
    assert.equal(runner.calls[1][0], 'lychee');
    assert.deepEqual(runner.calls[1][1], externalLinkArguments);
    assert.deepEqual(externalLinkArguments.slice(4, 11), ['--root-dir', 'dist', '--scheme', 'http', '--scheme', 'https', '--']);
});

test('Vale missing is optional, but probe/sync/config errors and termination are not advice', () => {
    const missing = stubRunner([{ error: { code: 'ENOENT' } }]);
    assert.equal(lintProse(missing), 0);
    assert.match(missing.messages[0], /not installed/);
    for (const results of [
        [{ status: 1 }],
        [success, { status: 1 }],
        [success, success, { status: 2 }],
        [success, success, { status: null, signal: 'SIGTERM' }],
        [success, success, { status: null, error: { code: 'EACCES', message: 'Permission denied' } }],
    ]) {
        const runner = stubRunner(results);
        assert.equal(lintProse(runner), 1);
        assert.equal(runner.calls.length, results.length);
        assert.ok(runner.messages.some((message) => message.includes('failed')));
        assert.ok(runner.messages.every((message) => !message.includes('advisory')));
    }
    const advisory = stubRunner([success, success, success]);
    assert.equal(lintProse(advisory), 0);
    assert.equal(advisory.calls[2][1][0], '--no-exit');
    assert.match(advisory.messages[0], /advisory/);
});

const valeAvailable = spawnSync('vale', ['--version'], { stdio: 'ignore' }).status === 0;
const lycheeAvailable = spawnSync('lychee', ['--version'], { stdio: 'ignore' }).status === 0;

test('installed Vale distinguishes genuine error-level prose alerts from configuration failure without network', { skip: !valeAvailable }, async (context) => {
    const root = await fixture(context);
    await put(root, '.vale.ini', 'StylesPath = styles\nMinAlertLevel = suggestion\nVocab = Cratis\n[*.md]\nBasedOnStyles = Vale, Fixture\n');
    await put(root, 'styles/Fixture/Alert.yml', "extends: existence\nmessage: 'Fixture prose alert.'\nlevel: error\ntokens:\n  - deliberatealert\n");
    await put(root, 'styles/config/vocabularies/Cratis/accept.txt', await fs.readFile(path.join(webRoot, '.vale/styles/config/vocabularies/Cratis/accept.txt')));
    await put(root, 'page.md', 'Cratis deliberatealert\n');
    const run = (args) => spawnSync('vale', ['--no-global', ...args, 'page.md'], { cwd: root, encoding: 'utf8', timeout: 10000 });
    const normal = run(['--output=JSON']);
    assert.equal(normal.status, 1, normal.stderr);
    const advisory = run(['--no-exit', '--output=JSON']);
    assert.equal(advisory.status, 0, advisory.stderr);
    const alerts = Object.values(JSON.parse(advisory.stdout)).flat();
    assert.ok(alerts.some((alert) => alert.Check === 'Fixture.Alert'));
    assert.ok(alerts.every((alert) => alert.Match !== 'Cratis'), 'modern vocabulary must be loaded');
    await put(root, '.vale.ini', 'StylesPath = missing\n[*.md]\nBasedOnStyles = MissingStyle\n');
    const invalid = run(['--no-exit']);
    assert.notEqual(invalid.status, 0, 'configuration errors must not be made advisory by --no-exit');
});

test('installed lychee extraction selects only HTTP(S) and never checks the network', { skip: !lycheeAvailable }, async (context) => {
    const root = await fixture(context);
    await put(root, '.lychee.toml', 'max_retries = 0\n');
    await put(root, 'dist/index.html', '<h1>Fixture site</h1>');
    await put(root, 'page.md', '[HTTP](http://cratis.io/one)\n[HTTPS](https://cratis.io/two)\n[Relative](missing.md)\n[Internal](/missing/)\n[Anchor](#missing)\n[File](file:///not-present.md)\n[Mail](mailto:docs@cratis.io)\n');
    const argumentsBeforeInputs = externalLinkArguments.slice(0, externalLinkArguments.indexOf('--'));
    const result = spawnSync('lychee', [...argumentsBeforeInputs, '--hidden', '--dump', '--', 'page.md'], { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.trim().split(/\r?\n/).sort(), ['http://cratis.io/one', 'https://cratis.io/two']);
});

test('installed lychee filters local links after root resolution without spurious errors', { skip: !lycheeAvailable }, async (context) => {
    const root = await fixture(context);
    await put(root, '.lychee.toml', 'max_retries = 0\n');
    await put(root, 'dist/index.html', '<h1>Fixture site</h1>');
    // .invalid is excluded by Lychee without a network request; local links must
    // likewise be filtered rather than reported as missing-root/file errors.
    await put(root, 'page.md', '[External](https://example.invalid/)\n[Root](/missing/)\n[Relative](missing.md)\n[Fragment](#missing)\n');
    const argumentsBeforeInputs = externalLinkArguments.slice(0, externalLinkArguments.indexOf('--'));
    const result = spawnSync('lychee', [...argumentsBeforeInputs, '--hidden', '--', 'page.md'], { cwd: root, encoding: 'utf8', timeout: 10000 });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.doesNotMatch(result.stdout + result.stderr, /Cannot resolve root-relative|File not found/);
});

test('external checking requires the built root rather than treating missing setup as advice', async (context) => {
    const root = await fixture(context);
    const runner = stubRunner([success]);
    assert.equal(checkExternalLinks({ ...runner, cwd: root }), 1);
    assert.equal(runner.calls.length, 1);
    assert.match(runner.messages[0], /Built-site root is missing/);
});
