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

    for (const file of uniqueFiles.values()) {
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
        const repoRelativePath = path.relative(REPO_ROOT, markdownFile);
        const repoParts = repoRelativePath.split(path.sep);
        const knownSubmodules = ['Arc', 'Chronicle', 'Fundamentals', 'Components'];

        let submoduleName: string | null = null;
        if (repoParts.length >= 2 && knownSubmodules.includes(repoParts[0])) {
            submoduleName = repoParts[0];
        } else {
            const sourceRelativePath = path.relative(SOURCE_DIR, markdownFile);
            const sourceParts = sourceRelativePath.split(path.sep);
            if (sourceParts.length >= 2 && sourceParts[0] === 'docs' && sourceParts[1] !== 'Documentation') {
                submoduleName = sourceParts[1];
            }
        }

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

function isYarnWorkspaceRoot(dirPath: string): boolean {
    const packageJsonPath = path.join(dirPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
        return false;
    }

    try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8')) as {
            workspaces?: string[] | { packages?: string[] };
            packageManager?: string;
        };
        return Boolean(packageJson.workspaces) && Boolean(packageJson.packageManager?.startsWith('yarn@'));
    } catch {
        return false;
    }
}

function findYarnWorkspaceRoot(startDir: string): string | null {
    let current = startDir;
    const repoRoot = REPO_ROOT;

    while (true) {
        if (isYarnWorkspaceRoot(current)) {
            return current;
        }

        if (current === repoRoot) {
            break;
        }

        const parent = path.dirname(current);
        if (parent === current) {
            break;
        }

        current = parent;
    }

    return null;
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

        const workspaceRoot = findYarnWorkspaceRoot(storybookPath);
        const installCwd = workspaceRoot ?? storybookPath;
        const nodeModulesPath = path.join(installCwd, 'node_modules');

        if (hasDependencies && !fs.existsSync(nodeModulesPath)) {
            if (workspaceRoot) {
                console.log(`Running yarn install in ${installCwd}...`);
                execSync('yarn install', {
                    cwd: installCwd,
                    stdio: 'inherit',
                    // Clear NODE_OPTIONS to avoid ts-node loader conflicts from parent process
                    // The parent process uses --loader ts-node/esm which would cause errors
                    // when yarn/npm runs in subdirectories without ts-node installed
                    env: { ...process.env, NODE_OPTIONS: '' }
                });
            } else {
                console.log(`Running npm install in ${storybookPath}...`);
                execSync('npm install --legacy-peer-deps', {
                    cwd: storybookPath,
                    stdio: 'inherit',
                    // Clear NODE_OPTIONS to avoid ts-node loader conflicts from parent process
                    // The parent process uses --loader ts-node/esm which would cause errors
                    // when yarn/npm runs in subdirectories without ts-node installed
                    env: { ...process.env, NODE_OPTIONS: '' }
                });
            }
        }

        // Build storybook
        console.log(`Running storybook build in ${storybookPath}...`);
        execSync(workspaceRoot ? 'yarn build-storybook' : 'npm run build-storybook', {
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

