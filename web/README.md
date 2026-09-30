<!-- Copyright (c) Cratis. All rights reserved. -->
<!-- Licensed under the MIT license. See LICENSE file in the project root for full license information. -->

# Cratis documentation site

This folder is the [Astro Starlight](https://starlight.astro.build/) site published at <https://www.cratis.io>. Use this guide when you need to preview the site, change a page that lives in this repository, or work out which check covers your change.

Most pages are not written here. Each product keeps its documentation in its own repository, and `scripts/sync-content.mjs` converts those folders into site content at build time.

## Authored and generated files

Find the owner before you edit. Every product page on the live site has an edit link that points at its authored file.

| Path under `web/` | What it is | Edit it? |
| --- | --- | --- |
| `src/content/docs/<product>/` for each `PRODUCTS` key in `scripts/sync-content.mjs` (`chronicle`, `arc`, `components`, `cli`, `fundamentals`, `contributing`, `screenplay`, ...) and `src/content/docs/release-digests/` | Synchronized copies of product documentation. Gitignored and replaced on every sync. | No. Edit the product repository. |
| Every other file in `src/content/docs/` (`index.mdx`, `why-cratis.mdx`, `scenarios/`, `ai/`, `event-sourcing/`, `tools/`, `api-reference.md`, ...) | Site-level pages, authored here and tracked in Git. | Yes. |
| `astro.config.mjs` | Site-level navigation, plugins and Markdown pipeline. Product sidebars come from each product's `toc.yml`. | Yes. |
| `variant-docs.yml` | Language tabs and client/backend variant mounts for Chronicle and Arc. | Yes. |
| `content-redirects.yml` | Redirects for moved site routes. | Yes. |
| `src/components/`, `src/styles/`, `scripts/` | Site components, styling and build tooling. | Yes. |
| `src/generated/` | `topics.json`, `samples.json`, `upgrade-paths.json` and `release-digests.json`, written by a full `npm run sync` (a targeted `node scripts/sync-content.mjs <product>` does not write `release-digests.json`). Gitignored. | No. |
| `public/api/`, `public/storybook/`, `public/storybook-arc/` | API reference and Storybook builds. Gitignored. | No. Rebuild them. |
| `api-build/` | DocFX input for the .NET API reference. Git tracks only `docfx.json`, `toc.yml` and `index.md`. The build generates everything else there. | Only the three tracked files. |
| `dist/` | Production build output. | No. |

The mapping from public route to authored source is the `PRODUCTS` list (and its `familySources`) in `scripts/sync-content.mjs`. `/contributing/**` comes from the organization's `Cratis/.github` repository.

The top-level `Source/` folder in this repository is the retired DocFX site. The active documentation workflow neither builds nor publishes it. [`Source/README.md`](../Source/README.md) explains where its content went.

## Prerequisites

### Node.js

Use a supported Node.js release that satisfies every `engines` requirement below, such as Node 24 LTS or newer.

- The site's dependencies need Node 22.12 or newer (the `engines` fields of Astro and starlight-typedoc).
- Building the Components Storybook needs Node 23 or newer (the `engines` field in Components' `package.json`).
- `web/package.json` declares no `engines` field of its own.

CI currently installs Node 23 (`node-version: 23` in `.github/workflows/docs-site.yml`). That is a fact about the workflow, not a recommendation for your machine.

No lockfile is committed: `.gitignore` excludes both `package-lock.json` and `yarn.lock`. `npm install` resolves the ranges in `package.json`, and CI's `npm ci` falls back to `npm install` for the same reason.

### Sibling checkouts

`sync-content.mjs` reads each product from a folder next to this repository, so a local layout looks like this:

```text
<parent>/
├── Documentation/      this repository; the site is Documentation/web
├── Chronicle/
├── Arc/
├── Components/
├── Samples/
└── ...                 any other product you want in your preview
```

You do not need every product. What happens when one is missing:

| Sibling folder | Supplies | If it is missing |
| --- | --- | --- |
| `Samples` | `samples.json`, the catalog behind `/samples/` | `npm run sync` stops with "Could not find the Samples catalog". Required. |
| `Chronicle`, `Arc`, `Components` | Their product sections, plus Chronicle's shared client docs | Sync skips them. Unless an earlier sync left a copy behind, the post-build step then fails with "Missing required product in build". Required for `npm run build`. |
| `Chronicle.Kotlin`, `Chronicle.Elixir`, `Chronicle.TypeScript`, `Arc.Kotlin` | Language tabs and language-specific pages configured in `variant-docs.yml` | Sync warns and leaves those tabs and pages out. |
| `.github` | `/contributing/` and release digests | Skipped. |
| `AuthProxy`, `cli`, `Fundamentals`, `Templates`, `Chronicle.Mcp`, `Architecture`, `Prompter`, `Prologue`, `Screenplay`, `Stage`, `Screenplay.Generation`, `Screenplay.CritterStack`, `Eventmodelers-Build-Kit-CSharp`, `Eventmodelers-Build-Kit-Kotlin`, `Eventmodelers-Build-Kit-Java` | Their product sections | Skipped with a `[sync] SKIP ... source not found` warning. |

Two things about a skipped product can mislead you:

- A skip does not delete output from an earlier sync. If `src/content/docs/<product>/` exists from a previous run, the stale copy is still built.
- When a sibling is missing, sync looks for a fallback folder inside this repository (`GitHubLanding` for `.github`, the same name for the rest). Several products (Chronicle, Arc, Components, Fundamentals, Samples, CLI and others listed in `.gitmodules`) are Git submodules there. They are empty until initialized and pinned to older commits when they are, so prefer sibling clones.

The site shows whatever branch each sibling has checked out. Nothing in this repository switches branches for you, and you should not switch a sibling's branch just to preview the site. That checkout may hold work in progress, yours or another session's. To see what you are about to preview, run this read-only command from `web/`:

```bash
for r in Chronicle Arc Components Samples; do printf '%s: ' "$r"; git -C "../../$r" branch --show-current; done
```

CI checks the products out on `main` (or on `docs-overhaul` for some products when that branch of this repository is built), so a local preview from other branches can differ from the published site.

## Run the site locally

```bash
cd web
npm install
npm run dev
```

`npm run dev` runs `npm run sync` first. Look for lines such as `[sync] chronicle: <N> pages -> src/content/docs/chronicle` followed by Astro's local URL, normally <http://localhost:4321/>. Open `/chronicle/` as well as the home page to confirm that product content arrived.

To re-sync after editing a product page, without restarting the server:

```bash
npm run sync                               # every product, samples and upgrade paths
node scripts/sync-content.mjs chronicle    # one product only
```

A targeted sync refreshes that product's pages and the sidebar data. It leaves the samples catalog and upgrade paths as they were. Restart `npm run dev` after running a build, because the build's own sync can leave a running dev server serving errors.

## Choose the checks your change needs

Run the checks that cover what you changed, then say which ones you ran and which were skipped.

| You changed | Run from `web/` | What it proves |
| --- | --- | --- |
| A site-level page in `src/content/docs/` | `npm run sync && npm run lint:docs` | No non-descriptive link text, leftover DocFX syntax (`<xref:>`, `[!INCLUDE]`, raw alerts) or TODO/FIXME/TBD markers. Style warnings are reported but do not fail. |
| Any page, frontmatter or MDX | `npm run build` | Frontmatter matches the Starlight schema (`title` is required), MDX compiles, Astro's build-completion hook writes the slugged Markdown mirrors, and the `postbuild` step writes `llms.txt` indexes and redirect stubs. A direct `astro build` skips `postbuild`. A build alone does not run `lint:docs`, the variant-docs check or the link check. |
| Links | `npm run check:links` after a build | Every local `href`, `src` and `srcset` target in the built HTML exists in `dist/` as a file or directory index. Query strings and `#` fragments are stripped before the lookup, so a link to a missing heading anchor still passes. |
| A product page (in its own repository) | That repository's gate if it has one (often `Documentation/verify-markdown.sh`), then `node scripts/sync-content.mjs <product> && npm run lint:docs` | The page converts and lints. Build for rendering. |
| A product `toc.yml` | `node scripts/sync-content.mjs <product>` | Sync exits non-zero when a toc entry points at a page that was not generated. |
| Chronicle or Arc language snippets, or `variant-docs.yml` | `npm run variant-docs:check` | Shared-doc audits and each variant's snippet validator. |
| Anything in `scripts/` | `node --test scripts/*.test.mjs` | The build helpers' own tests, the first check CI runs. |
| `content-redirects.yml` | `npm run build` | The post-build redirect step fails on a redirect that points nowhere. |
| API reference inputs | `npm run build:api` | See [API reference and Storybook](#api-reference-and-storybook). |

Astro's build-completion hook writes slugged `/path.md` mirrors for page actions and copies supporting documentation assets (images, HTML coverage reports and their scripts and styles), even when you invoke `astro build` directly. `npm run build` also runs the `postbuild` step to generate the AI indexes (`llms.txt`) and content redirects; a direct Astro build does not run that npm step.

`npm run check` runs `build`, `variant-docs:check`, `lint:docs`, `check:links`, `lint:prose`, `lint:markdown` and `check:external`, in that order. It does not run the script tests, the API reference build or the Storybook builds. Links into `/api/` and `/storybook*/` resolve only when `public/api/` and `public/storybook*/` exist, so a checkout that has never built them can report those links as broken.

### What CI runs

`.github/workflows/docs-site.yml` runs on pull requests to `main`, on pushes to `main` and `docs-overhaul`, on manual dispatch, and when a product repository sends `build-docs`. After checking out every product and building both Storybooks, it runs:

1. `node --test scripts/*.test.mjs`
2. `npm run build:api`
3. `npm run sync && npm run lint:docs`
4. `npm run variant-docs:check:ci`
5. `npm run build`
6. `npm run check:links`

The site deploys to GitHub Pages only from `main`. CI does not run `lint:prose`, `lint:markdown` or `check:external`.

### Optional tools and what their skips mean

Several checks depend on tools that are not npm dependencies. When a tool is missing, the check prints a skip message and exits successfully. A skipped check has not passed, so report it as skipped.

| Tool | Used by | When it is missing | When it is present |
| --- | --- | --- | --- |
| [Vale](https://vale.sh) | `npm run lint:prose` | "Vale not installed — skipping" | Prose alerts are advisory. A Vale configuration or execution error fails. |
| [markdownlint-cli2](https://github.com/DavidAnson/markdownlint-cli2) | `npm run lint:markdown` | "markdownlint-cli2 not installed — skipping". It is looked up in `node_modules/.bin` or on `PATH`. | Findings are advisory and never fail the run. |
| [lychee](https://lychee.cli.rs) | `npm run check:external` | "lychee not installed — skipping" | External link failures are advisory. |
| Chrome or Chromium | Mermaid pre-rendering during `npm run build`; `scripts/screenshot.mjs` | Diagrams render in the browser instead of at build time. Set `CHROME_PATH` if Chrome is installed somewhere unusual. | Diagrams ship as inline SVG. |
| Python 3, plus each client's toolchain | Snippet validators in `npm run variant-docs:check`, started with the command declared in `variant-docs.yml` in the owning checkout (usually `python3 Documentation/validate-client-snippets.py`; Arc Kotlin uses `validate-doc-snippets.py`) | A missing `python3`, Java runtime (Kotlin and Java), `mix` (Elixir) or `dotnet` (Arc C#) is reported as "blocked by missing local toolchain", and the check passes with a warning. `variant-docs:check:ci`, used in CI, fails instead. Any other validator error fails in both modes, including a missing .NET SDK for Chronicle's C# snippets or missing Chronicle.TypeScript dependencies. | Coverage depends on the validator. Chronicle's client validators and Arc's C# validator compile supported snippets. Arc Kotlin checks source contracts, not compilation; its sample tests cover runnable behavior. |

`npm run build:api` has no skip path. It throws when the .NET SDK, DocFX, compiled assemblies or TypeScript inputs are missing.

## Add or change a page

**Product page.** Edit the Markdown in the product repository's `Documentation/` folder and add new pages to that folder's `toc.yml`. Re-sync and check the page locally. Commit in the product repository. Product repositories such as Chronicle and Arc trigger a site build when their `Documentation/**` changes on `main`. The change is live once that build has deployed, not when the merge lands.

**Site-level page.** Edit or add the file under `src/content/docs/` and give it a `title` in frontmatter. Adding it to the site-level navigation in `astro.config.mjs`, or reorganizing navigation, is a separate decision. Make it only when that is what you set out to do.

**Moving a published page.** Add an entry to `content-redirects.yml` so the old URL keeps working.

Page types, voice, frontmatter, asides, components and link conventions are covered by the rules and skills in the next section.

## Use the installed documentation skills

This repository has the Cratis AI corpus installed in `.cratis/ai/`, with the `cratis/documentation` and `cratis/engineering/typescript` profiles selected in `.cratis/ai.json`. The harness folders link to it: `.claude/skills`, `.agents/skills`, `.cursor/skills`, `.github/skills` and `.pi/skills` all point at `.cratis/ai/skills`, and `.github/instructions` points at `.cratis/ai/rules`. An assistant working in this repository picks the skills up without extra setup. You can also read them as plain Markdown.

Project context starts at `AGENTS.md` (a link to `.cratis/ai/rules/project.md`, as is `CLAUDE.md`), which points to the four project concerns in `.cratis/ai/rules/project/`.

| Skill (`.cratis/ai/skills/<name>/SKILL.md`) | Use it when you |
| --- | --- |
| `cratis-documentation-writing` | Plan or review a page: its reader, its Diátaxis type and its route through the site. `references/cratis-site.md` describes this site's teaching components and conventions. |
| `cratis-engineering-docs-authoring` | Draft a page once you know the reader, the owning source and the product evidence. |
| `cratis-technical-examples` | Add or review a code sample, snippet or command/output pair and need to verify it against real source. |
| `cratis-writing-voice-and-cadence` | Edit existing prose for voice without changing what it claims. |
| `cratis-llm-friendly-documentation` | Change `llms.txt`, the Markdown mirrors or the focused sets in `scripts/llm-sets.mjs`. |
| `cratis-release-notes` | Write release notes or upgrade guidance. |
| `chronicle-client-docs` | Edit a Chronicle page with client language tabs, add a Chronicle client, or run the snippet checks. This skill is project-owned. |

The documentation rules in `.cratis/ai/rules/` apply to `**/Documentation/**/*.{md,mdx}`: `documentation.md`, `writing-cratis-docs.md`, `documentation-structure-and-formatting.md`, `editing-cratis-docs.md` and `writing-correct-examples.md`. The `write-documentation` and `check-doc-drift` prompts are available as commands in harnesses that support them.

Files marked `cratis-ai-managed` are updated through `cratis ai update`, after `cratis ai update --dry-run` has shown what would change. Do not edit them by hand. `.cratis/ai/rules/project.md`, `.cratis/ai/rules/project/` and the `chronicle-client-docs` skill belong to this repository.

## API reference and Storybook

CI builds these before the site, and they are served under `/api/`, `/storybook/` and `/storybook-arc/`.

| Command | Builds | Needs |
| --- | --- | --- |
| `npm run build:api` | The .NET API reference (DocFX, from `api-build/`) and the TypeScript reference for `@cratis/arc`, its React, MVVM and Vite packages, and `@cratis/fundamentals` (TypeDoc), into `public/api/` | The .NET 10 SDK (this repository's `global.json`), DocFX as a .NET tool, and sibling `Chronicle`, `Arc` and `Fundamentals` checkouts. It builds the referenced projects in Release with warnings as errors. |
| `npm run build:storybook` | The Components Storybook, into `public/storybook/` | A sibling `Components` checkout with its dependencies installed, and Node 23 or newer. |
| `npm run build:storybook:arc` | The Arc React Storybook, into `public/storybook-arc/` | A sibling `Arc` checkout with `Source/JavaScript` dependencies installed. |
| `npm run build:storybooks` | Both Storybooks | Both of the above. |

`build:api` replaces `public/api/` only after the new output passes its link check; a failed run leaves the previous output in place. `api-build/index.md` is the landing page of the .NET reference.

## Visual checks

`scripts/screenshot.mjs` drives the system Chrome to capture a full page in light or dark mode, with no extra dependency:

```bash
node scripts/screenshot.mjs http://localhost:4321/chronicle/ /tmp/chronicle-dark.png dark
```

Run one capture at a time, because parallel runs collide on the debugging port.

## Branding

The Cratis mark is `src/assets/cratis-mark-light.svg` and `src/assets/cratis-mark-dark.svg`. Accent colors are set in `src/styles/cratis.css`.
