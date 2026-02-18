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
}

interface FrontMatter {
    storybook?: StorybookConfig;
    [key: string]: any;
}

const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = __dirname;
const SITE_OUTPUT = path.join(SOURCE_DIR, '_site');

async function main() {
    console.log('Building Storybooks...');

    // Find all markdown files
    const markdownFiles = await glob('**/*.md', {
        cwd: SOURCE_DIR,
        ignore: ['**/node_modules/**', '**/_site/**', '**/obj/**', '**/bin/**', '**/.yarn/**'],
        absolute: true,
        follow: true
    });

    for (const file of markdownFiles) {
        await processMarkdownFile(file);
    }

    console.log('Storybook build complete!');
}

async function processMarkdownFile(filePath: string) {
    let content: string;
    try {
        content = fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return;
    }

    // Parse front matter
    const frontMatterMatch = content.match(/^---\s*\n(.*?)\n---\s*\n/s);
    if (!frontMatterMatch) {
        return;
    }

    let frontMatter: FrontMatter;
    try {
        frontMatter = yaml.load(frontMatterMatch[1]) as FrontMatter;
    } catch (error) {
        console.error(`Error parsing front matter in ${filePath}:`, error);
        return;
    }

    if (!frontMatter.storybook?.path) {
        return;
    }

    console.log(`Found Storybook configuration in ${filePath}`);

    const storybookPath = resolveStorybookPath(frontMatter.storybook.path, filePath);

    if (!fs.existsSync(storybookPath)) {
        console.warn(`Storybook path not found: ${storybookPath}`);
        return;
    }

    await buildStorybook(storybookPath, filePath);
}

function resolveStorybookPath(storybookPath: string, markdownFile: string): string {
    if (storybookPath.startsWith('/')) {
        // Absolute path - infer repository from markdown file location
        const relativePath = path.relative(SOURCE_DIR, markdownFile);
        const parts = relativePath.split(path.sep);
        
        // Check if file is in a docs subfolder (docs/SubmoduleName/...)
        // This indicates it's from a different repository/submodule
        if (parts.length >= 2 && parts[0] === 'docs') {
            const submoduleName = parts[1];
            // Skip 'Documentation' folder as it's part of this repo
            if (submoduleName !== 'Documentation') {
                return path.join(REPO_ROOT, submoduleName, storybookPath.substring(1));
            }
        }
        
        // Default: resolve from repository root
        return path.join(REPO_ROOT, storybookPath.substring(1));
    } else {
        // Relative path from markdown file
        const markdownDir = path.dirname(markdownFile);
        return path.resolve(markdownDir, storybookPath);
    }
}

async function buildStorybook(storybookPath: string, markdownFile: string) {
    console.log(`Building Storybook at ${storybookPath}`);

    const packageJsonPath = path.join(storybookPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        console.warn(`No package.json found in ${storybookPath}, skipping`);
        return;
    }

    try {
        // Check if package.json has dependencies
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const hasDependencies = packageJson.dependencies || packageJson.devDependencies;

        // Check if node_modules exists
        const nodeModulesPath = path.join(storybookPath, 'node_modules');
        if (!fs.existsSync(nodeModulesPath) && hasDependencies) {
            console.log(`Running npm install in ${storybookPath}...`);
            execSync('npm install', {
                cwd: storybookPath,
                stdio: 'inherit',
                // Clear NODE_OPTIONS to avoid ts-node loader conflicts from parent process
                // The parent process uses --loader ts-node/esm which would cause errors
                // when yarn/npm runs in subdirectories without ts-node installed
                env: { ...process.env, NODE_OPTIONS: '' }
            });
        }

        // Build storybook
        console.log(`Running storybook build in ${storybookPath}...`);
        execSync('npm run build-storybook', {
            cwd: storybookPath,
            stdio: 'inherit',
            // Clear NODE_OPTIONS to avoid ts-node loader conflicts from parent process
            // The parent process uses --loader ts-node/esm which would cause errors
            // when yarn/npm runs in subdirectories without ts-node installed
            env: { ...process.env, NODE_OPTIONS: '' }
        });

        console.log(`Successfully built Storybook at ${storybookPath}`);

        // The storybook-static directory will be copied by docfx.json resource configuration
    } catch (error) {
        console.error(`Error building Storybook at ${storybookPath}:`, error);
    }
}

main().catch(console.error);

