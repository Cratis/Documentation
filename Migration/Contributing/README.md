# Contributing docs — migration plan

**Scope:** the Contributing guide, treated as a first-class product in the nav. Source lives in the **`Cratis/.github`** repo (cloned as `.github` sibling), under its `Documentation/`-equivalent content; published under `/contributing/**`. This is org-wide contributor guidance (values, building, C#/TS conventions, logging, PRs, code of conduct).

## Status

- ✅ Wired into the nav as a product.
- 🟡 Content migrated from DocFX; mostly reference-toned.

## Remaining tasks (prioritized)

- [ ] 🟡 **Light tour-voice polish** — the landing + values/building pages read like a wall of rules; open with *why we work this way*, then the specifics. Keep it lighter-touch than the product docs (contributors want the rules, not a lesson).
- [ ] 🟡 **Check links + cross-references** — make sure building/consuming-pre-releases/contributing flow links resolve and point at the right places.
- [ ] 🟡 **Align with the `.ai/` rules** — the contributor conventions (C#, TS, specs, commits) overlap with the propagated AI rules; make sure they don't contradict.

## Gotchas

- This content comes from `Cratis/.github`, not a product `Documentation/` folder — edit there. Confirm the sync path in `web/scripts/sync-content.mjs` (the `contributing` product entry).

## Definition of done

- [ ] Landing + key pages have a why-first opening.
- [ ] Links resolve; no contradiction with the `.ai/` conventions.
- [ ] `npm run check` green; reviewed light + dark.
