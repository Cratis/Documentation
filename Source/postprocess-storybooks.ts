import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface StorybookConfig {
    path: string;
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
                    item.items = titleStories.map(story => ({
                        name: story.name,
                        href: `${storybookPageHref}?story=${encodeURIComponent(story.id)}`
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
                
                // If this item has only one child and they have the same name,
                // and the child has sub-items (stories or more hierarchy), collapse them
                if (item.items.length === 1 && 
                    item.name === item.items[0].name && 
                    item.items[0].items) {
                    return item.items[0];
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
    
    return collapseRedundantNodes(topLevel);
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

    const REPO_ROOT = path.resolve(SOURCE_DIR, '..');

    // Create a .gitignore in _site to allow storybook-static files in the artifact upload
    // The root .gitignore excludes **/storybook-static/ but we need them in the published site
    const siteGitignorePath = path.join(SITE_OUTPUT, '.gitignore');
    fs.writeFileSync(siteGitignorePath, '!**/storybook-static/\n', 'utf-8');
    console.log('Created .gitignore in _site to allow storybook-static files');

    // Find all markdown files in current directory
    let markdownFiles = await glob('**/*.md', {
        cwd: SOURCE_DIR,
        ignore: ['**/node_modules/**', '**/_site/**', '**/obj/**', '**/bin/**', '**/.yarn/**'],
        absolute: true,
        follow: true
    });

    // Also explicitly search in submodule documentation directories (to handle symlink issues in CI)
    const submoduleDirs = ['Arc', 'Chronicle', 'Fundamentals'];
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
    const htmlPath = path.join(SITE_OUTPUT, htmlRelativePath);

    if (!fs.existsSync(htmlPath)) {
        console.warn(`HTML file not found: ${htmlPath}`);
        return;
    }

    // Calculate the relative path from the HTML file to the storybook build
    const storybookPath = frontMatter.storybook.path;
    const resolvedStorybookPath = resolveStorybookPath(storybookPath, mdFilePath);
    const storybookBuildPath = path.join(resolvedStorybookPath, 'storybook-static');

    // Parse Storybook index and update TOC
    const storybookIndex = parseStorybookIndex(resolvedStorybookPath);
    if (storybookIndex) {
        // Find the TOC file in the same directory as the markdown file
        const mdDir = path.dirname(mdFilePath);
        const tocPath = path.join(mdDir, 'toc.yml');
        
        // Generate story hierarchy for TOC
        const storybookPageHref = path.basename(mdFilePath);
        const storybookItems = buildTocFromStorybook(storybookIndex, storybookPageHref);
        
        // Update the TOC with story hierarchy
        updateTocWithStorybook(tocPath, 'Storybook', storybookItems);
    }

    // Calculate relative path from HTML to storybook-static in the _site directory
    // DocFX copies resources maintaining their structure from the source
    const htmlDir = path.dirname(htmlPath);
    
    // Determine where the storybook-static will be in _site
    let storybookSitePath: string;
    const parts = mdRelativePath.split(path.sep);
    
    // Check if from a submodule (docs/SubmoduleName/...)
    if (parts.length >= 2 && parts[0] === 'docs' && parts[1] !== 'Documentation') {
        // From submodule: DocFX copies from ../SubmoduleName to _site/
        // So Source/JavaScript/Arc.React/storybook-static becomes _site/Source/JavaScript/Arc.React/storybook-static
        const relativeToBuildPath = path.relative(path.join(SOURCE_DIR, '..', parts[1]), storybookBuildPath);
        storybookSitePath = path.join(SITE_OUTPUT, relativeToBuildPath);
    } else {
        // From this repo
        const relativeToBuildPath = path.relative(SOURCE_DIR, storybookBuildPath);
        storybookSitePath = path.join(SITE_OUTPUT, relativeToBuildPath);
    }
    
    const storybookRelativePath = path.relative(htmlDir, storybookSitePath).replace(/\\/g, '/');

    // Inject the iframe into the HTML
    injectStorybookIframe(htmlPath, storybookRelativePath);
}

function resolveStorybookPath(storybookPath: string, markdownFile: string): string {
    if (storybookPath.startsWith('/')) {
        // Absolute path - infer repository from markdown file location
        const relativePath = path.relative(SOURCE_DIR, markdownFile);
        const parts = relativePath.split(path.sep);
        
        // Check if file is in a docs subfolder (docs/SubmoduleName/...)
        // This indicates it's from a different repository/submodule
        const repoRoot = path.resolve(SOURCE_DIR, '..');
        if (parts.length >= 2 && parts[0] === 'docs') {
            const submoduleName = parts[1];
            // Skip 'Documentation' folder as it's part of this repo
            if (submoduleName !== 'Documentation') {
                return path.join(repoRoot, submoduleName, storybookPath.substring(1));
            }
        }
        
        // Default: resolve from repository root
        return path.join(repoRoot, storybookPath.substring(1));
    } else {
        // Relative path from markdown file
        const markdownDir = path.dirname(markdownFile);
        return path.resolve(markdownDir, storybookPath);
    }
}

function injectStorybookIframe(htmlPath: string, storybookRelativePath: string) {
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // Use iframe.html for embedded view without navigation
    // This provides the story view without the Storybook sidebar
    const iframeSrc = `${storybookRelativePath}/iframe.html?viewMode=story`;

    // Create the iframe HTML with theme synchronization and story navigation script
    const iframeHtml = `
<div class="storybook-container">
    <iframe id="storybook-iframe" src="${iframeSrc}" title="Storybook"></iframe>
</div>
<script>
(function() {
    const iframe = document.getElementById('storybook-iframe');
    
    // Function to sync theme to Storybook
    function syncTheme() {
        const isDark = document.documentElement.getAttribute('data-bs-theme') === 'dark';
        const theme = isDark ? 'dark' : 'light';
        
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'STORYBOOK_THEME_CHANGE',
                theme: theme
            }, '*');
        }
    }
    
    // Handle story navigation from URL parameters
    function navigateToStory() {
        const urlParams = new URLSearchParams(window.location.search);
        const storyId = urlParams.get('story');
        
        if (storyId && iframe) {
            // Use iframe.html with the story id parameter
            const baseUrl = '${storybookRelativePath}/iframe.html';
            iframe.src = baseUrl + '?id=' + encodeURIComponent(storyId) + '&viewMode=story';
        }
    }
    
    // Sync theme when iframe loads
    iframe.addEventListener('load', function() {
        setTimeout(syncTheme, 100);
    });
    
    // Watch for theme changes on the document
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-bs-theme') {
                syncTheme();
            }
        });
    });
    
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-bs-theme']
    });
    
    // Initial sync
    syncTheme();
    
    // Navigate to story if specified in URL
    navigateToStory();
})();
</script>`;

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
