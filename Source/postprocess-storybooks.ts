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

    // Find all markdown files with storybook front matter
    const markdownFiles = await glob('**/*.md', {
        cwd: SOURCE_DIR,
        ignore: ['**/node_modules/**', '**/_site/**', '**/obj/**', '**/bin/**', '**/.yarn/**'],
        absolute: true
    });

    for (const mdFile of markdownFiles) {
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
    const relativePath = path.relative(SOURCE_DIR, mdFilePath);
    const htmlRelativePath = relativePath.replace(/\.md$/, '.html');
    const htmlPath = path.join(SITE_OUTPUT, htmlRelativePath);

    if (!fs.existsSync(htmlPath)) {
        console.warn(`HTML file not found: ${htmlPath}`);
        return;
    }

    // Calculate the relative path from the HTML file to the storybook build
    const storybookPath = frontMatter.storybook.path;
    const resolvedStorybookPath = resolveStorybookPath(storybookPath, mdFilePath);
    const storybookBuildPath = path.join(resolvedStorybookPath, 'storybook-static');

    // Calculate relative path from HTML to storybook-static
    const htmlDir = path.dirname(htmlPath);
    const storybookRelativePath = path.relative(htmlDir, path.join(SITE_OUTPUT, path.relative(SOURCE_DIR, storybookBuildPath))).replace(/\\/g, '/');

    // Inject the iframe into the HTML
    injectStorybookIframe(htmlPath, storybookRelativePath);
}

function resolveStorybookPath(storybookPath: string, markdownFile: string): string {
    if (storybookPath.startsWith('/')) {
        // Absolute path from repository root
        const repoRoot = path.resolve(SOURCE_DIR, '..');
        return path.join(repoRoot, storybookPath.substring(1));
    } else {
        // Relative path from markdown file
        const markdownDir = path.dirname(markdownFile);
        return path.resolve(markdownDir, storybookPath);
    }
}

function injectStorybookIframe(htmlPath: string, storybookRelativePath: string) {
    let html = fs.readFileSync(htmlPath, 'utf-8');

    // The storybookRelativePath might not be correct because DocFX flattens directory structures
    // We need to find the actual location of the storybook-static directory
    // Extract the storybook folder name (last directory before storybook-static)
    
    const storybookFolderMatch = storybookRelativePath.match(/([^/]+)\/storybook-static$/);
    const storybookFolder = storybookFolderMatch ? storybookFolderMatch[1] : null;
    
    let iframeSrc = storybookRelativePath;
    if (storybookFolder) {
        // DocFX flattens external resources from ../Samples to the root of _site
        // This assumes the HTML is at docs/*/index.html, requiring ../../ to reach the site root
        // TODO: Calculate this path dynamically based on actual nesting depth if structure changes
        iframeSrc = `../../${storybookFolder}/storybook-static/index.html`;
    } else {
        iframeSrc = `${storybookRelativePath}/index.html`;
    }

    // Create the iframe HTML
    const iframeHtml = `
<div class="storybook-container" style="width: 100%; height: calc(100vh - 200px); min-height: 600px;">
    <iframe src="${iframeSrc}" style="width: 100%; height: 100%; border: none;" title="Storybook"></iframe>
</div>`;

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
