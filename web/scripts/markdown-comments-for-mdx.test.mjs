// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import assert from 'node:assert/strict';
import test from 'node:test';
import { compile } from '@mdx-js/mdx';
import { markdownCommentsForMdx } from './markdown-comments-for-mdx.mjs';

const license = '<!-- Copyright (c) Cratis. All rights reserved. -->\r\n<!-- Licensed under the MIT license. -->';

test('Markdown snippet license comments become valid MDX without changing visible prose', async () => {
    const input = `${license}\r\n\r\nUse fluent \`fromAll(...)\`.\r\n`;
    const converted = markdownCommentsForMdx(input);
    assert.equal(converted, '{/* Copyright (c) Cratis. All rights reserved. */}\r\n{/* Licensed under the MIT license. */}\r\n\r\nUse fluent `fromAll(...)`.\r\n');
    await compile(converted);
});

test('fenced, indented and inline code retain literal HTML comments', () => {
    const input = '```html\n<!-- literal -->\n```\n\n    <!-- indented -->\n\n`<!-- inline -->`\n';
    assert.equal(markdownCommentsForMdx(input), input);
});

test('multiline and adjacent comments stay hidden, including JavaScript comment terminators', async () => {
    const converted = markdownCommentsForMdx('<!-- first\nsecond */ third --><!-- next -->\n\nText.\n');
    assert.equal(converted, '{/* first\nsecond * / third */}{/* next */}\n\nText.\n');
    await compile(converted);
});
