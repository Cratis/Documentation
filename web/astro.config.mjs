// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import starlightLlmsTxt from 'starlight-llms-txt';

// Sidebar is generated from each product's toc.yml by scripts/sync-content.mjs.
// Fall back to autogenerate if it hasn't run yet.
let sidebar;
try {
    sidebar = JSON.parse(readFileSync(new URL('./src/generated/sidebar.json', import.meta.url), 'utf8'));
} catch {
    sidebar = [
        { label: 'Chronicle', items: [{ autogenerate: { directory: 'chronicle' } }] },
        { label: 'Arc', items: [{ autogenerate: { directory: 'arc' } }] },
        { label: 'Components', items: [{ autogenerate: { directory: 'components' } }] },
    ];
}

// Site-level pages (hand-authored in web/, not generated from a product) go at the top.
sidebar.unshift(
    { label: 'Why Cratis', slug: 'why-cratis' },
    { label: 'Build a full-stack feature', slug: 'build-a-full-app' },
    { label: 'Samples', slug: 'samples' },
    {
        label: 'Compare & migrate',
        collapsed: true,
        items: [
            { label: 'How Cratis compares', slug: 'comparisons' },
            { label: 'From Marten', slug: 'comparisons/marten' },
            { label: 'From Wolverine', slug: 'comparisons/wolverine' },
            { label: 'From Kurrent / EventStoreDB', slug: 'comparisons/kurrent' },
        ],
    },
    { label: 'API reference', slug: 'api-reference' },
);

// https://astro.build/config
export default defineConfig({
    site: 'https://cratis.io',
    // NOTE: if the site is served under cratis.io/docs at cutover, set `base: '/docs'`.
    integrations: [
        // astro-mermaid transforms ```mermaid code fences into rendered diagrams.
        // Must run before Starlight so Expressive Code does not claim the fences.
        mermaid({
            theme: 'default',
            autoTheme: true, // follow Starlight light/dark
        }),
        starlight({
            title: 'Cratis',
            description:
                'Build event-sourced applications with Chronicle, Arc, and Components — the full-stack, type-safe Cratis platform.',
            logo: {
                light: './src/assets/cratis-mark-light.svg',
                dark: './src/assets/cratis-mark-dark.svg',
                alt: 'Cratis',
            },
            favicon: '/favicon.ico',
            customCss: ['./src/styles/cratis.css'],
            // Keep the right "On this page" list short — top-level sections only.
            tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
            // Map DocFX-era custom code-fence languages to plain text so they don't warn.
            expressiveCode: {
                shiki: {
                    langAlias: {
                        env: 'ini', pdl: 'text', ebnf: 'text', pql: 'text',
                        gitignore: 'text', flow: 'text',
                    },
                },
            },
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/cratis' },
                { icon: 'discord', label: 'Discord', href: 'https://discord.gg/kt4AMpV8WV' },
                { icon: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@CratisStack' },
            ],
            editLink: {
                // Per-product content is symlinked from product repos; refine at cutover.
                baseUrl: 'https://github.com/cratis/Documentation/edit/docs-overhaul/web/',
            },
            plugins: [
                // Generates /llms.txt and /llms-full.txt so AI assistants can ground answers.
                starlightLlmsTxt(),
            ],
            sidebar,
        }),
    ],
});
