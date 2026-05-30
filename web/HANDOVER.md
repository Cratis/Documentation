# Cratis documentation overhaul — handover

> Read this first if you're continuing the Cratis docs overhaul in a fresh session.
> It captures the goal, the current state, how the site is built, how to run and verify it,
> the writing bar, what's done, what's next, and the gotchas that will bite you if you don't know them.

## 1. The goal

Make the Cratis documentation **excellent and launch-ready** for a worldwide .NET podcast (≈ mid-June 2026) that will drive a spike of evaluators. The bar: an **Aspire-class** experience — a newcomer goes *why → running → building real things → reference* on a guided path; novices and experts both have an on-ramp; the docs feel like a **guided tour** (Marten/Wolverine/Aspire style), not a reference dump.

Scope is the hero stack — **Chronicle** (event sourcing), **Arc** (full-stack CQRS framework), **Components** (React) — plus **CLI**, **Fundamentals**, and **Contributing**. The differentiator we lead with everywhere: Cratis is **full-stack and type-safe** (C# → generated TS → React); the alternatives stop at the backend.

Full approved plan: `/Users/sindrewilting/.claude/plans/zesty-pondering-fog.md`.

## 2. Current status

A modern **Astro Starlight** site lives in `Documentation/web/`. It aggregates all product docs and builds clean:
**~647 pages · 0 lint errors · 0 broken internal links** (verified by two custom gates).

All six products are migrated and on a consistent, curated **Diátaxis** navigation. ~45 pages were hand-written/rewritten (front door, why-pages, threaded tutorial, scenarios, recipes, "coming from X" bridges incl. Marten/Wolverine/Kurrent comparisons, glossary, architecture, deep dives, troubleshooting, CLI landing). Everything is committed on `docs-overhaul` branches; **nothing is pushed**.

## 3. Run & verify locally

**Prerequisites**
- Node 20+.
- The product repos cloned as **siblings** of this repo, all on the `docs-overhaul` branch:
  `<parent>/{Documentation, Chronicle, Arc, Components, Fundamentals, cli, .github}`.
  (`Arc` = the `Cratis/ApplicationModel` repo cloned as `Arc`; `.github` = `Cratis/.github`.)

```bash
cd Documentation/web
npm install
npm run dev          # http://localhost:4321  (sync + dev server)
npm run check        # build + lint:docs + check:links  — the full gate
```
`npm run check` must end with `Complete!`, `0 error(s), 0 warning(s)`, and `0 broken`. Verification checklist is in `Documentation/web/README.md`.

## 4. Repos & git state

Work spans these repos, each on branch **`docs-overhaul`**, all **committed, none pushed**:
`Documentation` (the site), `Chronicle`, `Arc`, `Components`, `Fundamentals`, `cli`, `.github`.
(`Samples` and `Templates` are branched but unchanged so far.)

To push / open PRs when ready, use the **ship-changes** skill. Per project preference, **do not push/commit without explicit approval** — the user has been approving commits explicitly.

## 5. How the site is built (architecture)

**Content source of truth = each product repo's `Documentation/` folder.** The site does not own the content; it converts it at build time.

- `web/scripts/sync-content.mjs` reads each product's `Documentation/` (resolved as a **sibling** clone first, falling back to a git submodule) and converts DocFX-style Markdown into Starlight content under `web/src/content/docs/<product>/`. **Those generated dirs are git-ignored — never edit them by hand.** Edit the source in the product repo and re-sync (`npm run sync`).
- The conversion handles: frontmatter (parses YAML, keeps `title`/`description`/`sidebar`, drops DocFX keys like `uid`), DocFX alerts (`> [!NOTE]` → `:::note`), `<xref:>` and `[text](xref:UID)`, `[!INCLUDE]` (inlined), `.md`/`toc.yml` link stripping, and **slug normalization** of link paths.
- **Sidebar** is generated from each product's `toc.yml` into `web/src/generated/sidebar.json` (git-ignored), imported by `astro.config.mjs`. Chronicle/Arc/Components are grouped into **Diátaxis buckets** via per-product `buckets` config in `sync-content.mjs` (`applyBuckets`). Components/Chronicle/Arc use `sidebarMode: 'toc'`; the converter validates every sidebar slug against actually-built pages and drops broken toc entries.
- **Site-level pages** (not owned by any product) are authored directly in `web/src/content/docs/` as `.mdx`: `index.mdx` (front door), `why-cratis.md`, `build-a-full-app.mdx` (capstone walkthrough), `samples.mdx`, `api-reference.md`, `404.md`, and `comparisons/` (Marten/Wolverine/Kurrent). Top-level nav for these is prepended in `astro.config.mjs` (`sidebar.unshift(...)`).
- **Quality gates** (both wired into `web/.github`-style CI workflow `Documentation/.github/workflows/docs-site.yml`, and as npm scripts):
  - `npm run lint:docs` (`scripts/lint-docs.mjs`) — fails on non-descriptive link text (`[here]`, `[see documentation]`) and leftover DocFX-isms (`<xref:`, `[!INCLUDE]`, unconverted alerts).
  - `npm run check:links` (`scripts/check-links.mjs`) — verifies every internal link resolves to a built page (Starlight doesn't). Hard gate; currently 0 broken.
- Plugins: `starlight-llms-txt` (generates `/llms.txt`), `astro-mermaid` (diagrams), Pagefind search (built in). Branding: `web/src/assets/cratis-mark-{light,dark}.svg` + accent/ToC/sidebar polish in `web/src/styles/cratis.css`.

## 6. What's done

- **Platform**: Starlight site, real Cratis logo (theme-adaptive), Pagefind search, `llms.txt`, Mermaid, ToC capped to H2 + compacted, refined sidebar category labels.
- **All 6 products migrated** with curated, bucketed Diátaxis nav.
- **Onboarding**: front door (C#↔TS tabs, product cards incl. CLI, comparison table), getting-started for each product, a **guided-tour Chronicle tutorial** (4 chapters), cross-product capstone walkthrough, Samples gallery.
- **Explanation**: Why Cratis/Arc/Components, glossary, architecture (diagrams), observer/reactor/reducer guide, modeling-events, designing-read-models, consistency deep dive, vertical-slices ("why backend+frontend together"), when-to-use.
- **How-to**: Chronicle scenarios (6), Components recipes (4), Arc authorization recipe, Chronicle + Arc troubleshooting.
- **Comparisons & migration**: "How Cratis compares" + per-tool pages for **Marten, Wolverine, Kurrent/EventStoreDB** (verified against the local Marten/Wolverine checkouts + EventStoreDB client API), plus CRUD/EF and MediatR/MVC bridges.
- **Diagrams** on the front door, capstone, architecture, tutorial, and every core concept landing.
- **The `.ai/rules/documentation.md` rule was rewritten** to encode the new standards (Diátaxis, onboarding, link-text, snippets-from-source, llms.txt).

## 7. The writing bar — IMPORTANT

The user's strongest qualitative feedback: **the docs must take the reader on a tour, like a teacher** — Marten/Wolverine/Aspire style — not state facts like a reference. The tour-style checklist is saved in memory (`feedback_docs_content_patterns.md`). In short:
1. Open with a concrete scenario, not a definition. 2. Name the friction, then the relief. 3. "Let's…" with chronological verbs. 4. After code, **explain the invisible**. 5. Recap before pivoting. 6. Anticipate doubt with asides. 7. **Show the result**. 8. Steps/Tabs/asides/diagrams; organize by workflow. 9. Forward link at the end of every section.

The **Chronicle tutorial** (`Chronicle/Documentation/tutorial/*`) is the reference example of this voice — match it.

**Inspiration is cloned locally — study it, don't guess:**
- `~/src/repos/aspire.dev/src/frontend/src/content/docs/` — the gold standard. `.mdx` with `<Steps>`, `<Aside>`, `<Code title=... />`, `OsAwareTabs`, `LearnMore`, expected-output blocks (`data-disable-copy`), architecture-diagram-first. See `get-started/install-cli.mdx` and `get-started/what-is-aspire.mdx`.
- `~/src/repos/marten/docs` and `~/src/repos/wolverine/docs` — the "walking you through" tutorials.

## 8. In-flight / next steps (do these next)

1. **Tour-voice pass on the getting-started pages** (Chronicle, Arc backend+frontend, Components, CLI) and the Why pages — bring them to the tutorial's tour standard, modeled on aspire.dev's `install-cli.mdx` / `what-is-aspire.mdx`.
2. **Enable MDX in product pages so they can use `<Steps>`/`<FileTree>`/`<Tabs>`/`<Aside>` like Aspire.** Currently `sync-content.mjs`'s `walk()` renames `.mdx`→`.md`, so product pages can't use components. Change it to **keep `.mdx` as `.mdx`** (the converter's transforms are safe on authored MDX), then author the getting-started pages as `.mdx` with Steps + titled code blocks + expected-output. (Site-level pages are already `.mdx` and use components.) Verify the build + gates after.
3. Optionally adopt an Aspire-style `OsAwareTabs`/`LearnMore` component or use Starlight's built-in `<Tabs>`/`<LinkCard>`.

## 9. Remaining work that needs YOUR environment (can't be done headless)

Tracked in `web/KNOWN-ISSUES.md`:
- **API reference generation** — .NET (DocFX over ~7 assemblies) + TS (TypeDoc over the `@cratis/*` packages). Needs the assemblies/packages built; verified twice it can't run without deps. An `api-reference.md` orientation page exists and links the packages.
- **Storybook embed** for Components — needs a deployed Storybook URL to iframe.
- **Runnable capstone sample app** — the `build-a-full-app` walkthrough is written; a verified building sample (Ada/Studio-grade) is a follow-up. Use **Studio** (`/Volumes/sourcecode/repos/cratis/Studio`) and **Ada** (`/Volumes/sourcecode/repos/hive/Ada`) as the quality reference — NOT `Samples/Library` (the user said it isn't good).
- **Deploy / cutover** — `docs-site.yml` workflow is ready; needs GitHub Pages enabled + a `DOCS_CHECKOUT_TOKEN` secret. The old DocFX site (`Documentation/Source/`) stays live until cutover. If serving under `cratis.io/docs`, set `base: '/docs'` in `astro.config.mjs`.

## 10. Gotchas (hard-won — read before editing)

- **Link rules differ by page type.** Product-repo pages go through the converter (it strips `.md`/`toc.yml`), so `[x](./foo.md)` is fine there. **Site-level `.mdx` pages do NOT** — write clean URLs (`/comparisons/marten/`, `./marten`), never `.md`. Run `npm run check:links` after any link change.
- **Astro slug rules** (replicated in `slugify`): lowercase, **strip dots** (`react.mvvm` → `reactmvvm`), keep `-`/`_`. Cross-product links use root-relative `/chronicle/...`.
- **Sections whose landing is `overview.md` (no `index.md`)** 404 on the bare URL (e.g. `arc/backend/tenancy/`) — link to the specific page.
- **The CLI is an operate/explore tool**, not a scaffolder. Don't invent `cratis new`/`run`. Real commands: `cratis get-started`, contexts, event/observer/read-model inspection, `cratis init` (AI tooling). Scaffolding is `dotnet new` templates (`Templates` repo).
- **Code examples must match real APIs** — verified ones: `[Command]`+`Handle()` on the record, `[EventType]`, `[ReadModel]`+`[FromEvent<T>]`, `collection.Observe()` returning `ISubject<>`, `[Roles(...)]`. Verify against **Studio** source (`/Volumes/sourcecode/repos/cratis/Studio/Source`) before writing C# snippets (the Ada checkout has moved).
- **Never edit `web/src/content/docs/{chronicle,arc,components,cli,fundamentals,contributing}/`** — generated. Edit the product repo source.
- **Don't push or open PRs without explicit approval.**

## 11. Key references

- Plan: `/Users/sindrewilting/.claude/plans/zesty-pondering-fog.md`
- Memory (loaded each session): `docs-overhaul-project`, `feedback_docs_content_patterns` (tour checklist), `cratis-good-app-references` (Studio/Ada), `feedback_no_auto_commit`.
- This file: `Documentation/web/HANDOVER.md`. Site guide: `Documentation/web/README.md`. Known issues: `Documentation/web/KNOWN-ISSUES.md`.
- Inspiration: `~/src/repos/aspire.dev`, `~/src/repos/marten`, `~/src/repos/wolverine`.
- The authoring rule: `.ai/rules/documentation.md` (in each product repo via symlink; canonical in `.ai/`).
