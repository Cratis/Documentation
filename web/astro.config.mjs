// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import remarkGfm from 'remark-gfm';
import starlightLlmsTxt from 'starlight-llms-txt';
import starlightPageActions from 'starlight-page-actions';
import starlightScrollToTop from 'starlight-scroll-to-top';
import starlightImageZoom from 'starlight-image-zoom';
import starlightSidebarTopics from 'starlight-sidebar-topics';

// One topic per product, generated from each product's toc.yml by
// scripts/sync-content.mjs. starlight-sidebar-topics renders these as an icon
// rail at the top of the sidebar (the aspire.dev pattern).
let productTopics;
try {
    productTopics = JSON.parse(readFileSync(new URL('./src/generated/topics.json', import.meta.url), 'utf8'));
} catch {
    productTopics = [
        { label: 'Chronicle', link: 'chronicle', icon: 'seti:db', items: [{ autogenerate: { directory: 'chronicle' } }] },
        { label: 'Arc', link: 'arc', icon: 'puzzle', items: [{ autogenerate: { directory: 'arc' } }] },
        { label: 'Components', link: 'components', icon: 'laptop', items: [{ autogenerate: { directory: 'components' } }] },
    ];
}

// The first topic gathers the site-level, cross-product pages (hand-authored in
// web/, not owned by any product): the "why", the capstone, samples, comparisons.
const overviewTopic = {
    id: 'overview',
    label: 'Cratis Stack',
    link: 'cratis-stack',
    icon: 'open-book',
    items: [
        { label: 'The Cratis Stack', slug: 'cratis-stack' },
        { label: 'Why Cratis', slug: 'why-cratis' },
        { label: 'Adopting Cratis', slug: 'adopting-cratis' },
        { label: 'AI-native development', slug: 'ai-native-development' },
        { label: 'Studio', slug: 'studio', badge: { text: 'Soon', variant: 'tip' } },
        { label: 'Build a full-stack feature', slug: 'build-a-full-app' },
        { label: 'Samples', slug: 'samples' },
        { label: 'Glossary', slug: 'glossary' },
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
    ],
};

const topics = [overviewTopic, ...productTopics];

// https://astro.build/config
export default defineConfig({
    site: 'https://cratis.io',
    // NOTE: if the site is served under cratis.io/docs at cutover, set `base: '/docs'`.
    // GFM tables render in plain `.md`, but astro-mermaid injects plugins via the
    // (now-deprecated) `markdown.remarkPlugins` path, which leaves MDX's own `gfm`
    // flag falsy — so tables silently vanished from every `.mdx` page (front door,
    // why-cratis, …). Adding remark-gfm here makes it part of the inherited plugin
    // set that `@astrojs/mdx` re-applies (extendMarkdownConfig), restoring tables.
    markdown: {
        remarkPlugins: [remarkGfm],
    },
    integrations: [
        // astro-mermaid transforms ```mermaid code fences into rendered diagrams.
        // Must run before Starlight so Expressive Code does not claim the fences.
        mermaid({
            theme: 'default',
            autoTheme: true, // follow Starlight light/dark
            // Render with the brand font so Mermaid measures node boxes with the
            // same font we display — otherwise labels get clipped. Colors are
            // themed via CSS on the rendered SVG (see cratis.css "Mermaid").
            mermaidConfig: {
                fontFamily: "'Inter Variable', Inter, system-ui, -apple-system, sans-serif",
                flowchart: { padding: 14, nodeSpacing: 55, rankSpacing: 60, useMaxWidth: true },
            },
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
            customCss: [
                // Self-hosted brand fonts (variable) — load before the theme so
                // cratis.css can point --sl-font / --sl-font-mono at them.
                '@fontsource-variable/inter/index.css',
                '@fontsource-variable/jetbrains-mono/index.css',
                './src/styles/cratis.css',
            ],
            // Keep the right "On this page" list short — top-level sections only.
            tableOfContents: { minHeadingLevel: 2, maxHeadingLevel: 2 },
            // Aspire-style code blocks: vivid dark + soft light theme, rounded frames.
            expressiveCode: {
                themes: ['laserwave', 'slack-ochin'],
                styleOverrides: { borderRadius: '0.5rem' },
                // Map DocFX-era custom code-fence languages to plain text so they don't warn.
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
                // Product icon rail + per-product sidebar (the aspire.dev "topics" look).
                starlightSidebarTopics(topics, {
                    // The splash homepage and 404 belong to no product.
                    exclude: ['/', '/404'],
                    // Section-landing pages appear in the nav as collapsible groups,
                    // not listed leaves, so map every page slug to its topic by glob.
                    topics: {
                        overview: ['/cratis-stack', '/why-cratis', '/adopting-cratis', '/ai-native-development', '/studio', '/build-a-full-app', '/samples', '/glossary', '/comparisons', '/comparisons/**', '/api-reference'],
                        chronicle: ['/chronicle', '/chronicle/**'],
                        arc: ['/arc', '/arc/**'],
                        components: ['/components', '/components/**'],
                        cli: ['/cli', '/cli/**'],
                        fundamentals: ['/fundamentals', '/fundamentals/**'],
                        contributing: ['/contributing', '/contributing/**'],
                    },
                }),
                // Per-page action row: Copy Markdown + Open in AI assistant + Share.
                starlightPageActions(),
                // Floating "back to top" button (also on the splash homepage).
                starlightScrollToTop({ showTooltip: true, showOnHomepage: true }),
                // Click-to-zoom for screenshots and diagrams.
                starlightImageZoom(),
                // Generates /llms.txt and /llms-full.txt so AI assistants can ground answers.
                starlightLlmsTxt(),
            ],
        }),
    ],
});
