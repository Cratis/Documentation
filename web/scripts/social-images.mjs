// Product mounts come from sync-content.mjs. Language clients live below their
// product (e.g. chronicle/go), so they deliberately share its card. Related
// tool/AI routes share a card too, keeping the static set to ten images.
export const socialImageSections = {
    chronicle: 'Chronicle',
    arc: 'Arc',
    components: 'Components',
    fundamentals: 'Fundamentals',
    screenplay: 'Screenplay',
    prologue: 'Prologue',
    authproxy: 'AuthProxy',
    prompter: 'Prompter',
    ai: 'AI',
    tools: 'Tools',
};

const routeSections = {
    ...Object.fromEntries(Object.keys(socialImageSections).map((key) => [key, key])),
    'chronicle-mcp': 'chronicle',
    'eventmodelers-ai': 'ai',
    cli: 'tools',
    templates: 'tools',
};

const routeLabels = { 'chronicle-mcp': 'Chronicle MCP', 'eventmodelers-ai': 'AI', cli: 'CLI', templates: 'Templates' };
const imageTags = new Set(['og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:image', 'twitter:image:alt']);

export function socialPreview(pathname) {
    const first = pathname.replace(/^\/+/, '').split('/')[0];
    const section = Object.hasOwn(routeSections, first) ? routeSections[first] : undefined;
    const label = Object.hasOwn(routeLabels, first) ? routeLabels[first] : socialImageSections[section];
    return {
        url: `https://www.cratis.io/${section ? `og/${section}.png` : 'og-image.jpg'}`,
        alt: label ? `Cratis ${label} documentation` : 'Cratis documentation',
        width: 1200,
        height: 630,
    };
}

// Replace rather than append: page-level head entries must not leave duplicate
// images behind, and the first og:image is what many social crawlers select.
export function withSocialPreview(head, pathname) {
    const { url, alt, width, height } = socialPreview(pathname);
    return [
        ...head.filter(({ tag, attrs }) => !(tag === 'meta' && imageTags.has(attrs?.property ?? attrs?.name))),
        { tag: 'meta', attrs: { property: 'og:image', content: url } },
        { tag: 'meta', attrs: { property: 'og:image:width', content: String(width) } },
        { tag: 'meta', attrs: { property: 'og:image:height', content: String(height) } },
        { tag: 'meta', attrs: { property: 'og:image:alt', content: alt } },
        { tag: 'meta', attrs: { name: 'twitter:image', content: url } },
        { tag: 'meta', attrs: { name: 'twitter:image:alt', content: alt } },
    ];
}
