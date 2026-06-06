# Known issues

## Internal links — clean ✅

The site currently has **zero broken internal links** (`npm run check` passed across
2,185 checked internal links and 710 built pages on 2026-06-06). The check **gates the CI build**,
so any newly introduced broken link will fail CI rather than ship silently.

If you add content and the check fails, fix the link in the source `Documentation/` folder
it points from, then re-run `npm run check:links` (after `npm run build`).

## Tracked for follow-up (need a build environment)

These are not content issues — they require running tools or release steps that the docs build
doesn't fully exercise locally:

- **External-link checker activation** — `lychee` is wired into `npm run check`, but it skips
  when the binary is not installed. Install it locally and in CI when you want external links to
  become a real gate.
- **Prose/Markdown checker activation** — Vale and markdownlint are wired in the same graceful
  pattern, but skip when the tools are not installed.
- **Runnable capstone sample** — the `Build a full-stack feature` walkthrough is written;
  a verified, building sample app is a follow-up.
- **Deploy / cutover** — the `docs-site.yml` workflow is ready; needs GitHub Pages enabled
  and a `DOCS_CHECKOUT_TOKEN` secret.

## Resolved follow-ups

- **API reference generation** — DocFX and TypeDoc are wired via `npm run build:api` and served
  from `/api/`.
- **Storybook embed** — Components Storybook is served from `/storybook/`, and Arc Storybook is
  served from `/storybook-arc/`.
