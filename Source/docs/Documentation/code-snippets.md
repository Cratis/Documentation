# Code Snippets

The Cratis documentation uses a snippet system to include code samples
directly from working examples in the
[Samples repository](https://github.com/Cratis/Samples). This ensures
that code examples in the documentation are always working and
up-to-date.

## How It Works

The snippet system works in two phases:

### 1. Extraction

The `extract-code-snippets.ts` script scans the Samples repository for
code marked with special region markers and extracts them into a
`snippets.json` file.

### 2. Insertion

The `insert-sample-snippets.ts` script processes markdown files and
replaces `{{snippet:name}}` placeholders with the actual code.

## Marking Code as Snippets

To mark code as a snippet in the Samples repository, use region markers
appropriate for the language:

### C# (.cs)

```csharp
public class MyClass
{
    #region Snippet:my-snippet-name
    public void MyMethod()
    {
        // This code will be extracted
        Console.WriteLine("Hello, World!");
    }
    #endregion Snippet:my-snippet-name
}
```

### TypeScript/JavaScript (.ts, .tsx, .js)

```typescript
export class MyClass {
    // #region Snippet:my-snippet-name
    myMethod() {
        // This code will be extracted
        console.log("Hello, World!");
    }
    // #endregion Snippet:my-snippet-name
}
```

### YAML (.yml)

```yaml
#region Snippet:my-snippet-name
services:
  myservice:
    image: myimage:latest
#endregion Snippet:my-snippet-name
```

### HTML (.html)

```html
<!-- #region Snippet:my-snippet-name -->
<div class="my-component">
    <h1>Hello, World!</h1>
</div>
<!-- #endregion Snippet:my-snippet-name -->
```

## Using Snippets in Documentation

To include a snippet in your markdown documentation, use the following syntax:

```markdown
{{snippet:my-snippet-name}}
```

During the build process, this will be replaced with:

````markdown
```csharp
public void MyMethod()
{
    // This code will be extracted
    Console.WriteLine("Hello, World!");
}
```

[Snippet source](https://github.com/cratis/samples/blob/main/path/to/file.cs#L10-L14)
````

The snippet will include:

- The code with proper syntax highlighting
- A link to the source file in GitHub with line numbers

## Naming Conventions

Snippet names should:

- Use kebab-case (lowercase with hyphens)
- Be descriptive of what the snippet demonstrates
- Be unique across the entire Samples repository

Examples:

- `mongodb-connection-setup`
- `event-handler-basic`
- `projection-with-join`
- `docker-compose-chronicle`

## Best Practices

### 1. Keep Snippets Focused

Each snippet should demonstrate one specific concept or feature. If you
need to show multiple steps, create multiple snippets.

### 2. Make Snippets Self-Contained

Include enough context so the snippet makes sense on its own, but
don't include unnecessary surrounding code.

### 3. Use Working Examples

Always extract snippets from working, tested code in the Samples
repository. Never create snippets directly in markdown files.

### 4. Update Documentation When Samples Change

If you update a sample that has extracted snippets, remember to
rebuild the documentation to update the snippets.

### 5. Test Your Snippets

Before marking code as a snippet, ensure it:

- Compiles/runs without errors
- Demonstrates the intended concept clearly
- Follows coding standards and best practices

## Troubleshooting

### Snippet Not Found

If you see an error like
`Snippet 'my-snippet' not found in snippets.json`, check that:

1. The snippet region markers are correct in the source file
1. The file is in the `../Samples/` directory
1. The file extension is supported (`.cs`, `.ts`, `.tsx`, `.js`,
   `.yml`, `.html`)
1. You've run `yarn extract-snippets` to update the snippets.json file

### Snippet Not Updating

If changes to a snippet aren't appearing in the documentation:

1. Run `yarn extract-snippets` to regenerate snippets.json
2. Run `yarn insert-snippets` to update markdown files
3. Run `yarn build` to rebuild the entire site

## Example Workflow

Here's a complete workflow for adding a new code example to the
documentation:

1. **Create the sample code** in the appropriate location under
   `Samples/`:

```typescript
// Samples/Chronicle/Examples/MyFeature.ts
export class MyFeature {
    // #region Snippet:my-feature-usage
    async demonstrateFeature() {
        const feature = new MyFeature();
        await feature.execute();
    }
    // #endregion Snippet:my-feature-usage
}
```

1. **Reference the snippet** in your documentation:

```markdown
# My Feature

Here's how to use this feature:

{{snippet:my-feature-usage}}
```

1. **Build the documentation**:

```bash
cd Source
yarn extract-snippets
yarn insert-snippets
yarn build
```

1. **Verify** the snippet appears correctly in `_site/docs/...`

## Supported File Types

The snippet extraction system supports the following file types:

| Extension | Language | Region Markers |
| --------- | -------- | -------------- |
| `.cs` | C# | `#region Snippet:` / `#endregion Snippet:` |
| `.ts` | TypeScript | `// #region Snippet:` / `// #endregion Snippet:` |
| `.tsx` | TypeScript (React) | `// #region Snippet:` / `// #endregion Snippet:` |
| `.js` | JavaScript | `// #region Snippet:` / `// #endregion Snippet:` |
| `.yml` | YAML | `#region Snippet:` / `#endregion Snippet:` |
| `.html` | HTML | `<!-- #region Snippet: -->` / `<!-- #endregion Snippet: -->` |

To add support for additional file types, modify the `filesAndMarkers`
array in `extract-code-snippets.ts`.
