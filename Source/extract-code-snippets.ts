import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { Snippet } from 'Snippet';

type FileExtensionAndSnippetMarker = {
    fileExtension: string;
    snippetStartMarker: string;
    snippetEndMarker: string;
}

const filesAndMarkers: FileExtensionAndSnippetMarker[] = [
    {
        fileExtension: '.cs',
        snippetStartMarker: '#region Snippet:',
        snippetEndMarker: '#endregion Snippet:'
    },
    {
        fileExtension: '.yml',
        snippetStartMarker: '#region Snippet:',
        snippetEndMarker: '#endregion Snippet:'
    },
    {
        fileExtension: '.ts',
        snippetStartMarker: '// #region Snippet:',
        snippetEndMarker: '// #endregion Snippet:'
    },
    {
        fileExtension: '.tsx',
        snippetStartMarker: '// #region Snippet:',
        snippetEndMarker: '// #endregion Snippet:'
    },
    {
        fileExtension: '.js',
        snippetStartMarker: '// #region Snippet:',
        snippetEndMarker: '// #endregion Snippet:'
    },
    {
        fileExtension: '.html',
        snippetStartMarker: '<!-- #region Snippet: -->',
        snippetEndMarker: '<!-- #endregion Snippet: -->'
    }
]

const snippets: { [key: string]: Snippet } = {};
for (const fileAndMarker of filesAndMarkers) {
    const snippetStartSearchString = fileAndMarker.snippetStartMarker;
    const snippetEndSearchString = fileAndMarker.snippetEndMarker;

    const files = await glob(`../Samples/**/*${fileAndMarker.fileExtension}`);
    console.log('\n\nExtract code snippets\n');

    let count = 0;

    for (const file of files) {
        const fileContent = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative('../Samples', file);
        const lines = fileContent.split('\n');
        const snippetLines: string[] = [];
        let inSnippet = false;
        let startLine = -1;
        let snippetName = '';
        lines.forEach((line, index) => {
            if (line.trim().startsWith(snippetStartSearchString)) {
                inSnippet = true;
                startLine = index + 2;
                snippetName = line.trim().substring(snippetStartSearchString.length).trim();
            }
            else if (line.trim().startsWith(snippetEndSearchString)) {
                inSnippet = false;
                const snippet = snippetLines.join('\n');
                process.stdout.write('.');
                snippetLines.length = 0;
                snippets[snippetName] = {
                    relativePath,
                    startLine,
                    endLine: index,
                    content: snippet
                };
                count++;
            }
            else if (inSnippet) {
                snippetLines.push(line);
            }
        });
    }

    console.log(`\n\n${count} snippets found`);
}

fs.writeFileSync('snippets.json', JSON.stringify(snippets, null, 2));
