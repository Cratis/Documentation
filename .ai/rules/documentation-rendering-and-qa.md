---
applyTo: "web/**/*.{astro,css,md,mdx,js,mjs,ts}"
paths:
  - "web/**"
---

# Documentation rendering and visual QA

A successful build proves syntax and route integrity, not a professional reader
experience. Review rendered output for every changed admitted route.

## Required rendered checks

1. Run the exact production build:

   ```bash
   cd web
   npm ci
   npm run check
   ```

2. Serve the built site with `npm run preview`.
3. Capture every admitted route in light and dark mode.
4. Capture `/`, each product landing, and `/404.html` at a mobile width.
5. Verify keyboard traversal, visible focus, heading order, descriptive links,
   table/code overflow, diagram readability, and no image-dependent meaning.
6. Verify reduced-motion mode and no carousel/ambient motion requirement.
7. Check first load for font/image/layout shift.

Use `web/scripts/screenshot.mjs` for reproducible screenshots when available.
Screenshots are local review evidence and are not committed unless their exact
public asset/provenance path is separately admitted.

## Preserve current rendering safeguards

- Keep the custom `Head.astro` font preload and `font-display: optional` behavior.
- Keep Mermaid build-time rendering and `autoTheme: false`; light/dark colors are
  handled by CSS variables.
- Keep the theme-adaptive Cratis marks and an empty alt only when the mark is
  decorative and equivalent text is present.
- Keep product pages useful without JavaScript.

## MDX component review

- `TopicHero` and `SimpleCard` are render-only and safe when all text/links come
  from the page.
- Starlight `Card`, `CardGrid`, `LinkCard`, `Steps`, `Tabs`, and `Aside` are
  preferred for native behavior.
- Validate icon names during Astro build.
- Inspect component output in final HTML; source-only Markdown link scans are not
  sufficient.
- Do not hide claim text, links, or product relationships inside imported
  components that are not included in the manifest review.

## Failure handling

Block the candidate on broken layout, unreadable contrast, inaccessible focus,
mobile overflow, missing content without JavaScript, diagram failure, unexpected
route/link output, or material layout shift. Fix the source or component; do not
waive the public-surface gate.
