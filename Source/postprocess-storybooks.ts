import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StorybookConfig {
    path: string;
    story?: string;
}

interface FrontMatter {
    storybook?: StorybookConfig;
    [key: string]: any;
}

interface StorybookEntry {
    type: string;
    id: string;
    name: string;
    title: string;
    importPath: string;
    componentPath: string;
    tags: string[];
}

interface StorybookIndex {
    v: number;
    entries: Record<string, StorybookEntry>;
}

interface TocItem {
    name: string;
    href?: string;
    items?: TocItem[];
}

const SOURCE_DIR = __dirname;
const SITE_OUTPUT = path.join(SOURCE_DIR, '_site');
const REPO_ROOT = path.resolve(SOURCE_DIR, '..');

function parseStorybookIndex(storybookPath: string): StorybookIndex | null {
    const indexPath = path.join(storybookPath, 'storybook-static', 'index.json');
    
    if (!fs.existsSync(indexPath)) {
        return null;
    }
    
    try {
        const content = fs.readFileSync(indexPath, 'utf-8');
        return JSON.parse(content) as StorybookIndex;
    } catch (error) {
        console.warn(`Failed to parse ${indexPath}:`, error);
        return null;
    }
}

function findFirstStoryInHierarchy(item: TocItem): string | null {
    if (item.href && item.href.startsWith('stories/')) {
        return item.href;
    }
    if (item.items) {
        for (const child of item.items) {
            const found = findFirstStoryInHierarchy(child);
            if (found) return found;
        }
    }
    return null;
}

function buildTocFromStorybook(storybookIndex: StorybookIndex, storybookPageHref: string): TocItem[] {
    const stories = Object.values(storybookIndex.entries).filter(entry => entry.type === 'story');
    
    // Build a hierarchical structure from story titles
    const hierarchy: Map<string, TocItem> = new Map();
    const storyGroups: Map<string, StorybookEntry[]> = new Map();
    
    // Group stories by their title (component path)
    for (const story of stories) {
        if (!storyGroups.has(story.title)) {
            storyGroups.set(story.title, []);
        }
        storyGroups.get(story.title)!.push(story);
    }
    
    // Build hierarchy from unique titles
    for (const [title, titleStories] of storyGroups.entries()) {
        const parts = title.split('/');
        
        // Build the path through the hierarchy
        let currentPath = '';
        for (let i = 0; i < parts.length; i++) {
            const part = parts[i];
            const parentPath = currentPath;
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            
            if (!hierarchy.has(currentPath)) {
                const item: TocItem = { name: part };
                
                // If this is the last part, add story links as children
                if (i === parts.length - 1) {
                    // Set href BEFORE items to ensure correct YAML property order
                    if (titleStories.length > 0) {
                        item.href = `stories/${titleStories[0].id}.md`;
                    }
                    item.items = titleStories.map(story => ({
                        name: story.name,
                        href: `stories/${story.id}.md`
                    }));
                }
                
                hierarchy.set(currentPath, item);
                
                // Add to parent if exists
                if (parentPath && hierarchy.has(parentPath)) {
                    const parent = hierarchy.get(parentPath)!;
                    if (!parent.items) {
                        parent.items = [];
                    }
                    parent.items.push(item);
                }
            }
        }
    }
    
    // Helper function to collapse redundant single-child nodes
    function collapseRedundantNodes(items: TocItem[]): TocItem[] {
        return items.map(item => {
            if (item.items && item.items.length > 0) {
                // Recursively process children first
                item.items = collapseRedundantNodes(item.items);
                
                // If this item has only one child without an href, collapse them
                // This removes intermediate grouping nodes that add unnecessary depth
                if (item.items.length === 1 && !item.href && item.items[0].items) {
                    const child = item.items[0];
                    // Use the child's name and inherit the child's items/href
                    item.name = child.name;
                    item.items = child.items;
                    if (child.href) {
                        item.href = child.href;
                    }
                }
                
                // After collapsing, ensure intermediate nodes have hrefs to first story
                if (!item.href && item.items && item.items.length > 0) {
                    const firstHref = findFirstStoryInHierarchy(item);
                    if (firstHref) {
                        item.href = firstHref;
                    }
                }
            }
            return item;
        });
    }
    
    // Return only the top-level items, with redundant nodes collapsed
    const topLevel: TocItem[] = [];
    for (const [path, item] of hierarchy.entries()) {
        if (!path.includes('/')) {
            topLevel.push(item);
        }
    }
    
    const collapsed = collapseRedundantNodes(topLevel);
    
    // Ensure all parent nodes have hrefs to their first child story
    for (const item of collapsed) {
        if (!item.href && item.items) {
            const firstHref = findFirstStoryInHierarchy(item);
            if (firstHref) {
                item.href = firstHref;
            }
        }
    }
    
    return collapsed;
}

function findFirstStoryHref(items: TocItem[]): string | null {
    for (const item of items) {
        // If this item has an href to a story page, return it
        if (item.href && item.href.startsWith('stories/')) {
            return item.href;
        }
        // Otherwise, recursively search children
        if (item.items) {
            const childHref = findFirstStoryHref(item.items);
            if (childHref) {
                return childHref;
            }
        }
    }
    return null;
}

function updateTocWithStorybook(tocPath: string, storybookPageName: string, storybookItems: TocItem[]) {
    if (!fs.existsSync(tocPath)) {
        console.warn(`TOC file not found: ${tocPath}`);
        return;
    }
    
    try {
        const content = fs.readFileSync(tocPath, 'utf-8');
        const toc = yaml.load(content) as TocItem[];
        
        // Find the storybook page entry
        const storybookIndex = toc.findIndex(item => 
            item.name === storybookPageName || 
            (item.href && item.href.includes('storybook.md'))
        );
        
        if (storybookIndex === -1) {
            console.warn(`Could not find Storybook page in TOC: ${tocPath}`);
            return;
        }
        
        // Find the first story to link to
        const firstStoryHref = findFirstStoryHref(storybookItems);
        
        // Update the Storybook page to link to the first story (avoid "No Preview")
        if (firstStoryHref) {
            toc[storybookIndex].href = firstStoryHref;
        }
        
        // Add the storybook items as children
        toc[storybookIndex].items = storybookItems;
        
        // Write back the TOC
        const updatedContent = yaml.dump(toc, { lineWidth: -1, noRefs: true });
        fs.writeFileSync(tocPath, updatedContent, 'utf-8');
        
        console.log(`Updated TOC at ${tocPath} with Storybook hierarchy`);
    } catch (error) {
        console.warn(`Failed to update TOC at ${tocPath}:`, error);
    }
}


async function main() {
    console.log('Post-processing Storybook pages...');

    // Create a .gitignore in _site to allow storybook-static files in the artifact upload
    // The root .gitignore excludes **/storybook-static/ but we need them in the published site
    const siteGitignorePath = path.join(SITE_OUTPUT, '.gitignore');
    fs.writeFileSync(siteGitignorePath, '!**/storybook-static/\n', 'utf-8');
    console.log('Created .gitignore in _site to allow storybook-static files');

    // Ensure storybook-static files from submodules are copied to _site if docfx didn't copy them
    // This happens when storybook files are built after docfx runs
    const submoduleDirs = ['Arc', 'Chronicle', 'Fundamentals', 'Components'];
    for (const submodule of submoduleDirs) {
        const submoduleSourcePath = path.join(REPO_ROOT, submodule, 'Source');
        const submoduleStorybookPath = path.join(submoduleSourcePath, 'storybook-static');
        const submoduleSitePath = path.join(SITE_OUTPUT, submodule, 'Source', 'storybook-static');

        if (fs.existsSync(submoduleStorybookPath) && !fs.existsSync(submoduleSitePath)) {
            console.log(`Copying storybook-static from ${submodule} to _site...`);
            // Create parent directories
            fs.mkdirSync(path.dirname(submoduleSitePath), { recursive: true });
            // Copy storybook files
            execSync(`cp -r "${submoduleStorybookPath}" "${submoduleSitePath}"`, { stdio: 'inherit' });
            console.log(`Copied storybook-static from ${submodule}`);
        }
    }

    // Find all markdown files in current directory
    let markdownFiles = await glob('**/*.md', {
        cwd: SOURCE_DIR,
        ignore: ['**/node_modules/**', '**/_site/**', '**/obj/**', '**/bin/**', '**/.yarn/**'],
        absolute: true,
        follow: true
    });

    // Also explicitly search in submodule documentation directories (to handle symlink issues in CI)
    for (const submodule of submoduleDirs) {
        const submodulePath = path.join(REPO_ROOT, submodule, 'Documentation');
        if (fs.existsSync(submodulePath)) {
            const submoduleFiles = await glob('**/*.md', {
                cwd: submodulePath,
                ignore: ['**/node_modules/**', '**/.yarn/**'],
                absolute: true,
                follow: true
            });
            markdownFiles.push(...submoduleFiles);
        }
    }

    // Deduplicate files by resolving real paths (handles symlinks)
    const uniqueFiles = new Map<string, string>();
    for (const file of markdownFiles) {
        const realPath = fs.realpathSync(file);
        if (!uniqueFiles.has(realPath)) {
            uniqueFiles.set(realPath, file);
        }
    }

    for (const mdFile of uniqueFiles.values()) {
        await processMarkdownFile(mdFile);
    }

    console.log('Post-processing complete!');
}

async function processMarkdownFile(mdFilePath: string) {
    const content = fs.readFileSync(mdFilePath, 'utf-8');

    // Parse front matter
    const frontMatterMatch = content.match(/^---\s*\n(.*?)\n---\s*\n/s);
    if (!frontMatterMatch) {
        return;
    }

    let frontMatter: FrontMatter;
    try {
        frontMatter = yaml.load(frontMatterMatch[1]) as FrontMatter;
    } catch (error) {
        return;
    }

    if (!frontMatter.storybook?.path) {
        return;
    }

    console.log(`Found Storybook page: ${mdFilePath}`);

    // Calculate the corresponding HTML file in _site
    const mdRelativePath = path.relative(SOURCE_DIR, mdFilePath);
    const htmlRelativePath = mdRelativePath.replace(/\.md$/, '.html');
    let htmlPath = path.join(SITE_OUTPUT, htmlRelativePath);

    if (!fs.existsSync(htmlPath)) {
        // Fallback: when the file was discovered via direct submodule scan (not symlink),
        // the path relative to SOURCE_DIR is wrong (e.g. ../../Arc/Documentation/...). 
        // Try the DocFX output path via the Source/docs/<submodule> symlink structure instead.
        const subName = getSubmoduleName(mdFilePath);
        if (subName) {
            const subDocRoot = path.join(REPO_ROOT, subName, 'Documentation');
            const relFromDocRoot = path.relative(subDocRoot, mdFilePath);
            const fallbackHtmlPath = path.join(SITE_OUTPUT, 'docs', subName, relFromDocRoot.replace(/\.md$/, '.html'));
            if (fs.existsSync(fallbackHtmlPath)) {
                htmlPath = fallbackHtmlPath;
                console.log(`Using fallback HTML path: ${fallbackHtmlPath}`);
            } else {
                console.warn(`HTML file not found: ${htmlPath} or ${fallbackHtmlPath}`);
                return;
            }
        } else {
            console.warn(`HTML file not found: ${htmlPath}`);
            return;
        }
    }

    // Calculate the relative path from the HTML file to the storybook build
    const storybookPath = frontMatter.storybook.path;
    const resolvedStorybookPath = resolveStorybookPath(storybookPath, mdFilePath);
    const storybookBuildPath = path.join(resolvedStorybookPath, 'storybook-static');

    // Calculate relative path from HTML to storybook-static in the _site directory
    // DocFX copies resources maintaining their structure from the source
    const htmlDir = path.dirname(htmlPath);
    
    const submoduleName = getSubmoduleName(mdFilePath);
    const siteCandidates: string[] = [];

    if (submoduleName) {
        const submoduleRoot = path.join(REPO_ROOT, submoduleName);
        siteCandidates.push(path.join(SITE_OUTPUT, path.relative(submoduleRoot, storybookBuildPath)));
    }

    siteCandidates.push(path.join(SITE_OUTPUT, path.relative(REPO_ROOT, storybookBuildPath)));
    siteCandidates.push(path.join(SITE_OUTPUT, path.relative(SOURCE_DIR, storybookBuildPath)));

    const storybookSitePath = siteCandidates.find(candidate => fs.existsSync(candidate)) ?? siteCandidates[0];
    
    const storybookRelativePath = path.relative(htmlDir, storybookSitePath).replace(/\\/g, '/');

    // Inject the iframe into the HTML, passing the specific story ID if set
    const storyId = frontMatter.storybook.story;
    injectStorybookIframe(htmlPath, storybookRelativePath, storyId);
}

function getSubmoduleName(markdownFile: string): string | null {
    const repoRelativePath = path.relative(REPO_ROOT, markdownFile);
    const repoParts = repoRelativePath.split(path.sep);
    const knownSubmodules = ['Arc', 'Chronicle', 'Fundamentals', 'Components'];

    if (repoParts.length >= 2 && knownSubmodules.includes(repoParts[0])) {
        return repoParts[0];
    }

    const sourceRelativePath = path.relative(SOURCE_DIR, markdownFile);
    const sourceParts = sourceRelativePath.split(path.sep);
    if (sourceParts.length >= 2 && sourceParts[0] === 'docs' && sourceParts[1] !== 'Documentation') {
        return sourceParts[1];
    }

    return null;
}

function resolveStorybookPath(storybookPath: string, markdownFile: string): string {
    if (storybookPath.startsWith('/')) {
        const submoduleName = getSubmoduleName(markdownFile);

        if (submoduleName) {
            if (storybookPath.startsWith(`/${submoduleName}/`)) {
                return path.join(REPO_ROOT, storybookPath.substring(1));
            }
            return path.join(REPO_ROOT, submoduleName, storybookPath.substring(1));
        }

        return path.join(REPO_ROOT, storybookPath.substring(1));
    } else {
        // Relative path from markdown file
        const markdownDir = path.dirname(markdownFile);
        return path.resolve(markdownDir, storybookPath);
    }
}

function injectStorybookIframe(htmlPath: string, storybookRelativePath: string, storyId?: string) {
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // For story-specific pages, navigate directly to the story.
    // For the main storybook page, show the default view (navigation handled by URL params).
    const iframeSrc = storyId
        ? `${storybookRelativePath}/index.html?nav=false&panel=right&addonPanel=storybook/docs&path=/story/${encodeURIComponent(storyId)}`
        : `${storybookRelativePath}/index.html?nav=false&panel=right&addonPanel=storybook/docs`;

    // Theme-sync script shared by all storybook pages
    const themeSyncScript = `
(function() {
    const iframe = document.getElementById('storybook-iframe');

    function syncTheme() {
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const theme = isDark ? 'dark' : 'light';
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'STORYBOOK_THEME_CHANGE', theme: theme }, '*');
        }
    }

    iframe.addEventListener('load', function() {
        setTimeout(syncTheme, 100);
        setTimeout(function() {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    const codeTab = iframeDoc.getElementById('tabbutton-storybook-docs');
                    if (codeTab) { codeTab.click(); }
                }
            } catch (e) {}
        }, 500);
    });

    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-bs-theme') {
                syncTheme();
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
    syncTheme();
})();`;

    let iframeHtml: string;

    if (storyId) {
        // Story-specific page: iframe src is hardcoded to this story.
        // DocFX generates correct TOC active state and breadcrumb because each story
        // has its own unique URL — no JavaScript workarounds needed.
        iframeHtml = `
<div class="storybook-container">
    <iframe id="storybook-iframe" src="${iframeSrc}" title="Storybook"></iframe>
</div>
<script>
${themeSyncScript}
</script>`;
    } else {
        // Main storybook page: navigate based on ?story= URL parameter for
        // backward-compatibility with old links.
        iframeHtml = `
<div class="storybook-container">
    <iframe id="storybook-iframe" src="${iframeSrc}" title="Storybook"></iframe>
</div>
<script>
(function() {
    const iframe = document.getElementById('storybook-iframe');

    function syncTheme() {
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const theme = isDark ? 'dark' : 'light';
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({ type: 'STORYBOOK_THEME_CHANGE', theme: theme }, '*');
        }
    }

    function navigateToStory() {
        const urlParams = new URLSearchParams(window.location.search);
        const storyId = urlParams.get('story');
        if (storyId && iframe) {
            const baseUrl = '${storybookRelativePath}/index.html';
            iframe.src = baseUrl + '?nav=false&panel=right&addonPanel=storybook/docs&path=/story/' + encodeURIComponent(storyId);
        }
    }

    iframe.addEventListener('load', function() {
        setTimeout(syncTheme, 100);
        setTimeout(function() {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    const codeTab = iframeDoc.getElementById('tabbutton-storybook-docs');
                    if (codeTab) { codeTab.click(); }
                }
            } catch (e) {}
        }, 500);
    });

    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-bs-theme') {
                syncTheme();
            }
        });
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-bs-theme'] });
    syncTheme();
    navigateToStory();
})();
</script>`;
    }

    // Replace the article content with the iframe
    // Find the article tag and replace its content
    const articleRegex = /(<article[^>]*>)(.*?)(<\/article>)/s;
    const match = html.match(articleRegex);

    if (match) {
        // Keep the article tag but replace the content
        html = html.replace(articleRegex, `$1${iframeHtml}$3`);
        fs.writeFileSync(htmlPath, html, 'utf-8');
        console.log(`Injected Storybook iframe into ${htmlPath} with src: ${iframeSrc}`);
    } else {
        console.warn(`Could not find article tag in ${htmlPath}`);
    }
}

main().catch(console.error);
