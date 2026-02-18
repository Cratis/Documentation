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

const SOURCE_DIR = __dirname;
const SITE_OUTPUT = path.join(SOURCE_DIR, '_site');

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

    // Use the relative path directly - DocFX preserves the directory structure for resources
    const iframeSrc = `${storybookRelativePath}/index.html`;

    // Create the iframe HTML with theme synchronization script
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
