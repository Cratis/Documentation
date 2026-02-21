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

function findFirstStoryInHierarchy(item: TocItem): string | null {
    if (item.href && item.href.includes('?story=')) {
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
                        item.href = `${storybookPageHref}?story=${encodeURIComponent(titleStories[0].id)}`;
                    }
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
        // If this item has an href (it's a leaf/story), return it
        if (item.href && item.href.includes('?story=')) {
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
    const submoduleDirs = ['Arc', 'Chronicle', 'Fundamentals', 'Components'];
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

    // Use index.html with nav=false to get full Storybook UI (toolbar + addon panels)
    // but without the sidebar navigation (which is handled by DocFX TOC instead)
    const iframeSrc = `${storybookRelativePath}/index.html?nav=false&panel=right&addonPanel=storybook/source-loader/panel`;

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
            // Use index.html with story path for full UI (toolbar + code panel)
            const baseUrl = '${storybookRelativePath}/index.html';
            iframe.src = baseUrl + '?nav=false&panel=right&addonPanel=storybook/source-loader/panel&path=/story/' + encodeURIComponent(storyId);
        } else {
            // No story specified - redirect to first story from TOC nav
            // Get the first child item with a story parameter from the navigation
            const firstStoryLink = document.querySelector('nav.toc a[href*="?story="]');
            if (firstStoryLink) {
                const linkHref = firstStoryLink.getAttribute('href');
                const storyMatch = linkHref.match(/[?&]story=([^&]+)/);
                if (storyMatch) {
                    const firstStoryId = decodeURIComponent(storyMatch[1]);
                    const baseUrl = '${storybookRelativePath}/index.html';
                    iframe.src = baseUrl + '?nav=false&panel=right&addonPanel=storybook/source-loader/panel&path=/story/' + encodeURIComponent(firstStoryId);
                }
            }
        }
    }
    
    // Sync theme when iframe loads and auto-select Code panel
    iframe.addEventListener('load', function() {
        setTimeout(syncTheme, 100);
        
        // Auto-select the Code tab in the Storybook addon panel
        // The selectedPanel config and URL param don't always work reliably
        // so we click the Code tab directly after load
        setTimeout(function() {
            try {
                const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                if (iframeDoc) {
                    const codeTab = iframeDoc.getElementById('tabbutton-storybook-source-loader-panel');
                    if (codeTab) {
                        codeTab.click();
                    }
                }
            } catch (e) {
                // Cross-origin access may fail in some configurations
            }
        }, 500);
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
    
    // Navigate to story if specified in URL, or redirect to first story
    navigateToStory();
    
    // Fix breadcrumb: DocFX treats all TOC items pointing to storybook.html as matching
    // the current page, causing ALL stories to appear in the breadcrumb.
    // We fix this by rebuilding the breadcrumb from the TOC hierarchy.
    function fixBreadcrumb() {
        const breadcrumbNav = document.getElementById('breadcrumb');
        if (!breadcrumbNav) return;
        
        const urlParams = new URLSearchParams(window.location.search);
        const storyId = urlParams.get('story');
        
        // Find the deepest matching TOC link for the current story
        // (Don't break on first match - last match = deepest/most specific)
        let activeLink = null;
        if (storyId) {
            const tocLinks = document.querySelectorAll('#toc a[href*="?story="]');
            for (const link of tocLinks) {
                const href = link.getAttribute('href') || '';
                const match = href.match(/[?&]story=([^&]+)/);
                if (match && decodeURIComponent(match[1]) === storyId) {
                    activeLink = link; // Keep updating - last match is the leaf node
                }
            }
        }
        
        if (!activeLink) return;
        
        // Walk up the TOC DOM to collect the hierarchy path
        // Stop at the storybook root item (href to storybook.html without ?story=)
        const pathItems = [];
        let current = activeLink.closest('li');
        while (current) {
            const linkEl = current.querySelector(':scope > a');
            if (linkEl) {
                const text = linkEl.textContent.trim();
                const href = linkEl.getAttribute('href') || '';
                if (text) {
                    pathItems.unshift({ text, href });
                }
                // Stop at the storybook root node (has href to .html without ?story=)
                if (href && href.includes('.html') && !href.includes('?story=')) {
                    break;
                }
            }
            // Move to parent list item (li > ul > li structure)
            const parentUl = current.parentElement;
            if (parentUl && parentUl.tagName === 'UL') {
                current = parentUl.parentElement;
                if (!current || current.tagName !== 'LI') {
                    break;
                }
            } else {
                break;
            }
        }
        
        // Rebuild breadcrumb: keep ancestor items that don't relate to storybook,
        // then add the path from TOC walk (Storybook > Component > Story)
        const breadcrumbList = breadcrumbNav.querySelector('ol, ul');
        if (!breadcrumbList) return;
        
        const existingItems = breadcrumbList.querySelectorAll('li');
        let newHtml = '';
        
        for (const li of existingItems) {
            const link = li.querySelector('a');
            if (link) {
                const href = link.getAttribute('href') || '';
                // Stop at items that point to the storybook page
                if (href.includes('storybook.html') || href.includes('?story=')) break;
                // Keep ancestor items (Arc, Frontend, React with empty hrefs)
                newHtml += li.outerHTML;
            }
        }
        
        // Add storybook path from TOC hierarchy walk
        for (const item of pathItems) {
            if (item.href) {
                newHtml += '<li class="breadcrumb-item"><a href="' + item.href + '">' + item.text + '</a></li>';
            } else {
                newHtml += '<li class="breadcrumb-item">' + item.text + '</li>';
            }
        }
        
        breadcrumbList.innerHTML = newHtml;
    }
    
    // DocFX renders breadcrumb asynchronously, so wait for it
    const breadcrumbObserver = new MutationObserver(function() {
        const breadcrumbNav = document.getElementById('breadcrumb');
        if (breadcrumbNav && breadcrumbNav.children.length > 0) {
            breadcrumbObserver.disconnect();
            setTimeout(fixBreadcrumb, 50);
        }
    });
    
    const breadcrumbEl = document.getElementById('breadcrumb');
    if (breadcrumbEl) {
        if (breadcrumbEl.children.length > 0) {
            fixBreadcrumb();
        } else {
            breadcrumbObserver.observe(breadcrumbEl, { childList: true, subtree: true });
        }
    }
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
