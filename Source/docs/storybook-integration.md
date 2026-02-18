# Storybook Integration

This documentation site supports embedding Storybook in pages using YAML front matter.

## Usage

To add a Storybook to a documentation page, add the following YAML front matter to your markdown file:

```markdown
---
storybook:
  path: /absolute or ../relative
---

# Your Page Title

Your content here...
```

### Path Options

The `path` field supports two types of paths:

1. **Absolute paths** (from repository root): Start with `/`

   ```yaml
   storybook:
     path: /Source/docs/Documentation/my-storybook
   ```

2. **Relative paths** (from the markdown file): Use relative path notation

   ```yaml
   storybook:
     path: ../Documentation/my-storybook
   ```

## How It Works

1. **Build Phase**: Before DocFX runs, the `build-storybooks.ts` script:
   - Scans all markdown files for `storybook` front matter
   - Runs `npm install` (if there are dependencies)
   - Runs `npm run build-storybook` in the specified directory
   - The storybook must output to `storybook-static` directory (Storybook's default)

2. **DocFX Build**: DocFX processes the markdown files and copies the `storybook-static` directories as resources

3. **Post-Processing**: After DocFX completes, the `postprocess-storybooks.ts` script:
   - Finds all pages with storybook front matter
   - Injects an iframe pointing to the built storybook
   - Replaces the page content with the storybook iframe

## Requirements

Your Storybook project must:

1. Have a `package.json` file
2. Have a `build-storybook` script that builds the storybook
3. Output the built storybook to a `storybook-static` directory

Example `package.json`:

```json
{
  "name": "my-storybook",
  "version": "1.0.0",
  "scripts": {
    "build-storybook": "storybook build"
  },
  "devDependencies": {
    "@storybook/react": "^7.0.0",
    // ... other dependencies
  }
}
```

## Example

See the [test storybook](test-storybook/index.md) for a working example. The source code for this example is available at [Source/docs/Documentation/test-storybook](https://github.com/Cratis/Documentation/tree/main/Source/docs/Documentation/test-storybook).

## Styling

The storybook iframe is styled to fill the entire viewport to the right of the sidebar navigation. The styling uses a fixed position layout that:

- Extends from the navbar (top: 60px) to the bottom of the viewport
- Starts after the sidebar (left: 320px) and extends to the right edge
- Fills 100% of the available height and width in that space

The CSS is defined in `Source/templates/material/public/main.css` under the `.storybook-container` class. You can customize the positioning by modifying:

- `top`: Offset from the top (accounts for navbar height)
- `left`: Offset from the left (accounts for sidebar width)
- Other positioning values as needed for your theme
