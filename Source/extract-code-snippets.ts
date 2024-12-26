import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { Snippet } from 'Snippet';

const csFiles = await glob('../Samples/**/*.cs');

console.log('\n\nExtract code snippets\n');

const snippetStartSearchString = '#region Snippet:';
const snippetEndSearchString = '#endregion Snippet:';

const snippets: { [key: string]: Snippet } = {};
let count = 0;

for (const csFile of csFiles) {
    const fileContent = fs.readFileSync(csFile, 'utf8');
    const relativePath = path.relative('../Samples', csFile);
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

fs.writeFileSync('snippets.json', JSON.stringify(snippets, null, 2));
