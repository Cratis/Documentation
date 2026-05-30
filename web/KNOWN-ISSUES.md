# Known issues

## Internal links — clean ✅

The site currently has **zero broken internal links** (`npm run check:links` passes across
1,600+ links). The check **gates the CI build**, so any newly introduced broken link will
fail CI rather than ship silently.

If you add content and the check fails, fix the link in the source `Documentation/` folder
it points from, then re-run `npm run check:links` (after `npm run build`).

## Tracked for follow-up (need a build environment)

These are not content issues — they require running tools the docs build doesn't run locally:

- **API reference generation** — .NET (DocFX over the client/Arc/Fundamentals assemblies)
  and TypeScript (TypeDoc over the `@cratis/*` packages). See `api-reference` page and the
  `docs-site.yml` workflow notes.
- **Storybook embed** — needs a deployed Storybook URL to iframe into the Components pages.
- **Runnable capstone sample** — the `Build a full-stack feature` walkthrough is written;
  a verified, building sample app is a follow-up.
- **Deploy / cutover** — the `docs-site.yml` workflow is ready; needs GitHub Pages enabled
  and a `DOCS_CHECKOUT_TOKEN` secret.
