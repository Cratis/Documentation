> [!WARNING]
> **Historical page from the retired DocFX site.** The current site ignores `storybook:` front matter; it embeds Storybook with the `StorybookEmbed` component and builds it with `npm run build:storybook`. See [the site README](../../web/README.md#api-reference-and-storybook), the [Components Storybook page](https://www.cratis.io/components/storybook/), and [why this folder is kept](../README.md).

# Storybook Quick Start

Quick reference for adding Storybook to your documentation pages.

## Add Storybook to a Page

1. Add front matter to your markdown file:

```markdown
---
storybook:
  path: /Source/JavaScript/YourStorybook
---
```

2. That's it! The build system will:
   - Automatically detect your repository (Arc, Chronicle, Fundamentals, etc.)
   - Build your storybook
   - Embed it in the page

## Path Examples

```yaml
# Absolute path (auto-detects repository)
storybook:
  path: /Source/JavaScript/Arc.React

# Relative path from markdown file
storybook:
  path: ../../my-storybook
```

## Enable Theme Sync (Optional)

Add to your `.storybook/preview.js`:

```javascript
import { addons } from '@storybook/preview-api';

window.addEventListener('message', (event) => {
  if (event.data.type === 'STORYBOOK_THEME_CHANGE') {
    const channel = addons.getChannel();
    channel.emit('updateGlobals', {
      globals: { theme: event.data.theme }
    });
  }
});
```

See [Storybook Integration](storybook-integration.md) for full documentation.
