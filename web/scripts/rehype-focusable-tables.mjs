// Makes Starlight's horizontally scrollable Markdown tables keyboard reachable.
// Starlight applies overflow directly to the table element, so the same element
// must be focusable for keyboard users to reach clipped columns on narrow screens.

function makeTablesFocusable(node) {
    if (node?.type === 'element' && node.tagName === 'table') {
        node.properties ??= {};
        node.properties.tabIndex = 0;
    }

    for (const child of node?.children ?? []) {
        makeTablesFocusable(child);
    }
}

export function rehypeFocusableTables() {
    return (tree) => makeTablesFocusable(tree);
}
