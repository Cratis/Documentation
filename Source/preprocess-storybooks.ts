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
                    // Set href to first story
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
                
                // If this item has only one child, collapse them
                // This removes intermediate grouping nodes that add unnecessary depth
                if (item.items.length === 1) {
                    const child = item.items[0];
                    // If parent and child have the same name, collapse
                    if (item.name === child.name || !item.href) {
                        item.name = child.name;
                        item.items = child.items;
                        if (child.href) {
                            item.href = child.href;
                        }
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

function resolveStorybookPath(storybookPath: string, markdownFile: string): string {
    const REPO_ROOT = path.resolve(SOURCE_DIR, '..');
    
    if (storybookPath.startsWith('/')) {
        // Absolute path - need to determine which submodule this belongs to
        // markdownFile is like: /Volumes/Code/Cratis/Documentation/Arc/Documentation/frontend/react/storybook.md
        // Extract the submodule name from the path
        const relativePath = path.relative(REPO_ROOT, markdownFile);
        const parts = relativePath.split(path.sep);
        
        if (parts.length >= 2) {
            const submoduleName = parts[0]; // e.g., "Arc", "Chronicle", "Fundamentals", "Components"
            
            // Check if this is a known submodule (not "Source" or "GitHubLanding" etc.)
            const knownSubmodules = ['Arc', 'Chronicle', 'Fundamentals', 'Components'];
            if (knownSubmodules.includes(submoduleName)) {
                // Resolve the path within the submodule
                return path.join(REPO_ROOT, submoduleName, storybookPath.substring(1));
            }
        }
        
        // Fallback: resolve from repository root
        return path.join(REPO_ROOT, storybookPath.substring(1));
    } else {
        // Relative path from markdown file
        const markdownDir = path.dirname(markdownFile);
        return path.resolve(markdownDir, storybookPath);
    }
}

async function main() {
    console.log('Pre-processing Storybook TOCs...');

    const REPO_ROOT = path.resolve(SOURCE_DIR, '..');

    // Find all storybook.md files in submodule documentation directories
    const submoduleDirs = ['Arc', 'Chronicle', 'Fundamentals', 'Components'];
    const markdownFiles: string[] = [];

    for (const submodule of submoduleDirs) {
        const submodulePath = path.join(REPO_ROOT, submodule, 'Documentation');
        if (fs.existsSync(submodulePath)) {
            const submoduleFiles = await glob('**/storybook.md', {
                cwd: submodulePath,
                ignore: ['**/node_modules/**', '**/.yarn/**'],
                absolute: true,
                follow: true
            });
            markdownFiles.push(...submoduleFiles);
        }
    }

    console.log(`Found ${markdownFiles.length} storybook.md file(s)`);

    for (const mdFile of markdownFiles) {
        await processMarkdownFile(mdFile);
    }

    console.log('Pre-processing complete!');
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

    // Calculate the relative path from the HTML file to the storybook build
    const storybookPath = frontMatter.storybook.path;
    const resolvedStorybookPath = resolveStorybookPath(storybookPath, mdFilePath);

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
}

main().catch(console.error);
