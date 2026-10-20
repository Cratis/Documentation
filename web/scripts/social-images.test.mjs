import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { socialImageSections, socialPreview, withSocialPreview } from './social-images.mjs';

describe('section social images', () => {
    it('maps every card section by the first path segment', () => {
        for (const [section, label] of Object.entries(socialImageSections)) {
            for (const pathname of [`/${section}/`, `/${section}/reference/nested/`]) {
                assert.deepEqual(socialPreview(pathname), {
                    url: `https://www.cratis.io/og/${section}.png`,
                    alt: `Cratis ${label} documentation`, width: 1200, height: 630,
                });
            }
        }
    });

    it('shares product cards with language clients and groups related tools', () => {
        for (const [route, section, label] of [
            ['chronicle/go/client', 'chronicle', 'Chronicle'],
            ['chronicle/clients/typescript', 'chronicle', 'Chronicle'],
            ['arc/go', 'arc', 'Arc'],
            ['fundamentals/go', 'fundamentals', 'Fundamentals'],
            ['chronicle-mcp', 'chronicle', 'Chronicle MCP'],
            ['eventmodelers-ai/csharp', 'ai', 'AI'],
            ['cli', 'tools', 'CLI'],
            ['templates', 'tools', 'Templates'],
        ]) {
            assert.equal(socialPreview(`/${route}/`).url, `https://www.cratis.io/og/${section}.png`);
            assert.equal(socialPreview(`/${route}/`).alt, `Cratis ${label} documentation`);
        }
    });

    it('keeps the current image for the home page, 404 and unknown sections', () => {
        for (const route of ['/', '/404/', '/concepts/events/', '/arc-like/', '/constructor/', '/__proto__/']) {
            assert.equal(socialPreview(route).url, 'https://www.cratis.io/og-image.jpg');
            assert.equal(socialPreview(route).alt, 'Cratis documentation');
        }
    });

    it('emits exactly one image and dimension tag, preserving unrelated metadata', () => {
        const description = { tag: 'meta', attrs: { name: 'description', content: 'Existing description' } };
        const oldImage = { tag: 'meta', attrs: { property: 'og:image', content: 'old.jpg' } };
        const once = withSocialPreview([description, oldImage, oldImage], '/arc/');
        const head = withSocialPreview(once, '/chronicle/');
        for (const name of ['og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:image', 'twitter:image:alt']) {
            const matches = head.filter(({ attrs }) => (attrs.property ?? attrs.name) === name);
            assert.equal(matches.length, 1, name);
            assert.ok(matches[0].attrs.content);
        }
        assert.ok(head.includes(description));
        assert.equal(head.find(({ attrs }) => attrs.property === 'og:image').attrs.content, 'https://www.cratis.io/og/chronicle.png');
    });

    it('commits ten PNGs, each 1200 by 630', async () => {
        assert.equal(Object.keys(socialImageSections).length, 10);
        for (const section of Object.keys(socialImageSections)) {
            const image = await readFile(new URL(`../public/og/${section}.png`, import.meta.url));
            assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
            assert.equal(image.readUInt32BE(16), 1200, section);
            assert.equal(image.readUInt32BE(20), 630, section);
        }
    });
});
