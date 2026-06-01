# Cratis Stack + site-owned content — migration plan

**Scope:** everything the **Documentation repo itself owns** — the cross-product narrative and the site shell. These pages are authored directly in `Documentation/web/src/content/docs/*.{md,mdx}` (NOT synced from a product repo) and wired in `astro.config.mjs`. This is the connective tissue: it's what makes the products feel like one platform.

## What's here

- `index.mdx` — the **splash front door** (hero, quickstart, the full-stack slice, CQRS loop, comparison table, CTAs).
- `cratis-stack.mdx` — the **"Cratis Stack" hero topic** (tours design → build → operate, AI woven in).
- `why-cratis.mdx` — the boundary narrative ("use them standalone or together", decision table, pluggable persistence).
- `adopting-cratis.mdx` — greenfield + brownfield adoption flowchart.
- `ai-native-development.mdx` — build-side `.ai` skills/agents + operate-side `cratis init` + the Chronicle MCP server.
- `studio.mdx` — Studio vision page (an **independent Event Modeling / Event Storming canvas that generates type-safe C#** — NOT a runtime inspector; "coming soon").
- `glossary.md` — one-term-one-definition across products.
- `comparisons/{marten,wolverine,kurrent}.md` + the CRUD/MediatR bridges.
- `build-a-full-app.mdx` — the cross-product **capstone** walkthrough.
- `samples.mdx`, `api-reference.md`, `404.md`.

## Status

- ✅ Front door, cratis-stack hero, why-cratis, adopting-cratis, ai-native-development, studio (corrected), glossary — all built and on-brand.
- ✅ Visual polish done this overhaul (diagrams, hero depth, cards, inline code, fonts/CLS, build-time Mermaid).
- 🟡 Comparisons — exist but **flagged inaccurate**.
- 🟡 Capstone — written; needs a verified runnable sample.

## Remaining tasks (prioritized)

- [ ] ⬜ **Rewrite the comparison pages** (`comparisons/{marten,wolverine,kurrent}`) against how those tools work **today** — verify every claim against the local `~/src/repos/marten` + `~/src/repos/wolverine` (their *current* docs/source) and current Kurrent/EventStoreDB. They're "not very accurate" — fix the factual drift. (Also re-check the CRUD/EF and MediatR/MVC bridges.)
- [ ] 🟡 **Cratis Stack tour depth** — the landing tours at altitude; consider deeper per-chapter pages (model in Studio → generate → build with Arc/Chronicle/Components → operate with CLI/Workbench), reusing `TopicHero`/`StackDiagram`/`FullStackTabs`. **Beware duplicating the tutorials** — link out to them.
- [ ] 🟡 **The Arc+Chronicle combination** — when the Arc tutorial goes Chronicle-free (see `../Arc/`), the *combination* story lands here / in the capstone. Coordinate with whoever owns Arc.
- [ ] 🔧 **Capstone runnable sample** — a verified, building Studio/Ada-grade sample app behind `build-a-full-app.mdx` (use Studio / Ada as the quality bar, **not** Samples/Library).
- [ ] 🔧 **API reference generation** — .NET DocFX over ~7 assemblies + TS TypeDoc over `@cratis/*`. Orientation page exists (`api-reference.md`); needs the assemblies/packages built.
- [ ] 🔧 **Deploy / cutover** — `Documentation/.github/workflows/docs-site.yml` is ready; needs **GitHub Pages enabled + a `DOCS_CHECKOUT_TOKEN` secret**. If serving under `cratis.io/docs`, set `base: '/docs'` in `astro.config.mjs`. The old DocFX site stays live until cutover.
- [ ] 🟡 **Foundation/QA tooling** — Vale/markdownlint/lychee are wired but skip unless installed; install them in CI to activate. Evaluate **Doc Detective / Squidler** (automated example testing) to enforce snippet correctness in CI.

## Owns the site shell too

This folder also owns the cross-cutting site bits: `web/src/components/` (TopicHero, SimpleCard, FullStackTabs, …), `web/src/styles/cratis.css` (the brand theme), `web/scripts/` (sync-content, mermaid-prerender, the linters, screenshot), and `astro.config.mjs`. Changes here affect every page — verify in light + dark and keep the gate green.

## Definition of done

- [ ] Comparison pages are accurate against today's tools.
- [ ] Capstone has a runnable sample (or it's explicitly post-launch).
- [ ] Deploy works end-to-end (Pages + secret + workflow green).
- [ ] Front door + every site-level page reviewed in light + dark; `npm run check` green.
