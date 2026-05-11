import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';

interface Language {
    displayName: string;
    tabId: string;
    resolveRootFolder: (folderName: string) => string;
}

const languages: Language[] = [
    {
        displayName: 'C#',
        tabId: 'csharp',
        resolveRootFolder: folderName => folderName
    },
    {
        displayName: 'TypeScript',
        tabId: 'typescript',
        resolveRootFolder: folderName => `${folderName}.TypeScript`
    }
];

const markdownFiles = await glob('**/*.md', {
    ignore: [
        '**/node_modules/**',
        '**/.yarn/**',
        '**/_site/**',
        '**/obj/**',
        '**/bin/**'
    ],
    follow: true
});

const multilangRegex = /:::multilang\s+title="([^"]+)"\s*:::/g;

const rootPath = process.cwd();

function getSnippetPathForLanguage(markdownFile: string, title: string, language: Language): string {
    const markdownAbsolutePath = path.resolve(markdownFile);
    const markdownDirectory = path.dirname(markdownAbsolutePath);
    const fileName = title
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') + '.md';
    const currentSnippetPath = path.join(markdownDirectory, 'snippets', fileName);
    const relativePath = path.relative(rootPath, currentSnippetPath);
    const pathParts = relativePath.split(path.sep);

    if (pathParts.length === 0) {
        return currentSnippetPath;
    }

    const languageRoot = language.resolveRootFolder(pathParts[0]);
    const languageSnippetPath = path.join(rootPath, languageRoot, ...pathParts.slice(1));
    return languageSnippetPath;
}

function buildMultilangTabs(markdownFile: string, title: string): string {
    const tabs = languages
        .map(language => {
            const snippetPath = getSnippetPathForLanguage(markdownFile, title, language);
            if (!fs.existsSync(snippetPath)) {
                return null;
            }

            const content = fs.readFileSync(snippetPath, 'utf-8').trim();
            if (content === '') {
                return null;
            }

            return `# [${language.displayName}](#tab/${language.tabId})\n\n${content}`;
        })
        .filter((tab): tab is string => tab !== null);

    return tabs.join('\n\n---\n\n');
}

console.log('\n\nPreprocess multilang directives\n');

let count = 0;

await Promise.all(markdownFiles.map(async file => {
    const content = await fs.promises.readFile(file, 'utf-8');
    let replaced = false;

    const updatedContent = content.replace(multilangRegex, (match, title, offset, _fullContent) => {
        const beforeMatch = content.substring(0, offset);

        const backticksBefore = (beforeMatch.match(/`/g) || []).length;
        if (backticksBefore % 2 !== 0) {
            return match;
        }

        const codeBlocksBefore = (beforeMatch.match(/```/g) || []).length;
        if (codeBlocksBefore % 2 !== 0) {
            return match;
        }

        const tabs = buildMultilangTabs(file, title);
        if (tabs === '') {
            console.warn(`No multilang snippets found for '${title}' in ${file}`);
            return match;
        }

        replaced = true;
        count++;
        process.stdout.write('.');
        return tabs;
    });

    if (replaced) {
        await fs.promises.writeFile(file, updatedContent);
    }
}));

console.log(`\n\n${count} multilang directives inserted\n`);
