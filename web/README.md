# Cratis documentation site

The Cratis documentation site, built with [Astro Starlight](https://starlight.astro.build/). It aggregates the documentation from each product repository (Chronicle, Arc, Components, Fundamentals) plus the Contributing guide, and presents them as one site.

## Prerequisites

- **Node.js 20 or newer** (CI builds on Node 20).
- **The product repositories checked out as siblings of this repo, all on the `docs-overhaul` branch.** The site reads each product's `Documentation/` folder from a sibling clone, so your layout should be:

  ```
  <parent>/
  ├── Documentation/     ← this repo (the site lives in Documentation/web)
  ├── Chronicle/
  ├── Arc/               ← the ApplicationModel repo, cloned as "Arc"
  ├── Components/
  ├── Fundamentals/
  └── .github/           ← the Cratis/.github org repo (Contributing docs)
  ```

  Put each on `docs-overhaul`:

  ```bash
  for r in Chronicle Arc Components Fundamentals .github; do (cd "$r" && git checkout docs-overhaul); done
  ```

  > If a product repo is missing as a sibling, the converter falls back to that product's git submodule inside this repo — but submodules track `main`, not the in-progress `docs-overhaul` content. Use sibling clones on `docs-overhaul` for now.

## Quick start

```bash
cd Documentation/web
npm install      # first time only
npm run dev      # converts content + starts the dev server at http://localhost:4321
```

Open http://localhost:4321 — you should land on the Cratis home page.

## How content is sourced

Documentation **lives in each product repository's `Documentation/` folder** — that is the source of truth, kept next to the code it documents. A build step converts that DocFX-style Markdown into Starlight content.

- `scripts/sync-content.mjs` reads the product `Documentation/` folders (resolved as siblings of this repo, e.g. `../Chronicle/Documentation`), converts them, and writes the result into `src/content/docs/<product>/`.
- Those generated folders are **git-ignored** — never edit them by hand. Edit the source in the product repo and re-sync.
- The sidebar for Chronicle/Arc is generated from each product's `toc.yml`; it is written to `src/generated/sidebar.json` (also git-ignored) and imported by `astro.config.mjs`.
- Site-level pages that don't belong to a single product (the landing page, `why-cratis.md`) are authored directly in `src/content/docs/` and are tracked in git.

The conversion handles: front matter (adds a `title`), DocFX alerts (`> [!NOTE]` → `:::note`), `<xref:...>`, `[!INCLUDE]`, and `.md`/`toc.yml` link fix-ups.

## Local development

```bash
# from this folder (Documentation/web)
npm install        # first time only
npm run dev        # sync content + start the dev server at http://localhost:4321
```

`npm run dev` and `npm run build` both run `scripts/sync-content.mjs` first (via the `predev`/`prebuild` hooks), so the content is always freshly converted from the product repos.

To re-sync content without (re)starting the server — for example after editing a page in a product repo:

```bash
npm run sync             # all products
node scripts/sync-content.mjs chronicle   # just one product
```

## Verify the build

Before pushing, confirm the site builds cleanly:

```bash
npm run build
```

A successful build:

- converts all products (`[sync] chronicle: N pages ...` etc.),
- reports `0 broken toc entries dropped`,
- ends with `[build] N page(s) built` and `[build] Complete!`,
- generates `/llms.txt` and `/llms-full.txt`, and builds the Pagefind search index.

Two QA scripts back this up:

- `npm run lint:docs` — fails on non-descriptive link text (`[here]`, `[see documentation]`) and any leftover DocFX-isms (`<xref:>`, `[!INCLUDE]`, unconverted alerts). **Gates the build (0 errors required).**
- `npm run check:links` — verifies every internal Markdown link resolves to a real built page (Starlight does not). Run after a build. The site is currently at **zero broken internal links**, and this **gates the CI build** to keep it that way.

`npm run check` runs build + lint + link-check together. Preview the production build locally with `npm run preview`.

## Verify it works locally — checklist

1. **Build + gates pass:** `npm run check` ends with `[build] Complete!`, `0 error(s), 0 warning(s)`, and `Checked … 0 broken`.
2. **Dev server serves:** `npm run dev`, open http://localhost:4321 — the landing page shows the hero and the C#/TypeScript tabs ("One feature, one slice, both ends type-safe").
3. **Navigation:** the sidebar starts with *Why Cratis · Build a full-stack feature · Samples · API reference*, then each product (Chronicle, Arc, Components, Fundamentals, Contributing) with its sections.
4. **Search:** the top-bar search returns results (try "projection").
5. **Diagrams render:** open *Chronicle → Architecture* — the Mermaid diagrams display.
6. **AI export:** http://localhost:4321/llms.txt lists the docs.

## Adding or editing a page

1. Edit (or add) the Markdown in the relevant product repo's `Documentation/` folder — for example `Chronicle/Documentation/concepts/my-page.md`.
2. Add it to that folder's `toc.yml` so it appears in the navigation.
3. Run `npm run dev` (or `npm run sync`) and check it locally.

Follow the documentation conventions in `.ai/rules/documentation.md` (Diátaxis page types, why-first voice, descriptive link text, diagrams for concepts).

## Branding

The Cratis mark lives in `src/assets/cratis-mark-light.svg` and `src/assets/cratis-mark-dark.svg` (theme-adaptive). The accent color is set in `src/styles/cratis.css`.

## API reference & Storybook

The .NET API reference (DocFX) and the Components Storybook are wired separately — see the Reference section. This keeps the "combine tooling" approach: Starlight for narrative docs, the right tool for each generated artifact.
