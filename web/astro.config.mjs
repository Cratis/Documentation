// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import remarkGfm from 'remark-gfm';
import { remarkMermaidPrerender, closeBrowser } from './scripts/mermaid-prerender.mjs';
import starlightScrollToTop from 'starlight-scroll-to-top';
import starlightImageZoom from 'starlight-image-zoom';
import starlightSidebarTopics from 'starlight-sidebar-topics';

// One topic per allowlisted product, generated from public-surface.json by
// sync-public-content.mjs. Production fails closed when this projection is missing.
/** @typedef {{ id?: string, label: string, link?: string, icon?: string, items: any[] }} ProductTopic */
/** @type {ProductTopic[]} */
let productTopics;
try {
    productTopics = JSON.parse(readFileSync(new URL('./src/generated/topics.json', import.meta.url), 'utf8'));
} catch (error) {
    throw new Error(`Approved public topics are missing. Run npm run sync before Astro: ${error}`);
}

const overviewTopic = {
    id: 'overview',
    label: 'Documentation',
    link: '/',
    icon: 'open-book',
    items: [],
};

const topics = [overviewTopic, ...productTopics];

// https://astro.build/config
export default defineConfig({
    site: 'https://cratis.io',
    publicDir: './.public-approved',
    // NOTE: if the site is served under cratis.io/docs, set `base: '/docs'`.
    // GFM tables render in plain `.md`, but astro-mermaid injects plugins via the
    // (now-deprecated) `markdown.remarkPlugins` path, which leaves MDX's own `gfm`
    // flag falsy — so tables silently vanished from every `.mdx` page (front door,
    // why-cratis, …). Adding remark-gfm here makes it part of the inherited plugin
    // set that `@astrojs/mdx` re-applies (extendMarkdownConfig), restoring tables.
    markdown: {
        // remarkMermaidPrerender renders ```mermaid and ```eventmodeling to SVG
        // at build time (before astro-mermaid's plugin sees it); Mermaid blocks it
        // can't render fall through to astro-mermaid's client-side rendering.
        remarkPlugins: [remarkGfm, remarkMermaidPrerender],
    },
    integrations: [
        // Shut down the build-time Mermaid Chrome instance when the build ends.
        {
            name: 'mermaid-prerender-cleanup',
            hooks: { 'astro:build:done': async () => { await closeBrowser(); } },
        },
        // astro-mermaid transforms ```mermaid code fences into rendered diagrams.
        // Must run before Starlight so Expressive Code does not claim the fences.
        mermaid({
            theme: 'default',
            // autoTheme MUST stay off: its theme-change observer strips
            // data-processed from every pre.mermaid and re-renders client-side,
            // which would clobber the build-time pre-rendered SVGs. Light/dark is
            // handled entirely by cratis.css (the SVG colors come from CSS vars
            // that flip with the theme), so the JS re-render isn't needed.
            autoTheme: false,
            // Only used for the rare diagram the build-time renderer can't handle
            // (it falls through to client-side). Match the build-time config so a
            // fallback looks the same; colors are themed via CSS on the SVG.
            mermaidConfig: {
                fontFamily: "'Inter Variable', Inter, system-ui, -apple-system, sans-serif",
                flowchart: { padding: 14, nodeSpacing: 55, rankSpacing: 60, useMaxWidth: true },
            },
        }),
        starlight({
            title: 'Cratis',
            // Disable the generated machine index until public routes are controlled
            // by an explicit Approved-claim allowlist.
            pagefind: false,
            description:
                'Canonical technical documentation for Chronicle, Arc, Components, and the Cratis CLI.',
            logo: {
                light: './src/assets/cratis-mark-light.svg',
                dark: './src/assets/cratis-mark-dark.svg',
                alt: 'Cratis',
            },
            // Preload the brand fonts (see the component) so a cold load doesn't
            // paint in a fallback and then reflow when the web font swaps in.
            components: {
                Head: './src/components/Head.astro',
            },
            favicon: '/favicon.ico',
            customCss: [
                // Brand fonts are declared in src/components/Head.astro with
                // `font-display: optional` (not @fontsource's `swap`) to avoid
                // the cold-load font-swap reflow. cratis.css points
                // --sl-font / --sl-font-mono at them.
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
                        gitignore: 'text', flow: 'text', screenplay: 'text',
                    },
                },
            },
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/cratis' },
                { icon: 'discord', label: 'Discord', href: 'https://discord.gg/kt4AMpV8WV' },
                { icon: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@CratisStack' },
            ],
            plugins: [
                // Product icon rail + per-product sidebar (the aspire.dev "topics" look).
                starlightSidebarTopics(topics, {
                    // The splash homepage and 404 belong to no product.
                    exclude: ['/', '/404'],
                    topics: {
                        chronicle: ['/chronicle', '/chronicle/architecture', '/chronicle/workbench'],
                        arc: ['/arc'],
                        components: ['/components'],
                        cli: ['/cli'],
                    },
                }),
                // Floating "back to top" button (also on the splash homepage).
                starlightScrollToTop({ showTooltip: true, showOnHomepage: true }),
                // Click-to-zoom for screenshots and diagrams.
                starlightImageZoom(),
            ],
        }),
    ],
});
