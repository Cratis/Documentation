import * as yaml from 'js-yaml';
import { glob } from 'glob';
import * as path from 'path';
import * as fs from 'fs';

const folders = [
    'api/arc/javascript',
    'api/fundamentals/javascript'
];

console.log('\n\nCreate TOCs for all folders\n');

type TOCItem = {
    name: string;
    href: string;
}

const createTableOfContentsFor = async (folder: string) => {
    const mdFiles = fs.readdirSync(folder)
        .filter(file => file.endsWith('.md') && file !== 'README.md');

    const subFolders = fs.readdirSync(folder, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory() && dirent.name !== '_media')
        .map(dirent => dirent.name);

    const folderItems = subFolders.map(subFolder => {
        return {
            name: subFolder,
            href: `${subFolder}/toc.yml`
        } as TOCItem
    });

    const mdItems = mdFiles.map(mdFile => {
        return {
            name: path.basename(mdFile, '.md'),
            href: mdFile
        } as TOCItem
    });

    const items = [...folderItems, ...mdItems];

    if (mdItems.length > 0) {

        const targetFile = path.join(folder, 'toc.yml');
        const tocYaml = yaml.dump(items);
        fs.writeFileSync(targetFile, tocYaml);
    }


    for (const subFolder of subFolders) {
        const subFolderPath = path.join(folder, subFolder);
        createTableOfContentsFor(subFolderPath);
    }
}


for (const folder of folders) {
    const searchString = path.join(folder, '**/README.md');
    console.log(`\nCreating TOCs for '${folder}'`);
    const readmeFiles = await glob(searchString);

    for (const file of readmeFiles) {
        process.stdout.write('.');
        const folderPath = path.dirname(file);

        createTableOfContentsFor(folderPath);
    }
}

console.log('\n');
