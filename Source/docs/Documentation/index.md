# Contributing to Documentation

This section covers how to contribute to the Cratis documentation,
including conventions, tools, and best practices.

| Topic | Description |
| ------- | ----------- |
| [Overview](overview.md) | Understanding how the documentation system works |
| [Code Snippets](code-snippets.md) | How to include code samples from the Samples repository |
| [Storybook Integration](storybook-integration.md) | How to embed interactive Storybook components |

## Documentation Structure

The Cratis documentation is built using
[DocFX](https://dotnet.github.io/docfx/), a static site generator
designed for technical documentation. The documentation covers
multiple projects:

- **Chronicle** - Event sourcing framework
- **Arc** - Full-stack application framework
- **Fundamentals** - Shared libraries and utilities

## Getting Started

To build the documentation locally:

```bash
cd Source
yarn install
yarn build
```

This will:

1. Build all referenced Storybooks
2. Build TypeScript documentation (TSDoc)
3. Extract code snippets from samples
4. Insert snippets into markdown files
5. Build API documentation for .NET projects
6. Run DocFX to generate the static site
7. Post-process to inject Storybook iframes

The generated site will be available in `Source/_site`.

## Writing Documentation

When writing documentation:

- Use clear, concise language
- Include practical examples
- Link to relevant API documentation
- Add code snippets from working samples
- Use proper Markdown formatting
- Keep the table of contents up to date

## Resources

- [DocFX Documentation](https://dotnet.github.io/docfx/)
- [Markdown Guide](https://www.markdownguide.org/)
- [Cratis Samples Repository](https://github.com/Cratis/Samples)
