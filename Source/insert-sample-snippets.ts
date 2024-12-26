import { glob } from 'glob';
import * as fs from 'fs';
import * as path from 'path';
import { Snippet } from 'Snippet';

const markdownFiles = await glob('../Articles/**/*.md', { follow: true });

const snippetsAsString = fs.readFileSync('snippets.json', 'utf-8');
const snippets = JSON.parse(snippetsAsString) as { [key: string]: Snippet };

const snippetRegex = /{{snippet:([a-zA-Z0-9_-]+)}}/g

console.log('\n\nInsert code snippets\n');

let count = 0;

await Promise.all(markdownFiles.map(async file => {
    const content = await fs.promises.readFile(file, 'utf-8');
    let replaced = false;   

    const updatedContent = content.replace(snippetRegex, (_, snippetName) => {
        if (!snippets[snippetName]) {
            console.error(`Snippet '${snippetName}' not found in snippets.json`);
            throw new Error(`Snippet '${snippetName}' not found in snippets.json`);
        }

        replaced = true;
        const url = `https://github.com/cratis/samples/blob/main/${snippets[snippetName].relativePath}#L${snippets[snippetName].startLine}-L${snippets[snippetName].endLine}`;
        process.stdout.write('.');
        count++;
        return `\`\`\`csharp\n${snippets[snippetName].content}\n\`\`\`\n\n[Snippet source](${url})`;
    });

    if (replaced) {
        await fs.promises.writeFile(file, updatedContent);
    }
}));

console.log(`\n\n${count} snippets inserted\n`);
