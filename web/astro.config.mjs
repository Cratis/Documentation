// @ts-check
import { readFileSync } from 'node:fs';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import mermaid from 'astro-mermaid';
import remarkGfm from 'remark-gfm';
import { remarkMermaidPrerender, closeBrowser } from './scripts/mermaid-prerender.mjs';
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
// web/, not owned by any product): the "why", the capstone, samples, tools.
const overviewTopic = {
    id: 'overview',
    label: 'Cratis Stack',
    link: 'cratis-stack',
    icon: 'open-book',
    items: [
        { label: 'The Cratis Stack', slug: 'cratis-stack' },
        { label: 'Why developers choose Cratis', slug: 'why-cratis' },
        { label: 'Adopting Cratis', slug: 'adopting-cratis' },
        {
            label: 'Adopt and trust',
            items: [
                { label: 'Learning paths', slug: 'learning-paths' },
                { label: 'FAQ', slug: 'faq' },
                { label: 'Version compatibility', slug: 'compatibility' },
                { label: 'Production readiness', slug: 'production-readiness' },
                { label: 'Roadmap', slug: 'roadmap' },
                { label: 'Governance', slug: 'governance' },
                { label: 'Security', slug: 'security' },
                { label: 'Professional help', slug: 'professional-help' },
                { label: 'Community and help', slug: 'community' },
                { label: 'Feedback and suggestions', slug: 'feedback' },
            ],
        },
        {
            label: 'AI',
            items: [
                { label: 'AI-native development', slug: 'ai-native-development' },
                { label: 'Plugins', slug: 'plugins' },
                { label: 'Code analysis', slug: 'code-analysis' },
            ],
        },
        { label: 'Studio', slug: 'studio', badge: { text: 'Soon', variant: 'tip' } },
        { label: 'Event Modeling', slug: 'event-modeling' },
        {
            label: 'Testing',
            items: [
                { label: 'Testing with Cratis', slug: 'testing-with-cratis' },
                { label: 'Specifications', slug: 'specifications' },
            ],
        },
        {
            label: 'Tools',
            items: [
                { label: 'VS Code extension', slug: 'tools/vscode-extension' },
                { label: 'Lens', slug: 'tools/lens' },
            ],
        },
        { label: 'Auth and compliance', slug: 'auth-and-compliance' },
        {
            label: 'AuthProxy',
            items: [
                { label: 'Overview', slug: 'authproxy' },
                { label: 'Get started', slug: 'authproxy/get-started' },
                { label: 'Authentication', slug: 'authproxy/authentication' },
                { label: 'Identity', slug: 'authproxy/identity' },
                { label: 'Tenancy', slug: 'authproxy/tenancy' },
                { label: 'Invites and lobby', slug: 'authproxy/invites-and-lobby' },
            ],
        },
        { label: 'Build a full-stack feature', slug: 'build-a-full-app' },
        { label: 'Samples', slug: 'samples' },
        { label: 'Showcase and architectures', slug: 'showcase' },
        { label: "What's new", slug: 'whats-new' },
        { label: 'Glossary', slug: 'glossary' },
        { label: 'API reference', slug: 'api-reference' },
    ],
};

const topics = [overviewTopic, ...productTopics];

// https://astro.build/config
export default defineConfig({
    site: 'https://cratis.io',
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
            description:
                'Build event-sourced applications with Chronicle, Arc, and Components — the full-stack, type-safe Cratis platform.',
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
                // Per-product content is generated from product repos; site-level pages live here.
                baseUrl: 'https://github.com/cratis/Documentation/edit/main/web/',
            },
            plugins: [
                // Product icon rail + per-product sidebar (the aspire.dev "topics" look).
                starlightSidebarTopics(topics, {
                    // The splash homepage and 404 belong to no product.
                    exclude: ['/', '/404'],
                    // Section-landing pages appear in the nav as collapsible groups,
                    // not listed leaves, so map every page slug to its topic by glob.
                    topics: {
                        overview: ['/cratis-stack', '/why-cratis', '/adopting-cratis', '/learning-paths', '/faq', '/compatibility', '/production-readiness', '/roadmap', '/governance', '/security', '/professional-help', '/community', '/feedback', '/ai-native-development', '/plugins', '/code-analysis', '/studio', '/event-modeling', '/testing-with-cratis', '/specifications', '/tools', '/tools/**', '/auth-and-compliance', '/authproxy', '/authproxy/**', '/build-a-full-app', '/samples', '/showcase', '/whats-new', '/glossary', '/api-reference'],
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
