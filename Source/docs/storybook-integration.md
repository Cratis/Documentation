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
     path: /Source/JavaScript/MyStorybook
   ```

   **Auto-Repository Detection**: When a markdown file is in a submodule (e.g., `Arc`, `Chronicle`, `Fundamentals`), absolute paths are automatically resolved relative to that submodule's root. This means you don't need to include the submodule name in the path!

   For example, in a file at `Arc/Documentation/frontend/react/storybook.md`:
   ```yaml
   storybook:
     path: /Source/JavaScript/Arc.React  # Auto-resolves to Arc/Source/JavaScript/Arc.React
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

The storybook iframe is styled to fill the available content area with the following approach:

- **Width**: Fills 100% of the content area (automatically adjusts when sidebar is visible/hidden)
- **Height**: Uses `calc(100vh - 140px)` to fill the viewport height minus the navbar and footer
- **Minimum Height**: 600px fallback for smaller viewports
- **Responsive**: Works with the sidebar toggle - when the sidebar is hidden on smaller screens, the Storybook expands to fill the full width

The CSS is defined in `Source/templates/material/public/main.css` under the `.storybook-container` class. You can customize the height calculation by adjusting the offset (currently 140px) to match your theme's navbar and footer heights.

## Theme Synchronization

The documentation site automatically sends theme change notifications to embedded Storybooks when users switch between light and dark modes. To enable theme synchronization in your Storybook:

### Option 1: Add to .storybook/preview.js (Recommended)

```javascript
import { addons } from '@storybook/preview-api';

// Listen for theme changes from parent documentation site
window.addEventListener('message', (event) => {
  if (event.data.type === 'STORYBOOK_THEME_CHANGE') {
    const channel = addons.getChannel();
    // For @storybook/addon-themes
    channel.emit('updateGlobals', {
      globals: { theme: event.data.theme }
    });
  }
});
```

### Option 2: Use the Helper Script

Load the provided helper script in your Storybook's `.storybook/preview-head.html`:

```html
<script src="/storybook-theme-sync.js"></script>
```

The helper script (available at `Source/storybook-theme-sync.js`) provides automatic theme synchronization with fallbacks for different Storybook configurations.

### How It Works

1. When a user switches themes in the documentation site (light/dark), the page sends a `postMessage` to the Storybook iframe
2. The message contains: `{ type: 'STORYBOOK_THEME_CHANGE', theme: 'dark' | 'light' }`
3. Your Storybook's listener receives the message and updates its theme accordingly
