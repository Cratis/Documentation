---
applyTo: "web/**/*.{js,mjs,ts,astro,json,md,mdx}"
paths:
  - "web/**"
---

# Astro/Starlight exact public-surface rules

The deployed cratis.io site is an exact projection, not a broad documentation
crawl.

## Publication source

- `web/public-surface.json` owns the admitted route, source repository/path,
  reviewed revision, SHA-256, claim IDs, sitemap flag, and exact static files.
- `web/scripts/sync-public-content.mjs` validates and materializes only that
  manifest. Unknown routes, source/hash drift, Draft content, CLM-010 matrix
  wording, symlink escapes, search/machine output, and policy differences fail.
- `web/src/content/docs/`, `web/src/generated/`, and `web/.public-approved/` are
  disposable outputs. Never edit or commit them.
- Site-owned source lives in `web/src/public-pages/`; product source stays in the
  owning product repository.
- `npm run sync:authoring` is broad, nondeployable authoring only.

## Native Markdown and MDX contract

Exact-production source is copied byte-for-byte. It does not receive the legacy
DocFX conversion pipeline.

Every admitted page must therefore:

- use Starlight frontmatter with at least `title` and a bounded `description`;
- omit a body H1 because Starlight renders the frontmatter title;
- start body sections at H2;
- use native Starlight aside syntax and root-relative trailing-slash links;
- use `.mdx` when importing Starlight or custom components;
- avoid DocFX alerts, xrefs, includes, `.md` URL suffixes, and relative product
  assets; and
- keep every component-emitted link inside the manifest route set.

## Product landing pages

Product overviews use the tour pattern where it helps readers:

- `TopicHero` for exact product identity and one bounded reader job;
- Starlight `CardGrid`, `Card`, `LinkCard`, and `Steps`;
- `SimpleCard` only with page-supplied wording and admitted links;
- `FullStackTabs` only for source-verified paired examples.

Do not use `RotatingHero`, `StackJourney`, `StackDiagram`, or Storybook embeds in
the current eight-route manifest. They own excluded claims/routes/artifacts.

## Build and deployment

- `npm ci && npm run check` is the authoritative local and CI gate.
- Astro/Starlight is the authoritative MDX parser and component resolver.
- Rendered-link validation catches links emitted from MDX components.
- Pagefind, llms files, page actions, raw Markdown mirrors, Storybooks, and API
  sites remain disabled until separately admitted.
- Pull requests validate reviewed product revisions with read-only credentials.
- Main deployment checks product `main` bytes and fails on hash drift.
- Pages/OIDC permissions exist only in the main-only deploy job.

Never weaken a route, claim, hash, artifact, or deployment check merely to make a
build green.
