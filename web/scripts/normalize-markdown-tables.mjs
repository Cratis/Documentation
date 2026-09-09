// Copyright (c) Cratis. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

// Normalize only recognized table rows, after URL rewriting changes cell widths.
// No prose, code examples, or cell interiors are reformatted.
function splitRow(line) {
    if (/^(?: {4}| *\t)/.test(line)) return null;
    // Block constructs interrupt a table even without a blank line. In
    // particular, never consume a following fence whose info string has a pipe.
    if (/^ {0,3}(?:`{3,}|~{3,}|#{1,6}(?:\s|$)|>|[-+*]\s|\d{1,9}[.)]\s|<)/.test(line)) return null;
    const indentation = line.match(/^ */)[0];
    const text = line.slice(indentation.length).trimEnd();
    const cells = [];
    let start = 0;
    let separators = 0;
    for (let index = 0; index < text.length; index++) {
        if (text[index] === '\\') {
            index++;
        } else if (text[index] === '`') {
            const run = text.slice(index).match(/^`+/)[0];
            // An unmatched backtick is literal, not a code span. Closing runs
            // must have the same length (a single tick can live inside ``...``).
            const remainder = text.slice(index + run.length);
            const closing = [...remainder.matchAll(/`+/g)].find((match) => match[0].length === run.length);
            if (closing) index += run.length + closing.index + run.length - 1;
            else index += run.length - 1;
        } else if (text[index] === '|') {
            cells.push(text.slice(start, index).trim());
            start = index + 1;
            separators++;
        }
    }
    if (!separators) return null;
    cells.push(text.slice(start).trim());
    if (text.startsWith('|')) cells.shift();
    if (text.endsWith('|') && cells.at(-1) === '') cells.pop();
    return { indentation, cells };
}

export function normalizeMarkdownTables(markdown) {
    const newline = markdown.includes('\r\n') ? '\r\n' : '\n';
    const lines = markdown.split(/\r?\n/);
    let fence = null;
    for (let index = 0; index < lines.length; index++) {
        const marker = lines[index].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
        if (fence) {
            if (marker && marker[1][0] === fence.character && marker[1].length >= fence.length && !marker[2].trim()) fence = null;
            continue;
        }
        if (marker) {
            fence = { character: marker[1][0], length: marker[1].length };
            continue;
        }
        const header = splitRow(lines[index]);
        const delimiter = index + 1 < lines.length ? splitRow(lines[index + 1]) : null;
        if (!header || !delimiter || header.cells.length !== delimiter.cells.length ||
            !delimiter.cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;

        const rows = [header, delimiter];
        let end = index + 2;
        while (end < lines.length) {
            const row = splitRow(lines[end]);
            if (!row || row.cells.length !== header.cells.length) break;
            rows.push(row);
            end++;
        }
        // Compact tables do not depend on UTF-16 length or terminal display
        // width, which disagree for emoji, fullwidth characters, and combining marks.
        for (const [rowIndex, row] of rows.entries()) {
            const cells = row.cells.map((cell) => {
                if (rowIndex !== 1) return cell;
                const left = cell.startsWith(':') ? ':' : '';
                const right = cell.endsWith(':') ? ':' : '';
                return left + '---' + right;
            });
            // An empty cell shares one space between its two pipes; emitting
            // separate left/right padding would make it an invalid compact cell.
            lines[index + rowIndex] = `${row.indentation}|${cells.map((cell) => cell ? ` ${cell} ` : ' ').join('|')}|`;
        }
        index = end - 1;
    }
    return lines.join(newline);
}
