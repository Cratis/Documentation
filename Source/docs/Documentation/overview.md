# Overview

The Cratis documentation system is designed to provide comprehensive,
accurate, and practical documentation by integrating multiple sources:

## Architecture

The documentation build process consists of several stages:

### 1. Storybook Building

Before DocFX runs, the build system scans all markdown files for
Storybook front matter and builds any referenced Storybook projects.
This allows interactive component documentation to be embedded directly
in the docs.

See [Storybook Integration](storybook-integration.md) for details.

### 2. TypeScript Documentation

TypeScript documentation is generated using
[TypeDoc](https://typedoc.org/) from the source code in the various
projects (Arc, Fundamentals, etc.).

### 3. Code Snippet Extraction

The `extract-code-snippets.ts` script scans the
[Samples repository](https://github.com/Cratis/Samples) for code
snippets marked with special region markers and extracts them into a
`snippets.json` file.

See [Code Snippets](code-snippets.md) for details.

### 4. Snippet Insertion

The `insert-sample-snippets.ts` script processes markdown files and
replaces `{{snippet:name}}` placeholders with actual code from the
extracted snippets.

### 5. .NET API Documentation

DocFX processes the .NET projects (Chronicle, Arc, Fundamentals) to
generate API documentation from XML comments.

### 6. DocFX Build

DocFX processes all markdown files, API metadata, and resources to
generate the static site.

### 7. Post-Processing

After DocFX completes:

- `postprocess-storybooks.ts` injects iframe elements into pages with
  Storybook front matter
- The Storybook static files are copied to the appropriate locations

## Directory Structure

```text
Source/
  docs/                    # Markdown documentation files
    Chronicle/            # Chronicle-specific docs
    Arc/                  # Arc-specific docs
    Fundamentals/         # Fundamentals-specific docs
    Contributing/         # Contributing guides
    Documentation/        # This documentation section
  api/                     # Generated API documentation (output)
  _site/                   # Final generated site (output)
  templates/               # DocFX templates
  docfx.json              # DocFX configuration
  build-storybooks.ts     # Storybook build script
  postprocess-storybooks.ts  # Storybook post-processing
  extract-code-snippets.ts   # Snippet extraction
  insert-sample-snippets.ts  # Snippet insertion
```

## Configuration

The main configuration file is `docfx.json`, which defines:

- **Metadata**: .NET projects to generate API docs from
- **Content**: Markdown files to process
- **Resource**: Static files to copy (images, Storybooks, etc.)
- **Templates**: UI templates to use
- **Global Metadata**: Site-wide settings (title, logo, etc.)

## Build Process

The complete build is orchestrated through the `package.json` scripts:

```json
{
  "scripts": {
    "build:storybooks": "...",
    "build:ts": "...",
    "extract-snippets": "...",
    "insert-snippets": "...",
    "build": "yarn build:storybooks && yarn build:ts &&
      yarn extract-snippets && yarn insert-snippets &&
      dotnet build -t:BuildApiDependencies && dotnet docfx &&
      yarn postprocess:storybooks"
  }
}
```

## Live Preview

To preview documentation changes locally before publishing:

```bash
cd Source
yarn build
# Then open _site/index.html in a browser
# Or use a local web server:
npx http-server _site
```

## Publishing

The documentation is automatically published to
[cratis.io](https://www.cratis.io) when changes are pushed to the main
branch via GitHub Actions (or your CI/CD pipeline).
