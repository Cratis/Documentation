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
     path: /Samples/my-storybook
   ```

2. **Relative paths** (from the markdown file): Use relative path notation

   ```yaml
   storybook:
     path: ../../../Samples/my-storybook
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

See the test storybook at `/Source/docs/test-storybook/index.md` for a working example.

## Styling

The storybook container is styled to fill the content area with a minimum height of 600px and a calculated height of `calc(100vh - 200px)` to account for the header and footer.

You can customize the styling by adding CSS to your custom template or by modifying the `postprocess-storybooks.ts` script.
