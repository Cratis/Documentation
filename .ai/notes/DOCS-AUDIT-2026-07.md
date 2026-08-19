> [!NOTE]
> **Historical record — written 2026-07-16. Not a live plan.**
>
> This audit is preserved here as a **record of what the documentation looked like on
> 2026-07-16**, not as a backlog anyone is currently working. It was never tracked in git
> until this commit and sat untracked in a working copy for a month.
>
> **Its findings are largely unaddressed.** A follow-up sweep re-checked the audit's
> concrete claims and found roughly **12 of 49 checks** now passing — and of those, close to
> **0% are attributable to the audit itself**; they were fixed by unrelated work that
> happened to touch the same pages. A spot-check on 2026-08-19 re-verified five of the P0
> findings against the relevant repositories' `main` branches and found **all five still
> open**: Arc's `using OneOf;` in `Documentation/backend/commands/model-bound/index.md`, the
> two "will be documented here" placeholders in `Documentation/backend/proxy-generation.md`,
> the `beforeExecute` (vs `onBeforeExecute`) prop in `form-lifecycle.md`, the "TypeScript 6"
> line in `web/src/content/docs/compatibility.mdx`, and the stale "Latest release digest"
> card in `web/src/content/docs/whats-new.mdx`.
>
> **Treat every specific claim below as dated.** Line numbers, page counts, percentages, and
> file paths were accurate on 2026-07-16 and have drifted since. Re-verify anything before
> acting on it. The audit's *method* and *framing* have aged better than its *citations*.
>
> Kept because the analysis is substantive and re-deriving it would cost more than reading
> it — not because it is current.

# Cratis Documentation Audit — 2026-07-16

A full content, structure, and site audit of the Cratis documentation (the `Cratis/Documentation` Astro Starlight site aggregating Chronicle, Arc, Components, CLI, Fundamentals, Architecture, Screenplay, Prompter, AuthProxy, Contributing) and the live **cratis.io**.

**Method.** Fresh `npm run build` + every QA gate; first-hand link/frontmatter/diagram/heading censuses across all ~873 rendered pages; live-site + external-link probes; design/AI-export review; and five parallel deep-dive audits (one per product area) whose every code claim was verified against product `Source/`. Environment note: product siblings were on feature branches, so local content ≈ but is not identical to production `main`.

---

## Executive summary

**Verdict: a strong, professionally-presented documentation set with an excellent flagship layer — held back by a small number of concrete correctness bugs, one pervasive metadata gap, and structural/IA debt in the machine-converted reference tree.** This is a "raise a good site to a great one" list, not a rescue.

The site is genuinely good where the team invested by hand: the front door, the per-product Overview/"Understanding" pages, the tutorials, and the scenarios read like a real teacher's tour (pain→relief, why-before-how, diagrams, synced C#↔TypeScript). The presentation layer (884-line brand CSS, rich custom components) is well above a default Starlight skin. Build passes; internal-link hygiene is excellent (1 genuinely broken internal link across 339 Chronicle pages).

The weaknesses cluster into five themes:

1. **Copy-paste code bugs** — a few widely-repeated examples don't compile / use removed or invented APIs. Highest severity because readers paste them verbatim.
2. **Systemic metadata gap** — 86% of pages have no `description` frontmatter (SEO, social cards, and the `llms.txt` AI export all read it).
3. **A two-tier quality split** — the hand-authored narrative layer is excellent; the bulk-converted DocFX reference tree is passive-voiced, diagram-less, description-less, and carries structural collisions.
4. **Structure & IA debt** — file-vs-folder URL collisions, orphaned sections, CI artifacts shipped as user docs, and an overloaded top-level nav topic that buries whole products.
5. **The full-stack differentiator is under-shown** — `<FullStackTabs>` (synced C#↔TS), the thing that most distinguishes Cratis, appears on a handful of pages and is absent from the reference where it matters most.

### Scorecard

| Area | Pages | Health | One-line |
|---|---|---|---|
| Front door / homepage | — | ★★★★★ | Strong hero, clear value prop, copy-pasteable quickstart, good CTAs. |
| Design / presentation | — | ★★★★★ | Hand-crafted brand theme + components; a real strength to preserve. |
| Chronicle | 339 | ★★★★ | Excellent where invested; CI artifacts leak, some contradictions, 89% no description. |
| Arc | 266 | ★★★½ | Superb narrative tier; reference tier has 4 URL collisions + 3 wrong code examples. |
| Components | 91 | ★★★½ | Great recipes; ~75 auto-ref pages weaker; removed `primereact/column` import ×9. |
| CLI | 31 | ★★★½ | Strong content, but `scenarios/` + reference landing orphaned from nav. |
| Prompter | 15 | ★★★★★ | Mature, tour-voiced, ready to surface. |
| AuthProxy | 6 | ★★★★★ | Hand-authored, diagrammed, honest security caveats. |
| Screenplay | 19 | ★★★★ | Substantive; "run it live" promise outruns shipped tooling — frame as Preview. |
| Fundamentals | 45 | ★★★ | Modernized landings only; deep `.md` are reference-dumps, ~1 diagram, no descriptions. |
| Architecture | 29 | ★★★ | Correct terse Roslyn-rule reference; thin landing, duplicate index tables. |
| Contributing | 18 | ★★★ | Solid but older; `building.md` omits frontend; release-digests orphaned. |
| IA / navigation | — | ★★½ | Overview topic overloaded (~23 entries); products buried; two "Scenarios". |
| QA tooling | — | ★★★ | Good gates, but 2 of 6 silently no-op locally; `check` needs API+Storybook builds. |

---

## Priority 0 — Correctness & things users hit (fix first)

### P0.1 — Broken / invented copy-paste code
- **[Components · High] Removed `primereact/column` import taught in 9 places.** `Column` is imported from `primereact/column`, but `Components/Source/DataTables/Column.tsx` is the Cratis-owned typed replacement (its own doc-comment says it replaces the *removed* `primereact/column`) and is exported from the `@cratis/components/DataTables` barrel. Readers get a broken import. Locations: `components/displaying-data.md:17`, `components/list-screen-with-actions.md:19`, `components/tutorial/list-it.mdx:18`, `components/tutorial/list-and-detail.mdx:33`, `components/DataTables/data-table-for-query.md:24`, `components/DataTables/data-table-for-observable-query.md:24`, `components/DataPage/index.md:26` & `:57`, `components/DataPage/menu-items.md:13`. **Fix:** `import { Column } from '@cratis/components/DataTables'`.
- **[Arc · High] Invented `CommandResult` API.** `arc/frontend/react/command-form/validation.md` (~392–439) uses `result.hasErrors('email')` / `result.getErrorsFor('email')` and an `errors` map. Verified against `Arc/Source/JavaScript/.../ICommandResult.ts`: only `isSuccess/isAuthorized/isValid/hasExceptions/validationResults/response` exist; `hasErrors`/`getErrorsFor` have zero project hits. **Fix:** use `validationResults` (field errors come from the form context's `getFieldError`).
- **[Arc · High] Wrong form-lifecycle prop.** `arc/frontend/react/command-form/form-lifecycle.md` (~158–171) documents `beforeExecute` returning `Promise<boolean>` to cancel submission. The real prop is `onBeforeExecute` (a value transform, `CommandForm.tsx:313`), not a boolean gate — and `command-form/index.md:69` already lists it correctly. Same page (`:12`) uses the wrong import `@cratis/arc/commands` (core) for a React component → should be `@cratis/arc.react/commands`.
- **[Components · Medium] `column-configuration.md` documents PrimeReact's `Column` surface** (`filterMatchMode`, `filterElement`, `exportable`, `frozen`, `headerStyle`) but shipped `ColumnProps<TData>` is a different curated surface (`dataType`, `showFilterMatchModes`, typed `body`). Rewrite against the real props.
- **[Components · Medium] `Dropdown/index.md:181-192`** uses PrimeReact `<Dialog visible onHide>` (unimported) contradicting the Cratis `Dialog` (`onConfirm/onCancel/onClose`). Use the Cratis dialog.
- **[Arc · Low] `using OneOf;` should be `using Cratis.Monads;`** in `arc/backend/commands/model-bound/index.md:38,65,185` — the `Result<TResult,TError>` guards won't compile as written.

### P0.2 — Factual contradictions & wrong statements
- **[Chronicle · High] Event Revision contradiction.** `chronicle/concepts/event-sequence.md:48-50` says revisions are "not fully implemented yet, there is no API surface"; `chronicle/events/revision.md` documents a working Workbench procedure for the same feature. Reconcile to one truth.
- **[Chronicle · High] Three conflicting "three projection approaches".** `projections/architecture.mdx:9` (PDL/Model-Bound/Declarative) vs `projections/index.md:28` (Model-bound/Declarative/Reducer) vs `projections/choosing-a-read-model-style.mdx` (Model-bound/Declarative/Reducer). Pick one canonical framing; surface PDL (currently orphaned from the landing).
- **[Chronicle · High] `.AutoMap()` taught against the project's own rule + analyzer.** ~10 declarative pages (`projections/declarative/{event-context,from-event-sequence,functions,joins,not-rewindable,passive,remove-with-join,set-properties,index}.mdx`, `model-bound/index.mdx`) call `.AutoMap()` as routine boilerplate, while `projections/declarative/simple-projection.mdx:83` correctly says never to. Remove the routine calls.
- **[Chronicle · Medium] Wrong glossary term.** `chronicle/concepts/glossary.md:85` defines **Subject** as "an observable stream… behind reactive queries" — but the compliance docs and the site glossary define Subject as the PII/GDPR identity. Correct it.
- **[Chronicle · Medium] MongoDB-only claim.** `chronicle/concepts/event-store.md:11-13` presents MongoDB as the only backend, contradicting `index.mdx` + `hosting/configuration/storage.md` (Mongo/Postgres/SQL Server/SQLite).
- **[Site · Medium] `compatibility.mdx:26` says "TypeScript 6"** — Arc ships `typescript 7.0.2` (verified `Arc/package.json`; Fundamentals/Components on 6.0.3). Node ≥23 and Yarn 4.5.3 on that page are correct — leave them.
- **[Site · Medium] `whats-new.mdx` stale.** The "Latest release digest" card points to `2026-05-25-to-2026-06-01`, the 2nd-oldest of 6 digests (newest is `2026-06-22-to-2026-06-29`).
- **[Site · Medium] Studio described in present tense** (`why-cratis.mdx:58`, `cratis-stack.mdx:19`) though it's badged "Soon". Use future framing to match `studio.mdx`'s own honesty.

### P0.3 — Structural collisions, orphans, and shipped placeholders
- **[Arc · High] Four file-vs-folder URL collisions.** A `foo.md` sibling to a `foo/` folder makes the sync demote the folder's `index.md` to `overview.md`, leaving the flat file as the landing: `backend/mongodb.md` (tells readers to "visit /arc/backend/mongodb/" — its own URL; real content orphaned at `/mongodb/overview/`), `backend/proxy-generation/configuration.md` (self-referential "moved" stub), `backend/chronicle/commands.md` ("moved" banner atop 150 lines duplicating `backend/chronicle/commands/`), and `frontend/core/queries.md` (167 lines) vs `frontend/core/queries/overview.md` (22 lines) — two pages titled "Queries", the stale controller-based one is what everything links to. Fix: one shape per section (real `index.md`, delete the sibling).
- **[Chronicle · High] CI artifacts shipped as user docs.** `chronicle/statistics/` embeds a coverage dashboard via raw `<iframe src="coverage.html">` (an unrouted file → 404 in the built site) plus a body-H1. `chronicle/benchmarks/` is raw `index.html` + `data.js` + an 887-line JSON with **no markdown page at all**. Move reporting out of the user docs; drop/replace these entries.
- **[CLI · Critical] `cli/scenarios/` orphaned from the sidebar.** `cli/Documentation/toc.yml` never references `scenarios/toc.yml`, so the four best CLI how-tos are unreachable via nav (only inline links). Also **`cli/reference/index.md` is orphaned** (`reference/toc.yml` omits it). Add both to their tocs.
- **[Arc · High] Live placeholder text in a shipped page.** `arc/backend/proxy-generation.md:79,83` — "Configuration details… will be documented here." / "Usage examples… will be provided in this section." Write the content or remove the headings.
- **[Chronicle · Critical] Live "in progress" banner.** `chronicle/projections/immediate-projections.md` opens "This documentation is in progress and will be updated soon" over one-sentence sections, yet is linked as a real topic. (Body is ~half-written; finish it, add a sync-vs-eventual diagram + "when not to use", drop the banner.)
- **[Chronicle · Medium] The one genuinely broken internal link:** `chronicle/clients/kotlin/get-started/index.md:12` → `/chronicle/clients/kotlin/./` (stray `.`).

---

## Priority 1 — Systemic hygiene (do in bulk)

- **[All · High] `description` frontmatter missing on 747 of 873 pages (86%).** Per area: Chronicle 301/339, Arc 229/266, Components 77/91, Fundamentals 44/45, CLI 29/31, Architecture 29/29, Contributing 17/18, Screenplay 13/19, Scenarios 8/12. Prompter/AuthProxy/Tools are fully covered — proof it's achievable. The converter copies `description` only when source frontmatter has it (it never synthesizes), so **every fix belongs in the product source repos.** Biggest single lever for SEO, search, social cards, and the `llms.txt` export.
- **[All · High] The `<FullStackTabs>` differentiator is under-used.** Arc shows it on 4 pages (none in the command/query/form reference); it's the clearest expression of full-stack type safety. Add C#↔generated-TS views to `arc/backend/commands/model-bound/index.md`, `queries/model-bound/index.md`, and the frontend command/query reference.
- **[All · Medium] Low diagram density.** Only 38/339 Chronicle, 21/266 Arc, **2/91 Components, 1/45 Fundamentals**, 0/29 Architecture (acceptable for reference). Concept pages lacking a diagram include Chronicle `concepts/{event-type-migrations,modeling-events,tagging,correlation-identity-causation,designing-read-models,geospatial}.mdx`, `projections/choosing-a-read-model-style.mdx` (a decision page begging for a flowchart), `reducers/index.mdx`, `compliance/index.md`, `subscriptions/index.md`; and the Fundamentals derived-types/serialization/metrics concept pages. The client-SDK trees (Elixir/Kotlin/TS, ~60 pages) are essentially diagram-free.
- **[All · Low] Heading case.** Title-Case headings violate the sentence-case rule pervasively: ~197 in Chronicle `projections/`, ~106 in `code-analysis/`, 369 across Components+CLI, ~17 in Arc. Bulk-downcase in source.
- **[All · Low] American English slips:** Chronicle `projections/pdl/nested.mdx:289`, `code-analysis/CHR0017.mdx:73` ("behaviour"); Components `migration.md:451` & `Styling/cratis-tokens.md:27` ("catalogue"), `Filter/index.md:225` ("initialises"), `DataPage/details-panel.md:42` ("signalled"), `Toolbar/drag-and-drop.md:48` ("Serialised"); Arc ~5 files ("behaviour"/"serialised"); Contributing `logging.md:13` ("labour"); Scenarios (7 files: behaviour/initialised/optimised/serialisation).
- **[Arc/Chronicle · Low] Untagged or non-standard code fences:** Chronicle (elixir connection-strings, ts getting-started, contributing/clients, pdl/joins); Arc (`flow`, `env`, `gitignore`); CLI example-output blocks untagged. Tag with a real language or `text`.
- **[All · Low] "The Arc" → "Arc"** in 17 Arc files; **npm vs yarn** mixed in JS install examples (project standardizes on Yarn 4) — pick one or use package-manager tabs.

---

## Priority 2 — Structure, IA & coverage

### Information architecture (astro.config.mjs)
- **[High] The "Cratis Stack" overview topic is an overloaded catch-all** (~23 top-level entries spanning all four Diátaxis types) that buries whole products: AuthProxy (6 pages), Studio, and Screenplay sit as collapsed items/loose leaves next to community/meta pages. Promote real products to their own icon-rail topics or a "Products" group; move meta/community/testing into clearer buckets.
- **[Medium] Two competing "Scenarios"** — site `/scenarios/` vs product `/chronicle/scenarios/`; `api-reference.md` links the latter while nav points at the former. Differentiate or unify.

### Redundancy / overlap (sharpen boundaries, cross-link instead of re-explaining)
- **[Medium-High] Site "map" pages overlap heavily** — the Arc→Mongo/EF/Chronicle mermaid, the product card grid, and the standalone-vs-together narrative are each repeated across `index.mdx`, `why-cratis.mdx`, `cratis-stack.mdx`, and `adopting-cratis.mdx`.
- **[Medium] `showcase.mdx` ≈ `samples.mdx`** (same three samples); showcase's "architectures" promise is thin. Fold in or make it genuine reference architectures.
- **[Medium] Arc: Arc.Core-vs-ASP.NET-Core explained 4×** (`backend/overview.md`, `core/index.md`, `core/overview.md`, `asp-net-core/index.md`; the first two duplicate within one folder). **Twin aggregate pages** (`aggregate-root.md` 347L, `aggregate-roots.md` 233L). `backend/overview.md` duplicates `backend/index.md`.
- **[Medium] Chronicle: event-evolution explained 3×** (`understanding-event-evolution.md`, `concepts/event-type-migrations.mdx`, `migrations/index.md`). Three near-parallel hosting walkthroughs (`get-started/{console,worker,aspnetcore}.mdx`, ~880 lines each) — extract shared `[!INCLUDE]` steps.
- **[High] Two parallel, unreconciled CommandForm doc sets** — Components (`components/CommandForm/*`, fields inside `<CommandDialog>`) and Arc (`arc/frontend/react/command-form/*`, `<CommandForm command={...}>`). Both are real; prop tables and field names diverge (Components `DropdownField/MultiSelectField/SliderField` vs Arc `SelectField/RangeField`), and neither links the other, so it reads as contradictory. Add an orientation aside + cross-link on both `index` pages; make one canonical for field props.

### Undocumented shipped surface
- **[Components · High]** No docs at all for the `Display` module (Avatar, Badge, Chip, ProgressBar, Skeleton, Tag), the `Notifications` module (Toaster/toast/toastCommandResult), or 3 CommandForm fields (PasswordField, RatingField, ToggleSwitchField — docs cover 12 of 15).
- **[Chronicle · Medium] Java client: 0 pages** (Kotlin 20, Elixir 24, TypeScript 20, .NET via shared docs) — yet client pages claim "synchronized examples for C#, Kotlin, Java, Elixir, and TypeScript". The C#↔other-language tab coverage is ~half-synchronized (512 C# tabs vs ~252–266 each), and many pages wrap a lone C# block in a one-option `<Tabs>`. Add the missing tabs, or drop the wrapper with an honest coverage note.
- **[Fundamentals · Medium] Broken toc entry** — `Fundamentals/Documentation/typescript/toc.yml:6` lists a "Coordinate" page (`coordinate.md`) that doesn't exist; it's silently dropped from the sidebar every sync. Write it or remove the entry.
- **[Contributing · High] `release-digests/` (6 pages) orphaned + internal.** Not in `.github/toc.yml`, machine-generated titles, no descriptions, and bullets carry internal implementation detail the PR-writing rule says must not be user-facing. Curate into `/whats-new` and exclude the raw files, or give them a landing + toc + real titles.

---

## Priority 3 — Tour-voice, depth & maturity framing

- **[Fundamentals · High] Deep pages fail the tour-voice bar** (reference-dump/marketing openings): `typescript/index.md`, `serialization/index.md`, `metrics/index.md`, `metrics/roslyn.md`, `serialization/derived_types.md`, `field_decorator.md`, `derived_types_integration.md`. And `typescript/index.md` is far weaker than its C# sibling — bring to parity.
- **[Arc · Medium] Controller-based framing presented as the default** on `frontend/core/queries.md` ("controller actions"), `frontend/react/commands/index.md:5`, `frontend/react/proxy-generation.md` (full `: Controller` example) — contradicts Arc's model-bound house default. Reframe to `[Command]`/`[ReadModel]`; mention controllers only as the escape hatch.
- **[Arc · Medium] MVVM is the thinnest frontend area** despite being the app-profile default: `react.mvvm/mvvm-context.md` (24L explains little), `tsyringe.md` (typos "bee able", "Rect MVVM"), `identity.md` (33L). Meanwhile hooks/CommandForm are over-documented (several 450–630L pages).
- **[Chronicle · Medium] Reference-dump concept pages** — `reducers/index.mdx` (242L, no diagram, weaker than `projections/index`), `projections/model-bound/index.mdx` (623L). Oversized model-bound pages (`convention-based.mdx` 1171L, `children.mdx` 1024L, `basic-mapping.mdx` 968L) mix how-to + reference + comparison ~5× the 200-line guide — split into focused how-to + reference table.
- **[Components · High] Speculative "(If implemented)" filler** documenting behavior that may not exist: `PivotViewer/interactions.md:102-110`, `TimeMachine/navigation.md:36,57-64`, `TimeMachine/views.md:163-173`, `SchemaEditor/editing.md:154-175` (a fabricated undo/redo example), `ObjectNavigationalBar/index.md:244-252`. Verify against source; document what exists, delete the rest. And "when NOT to use" guidance is absent from nearly every component reference page.
- **[Screenplay · Medium] "Run it live" promise outruns shipped tooling** — index/why/overview lead on Stage running a `.play` live, but getting-started stops at the editor and Studio is "Soon". Add a Preview/maturity badge. **[Studio]** `studio.mdx` uses emoji card icons + a raw `<div class="sl-card-grid">` instead of `<CardGrid>` + `seti:` icons.
- **[Architecture · Medium] Thin topic** — `architecture/index.md` is a 25-word landing; the 26 `CRARCH*` rule pages are far thinner than Chronicle's `CHR*` analyzer pages (no code example, no "why this rule exists"). Duplicate 26-row index tables in `CodeAnalysis/index.md` and `CodeAnalysis/Rules/index.md`. CRARCH0011 documents a 400-line threshold while `code-quality.md` states 200 — reconcile.
- **[Contributing · Medium] `building.md` omits the entire frontend build/test** — lists Node 23 as a prereq but documents only `dotnet build`/`test`; no `yarn`/`tsc`/lint, no Debug-vs-Release (proxy regen) note.

---

## Tooling & process

- **[Medium] 2 of 6 `npm run check` gates silently no-op locally.** `lint:prose` (Vale) and `check:external` (lychee) print "not installed — skipping" and pass, so a contributor gets a false green on prose + external links. Assert the tools in CI, or make the scripts warn louder.
- **[Medium] `npm run check` can't pass on a plain local build** — the 8 "broken" links it reports are all `/api/*` and `/storybook*` paths produced by separate `build:api` / `build:storybooks` steps (all 200 on production). Either run those in the `check` chain or teach `check-links` to skip them.
- **[Low] `chronicle-client-docs:check` fails on a false-positive** — it flags `chronicle/code-analysis/CHR0037.mdx` for a raw C# fence, but the `CHR*` pages document C#-only Roslyn analyzers where a single-language fence is legitimate. Exempt `code-analysis/**` from the shared-doc audit, or wrap the fence.
- **[Low] `__pycache__` dirs** can leak into the generated content tree from the snippet-validation script — exclude from sync.
- **[Low] External-link freshness** — 9 links use the legacy `docs.microsoft.com` domain with pinned old `?view=aspnetcore-5.0/6.0` versions (all still 200 via redirect). Modernize to `learn.microsoft.com` + current versions.

---

## Strengths to preserve

- **Front door** — strong rotating hero, real value prop, copy-pasteable "get started in 3 steps", full-stack C#↔React example, platform cards, "choose your starting point" table, coming-from bridges.
- **Design/presentation** — 884-line hand-crafted brand CSS (ambient hero, tiered sidebar, brand-tinted code chips, CSS-var Mermaid theming, frosted header) and rich custom components (RotatingHero, StackJourney, StorybookEmbed, FullStackTabs). Well above default Starlight.
- **Flagship narrative pages** — `event-modeling.mdx`, `why-cratis.mdx`, Chronicle `index.mdx`/`read-models`/`projections`, Arc `understanding-*`, Components recipes, `cli/getting-started` are model pages: pain→relief, diagrams, honest "when it's the wrong fit".
- **AI export** — `/llms.txt` well-formed, `/llms-full.txt` comprehensive (~550k words). (Minor: the root `llms.txt` could enumerate key pages as a curated index.)
- **Link hygiene** — internal links essentially clean; external links healthy.
- **No TODO litter** — exactly one "in progress" banner across the whole site.

---

## Suggested sequencing

1. **Week 1 — P0.** Fix the copy-paste code bugs, the factual contradictions, the file-vs-folder collisions, the orphaned CLI sections, and pull the CI artifacts out of Chronicle. Small diffs, high reader impact.
2. **Weeks 2–3 — P1 in bulk.** A scripted pass to add `description` to every source page (even a one-liner), downcase Title-Case headings, and fix spelling/fences. Add `<FullStackTabs>` to the top command/query/read-model reference pages.
3. **Ongoing — P2/P3.** IA re-grouping (promote products out of the overview topic), de-duplicate the overlapping "map"/CommandForm/event-evolution content, document the undocumented Components modules, and lift the reference-dump pages toward the tour-voice bar section by section.

*Every product's detailed, file-cited findings were captured during the audit; this report consolidates and prioritizes them.*
