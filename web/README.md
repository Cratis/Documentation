# Cratis documentation site

The cratis.io site is built with Astro Starlight. Product repositories own their technical documentation; this repository owns the exact reviewed projection that may be rendered and deployed.

## Production boundary

[`public-surface.json`](./public-surface.json) is the fail-closed deployment manifest. Every public route names:

- one source repository and relative path;
- the exact SHA-256 of the reviewed source;
- the generated content path and public route;
- the Approved claim IDs used by the page; and
- whether search, machine exports, and sitemap inclusion are allowed.

`scripts/sync-public-content.mjs` rejects unknown repositories, unsafe paths, duplicate routes, stale hashes, Draft sources, unapproved claim IDs, and CLM-010 wording. It materializes only allowlisted content and static assets.

The deployed site currently keeps Pagefind, `llms.txt`, `llms-full.txt`, page actions, raw Markdown mirrors, Storybooks, and generated API-reference sites disabled. Re-enable any of them only after their exact output tree is included in the same reviewed manifest boundary.

## Required sibling layout

Production sync needs the allowlisted product repositories next to Documentation:

```text
<parent>/
├── Documentation/
├── Chronicle/
├── Arc/
├── Components/
└── cli/
```

Use the branch whose source hashes are recorded in the manifest. Production uses merged `main` revisions.

## Install and run

Node.js 23 or newer is required.

```bash
cd Documentation/web
npm install
npm run dev
```

The predev hook runs the exact production sync before starting Astro at `http://localhost:4321`.

## Synchronization modes

```bash
npm run sync             # exact production manifest only
npm run sync:authoring   # broad local authoring; never deploy this output
```

`sync:authoring` exists for working on product documentation before admission. Its generated pages, topics, and assets are not publication authority.

## Verification

Run the complete gate:

```bash
npm run check
```

A successful check:

- validates every source and static-file digest;
- materializes only the exact public routes;
- builds the Starlight site;
- verifies the claim-contained front page, title, description, canonical links, and complete Approved sentences;
- confirms CLM-010, Pagefind, machine exports, and raw Markdown mirrors are absent;
- compares internal links with the built route set; and
- runs documentation, prose, Markdown, and external-link checks.

The deployment workflow runs the same command. Pull requests validate only. Merges to `main` build and deploy the exact `dist` artifact to GitHub Pages.

## Add or change a public page

1. Edit the owning product documentation.
2. Complete product, claim, privacy/provenance, and public-sanitization review.
3. Add the exact source path, SHA-256, route, claim IDs, and output controls to `public-surface.json`.
4. Add navigation generated from the same manifest only.
5. Run `npm run check` from a clean sibling layout twice.
6. Merge the owning product source before the dependent Documentation manifest change.
7. Record the deployed URL/revision and withdrawal owner after publication.

Do not edit `src/content/docs/`, `src/generated/`, or `.public-approved/` directly. They are disposable projections.

## Site-owned pages and assets

- Reviewed site-owned source lives in `src/public-pages/`.
- Theme-adaptive marks live in `src/assets/` and are bundled by Astro.
- Exact static public files are copied from `public/` into `.public-approved/` only when their hashes appear in the manifest.
- Product source remains in each owning repository.

## Broad authoring pipeline

`scripts/sync-content.mjs`, sample synchronization, Chronicle client-doc audits, Storybook builders, DocFX, and TypeDoc remain available for nondeployable authoring and validation. Their outputs must not be copied into the deployed public directory without explicit route/artifact admission.
