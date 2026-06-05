# Cratis docs — master plan (depth & coverage roadmap)

> The living backlog of documentation **depth** work. Pair this with `HANDOVER.md` (current
> state, how to run/verify, gotchas) and `KNOWN-ISSUES.md` (build-env-only items). When you
> finish something here, tick it and add a one-line note to the handover's §8 ledger.
>
> **Last updated:** 2026-06-04 — infra session (Storybook + API reference wired; release/cutover prepared).
>
> **2026-06-04 infra session (committed/uncommitted on `docs-overhaul`, NOT pushed):**
> - **🔧 Storybook embed — DONE.** Fixed the static build (Vite `lightningcss` → `esbuild` `cssMinify` in
>   `Components/Source/.storybook/main.ts`), hosted at `/storybook/`, embedded via `StorybookEmbed.astro` on a
>   new **Components → Storybook** page. `npm run build:storybook`; CI builds it (Node 23 — Components requires `>=23`).
> - **🔧 API reference generation — DONE.** `npm run build:api` (`web/scripts/build-api.mjs` + `web/api-build/docfx.json`):
>   DocFX over Chronicle clients (dotnet/aspnetcore/testing) + Arc + Arc.MongoDB + Fundamentals → `/api/`,
>   TypeDoc over the `@cratis/*` packages → `/api/<product>/javascript/`. Linked from `api-reference.md`; CI-wired.
>   Arc needs a pre-built Release DLL (docfx can't run its source generators); `DotNET.InProcess` was dropped (gone from Chronicle).
> - **Release/cutover prepared:** `docs-site.yml` fixed (added cli + Fundamentals checkouts; deploy main-only),
>   old DocFX `pages.yml` auto-deploy disabled. **`cratis-docs/RELEASE-RUNBOOK.md`** + **`RELEASE-READINESS.md`**
>   capture the merge order, deploy enablement, and the one known `Components/toc.yml` merge conflict.
>   AI workspace at `cratis-docs/` (`CLAUDE.md` + `docs-workspace` skill).
> - **⚠️ `main` diverged far** from `docs-overhaul` (Documentation +600, Chronicle +400+ commits) — re-audit code
>   snippets against *current* `main` before release (the top "don't lie" risk). See `RELEASE-READINESS.md`.

## How to use this

- This file is the **forward-looking roadmap**; the handover is the **rear-view state**. Read both.
- Pick the highest item under "Prioritized next picks" that fits the time you have, or take a whole
  product column if you're doing a deep pass.
- **Verify every C#/TS snippet against real Studio source** (`/Volumes/sourcecode/repos/cratis/Studio/Source`)
  and the existing reference before writing. The old detailed docs on each repo's **`main` branch** are a
  mine for reference depth.
- Keep the gate green: `cd Documentation/web && npm run check` (0 errors, 0 broken links). Don't mass-remove
  the ~180 advisory weasel-word warnings — that's the deliberate tour voice.

## The bar (the non-negotiables every page is held to)

1. **Aspire-class, tour-voiced onboarding** — teach, don't dump. Match the Chronicle tutorial + `feedback_docs_content_patterns`.
2. **Two voices for every product.** Each product needs *both*: the **toured/educational** layer
   (tutorial, getting-started, "Understanding…" explanations) **and** the **precise detailed-technical
   reference**. The narrative pages link *down* into the reference; the reference stays exhaustive and terse.
3. **Product isolation + one-way composition.** Chronicle stands alone (any .NET host, never knows Arc).
   Arc stands alone (typed full-stack CQRS over MongoDB/EF) *and* can layer on Chronicle. Components layers
   on Arc. The dependency is **one-way: Arc → Chronicle**. Every product has greenfield *and* brownfield
   on-ramps. (See the `cratis-product-boundaries` memory.)
4. **Diátaxis** per product: Get started (tutorials) → Guides (how-to) → Concepts (explanation) → Reference.

## Status legend

✅ done · 🟡 partial / needs polish · ⬜ todo · 🔧 needs build env (see KNOWN-ISSUES.md)

> **Important nuance:** most **reference** pages already *exist* (migrated from DocFX). The remaining work
> is mostly (a) the **educational layer** on top — "Understanding…" explanations, tutorials, scenarios;
> (b) **tour-voice** reshapes of flat pages; (c) **curation/audit** of the migrated reference for accuracy
> and the "both voices" link-down; (d) the 🔧 build-env items. It is *not* mostly writing reference from scratch.

---

## Cross-product / connective tissue

### 🌟 Big bets (proposed — high launch value)

- 🟡 **"Cratis Stack" — an umbrella hero topic / tour.** *(SHIPPED: the `cratis-stack` hero landing + the
  first nav topic rebranded "Cratis Stack" + the `ai-native-development` page. Optional remaining: deeper
  per-chapter tour pages — design/build/operate — though the landing already tours at altitude and links out
  to the tutorials, so beware duplication.)* A first-class top topic (its own icon-rail entry,
  peer to the products) that *tours the whole stack end-to-end* in guidance/tour voice, showing how every layer
  fits together and why the sum is far more than the parts. Not a product reference — a **showcase + guided
  journey**. The layers, with their *correct* roles (confirmed with the user — don't mis-state these):
  - **Studio** (independent top layer, "coming soon") — a collaborative **Event Modeling / Event Storming (DDD)
    canvas**: design the domain (commands, events, read models on a timeline), align the team, and **generate
    type-safe C#** from the model. It's the *front* of the funnel (design → generate → build) and is usable on
    its own, independent of the rest of the stack. See `cratis.studio` + `Studio/Source` (`Applications/EventModels`,
    `Components/Canvas`). **NOT a runtime inspector.**
  - **Arc + Chronicle + Components** — build the slices (the loop the boundary narrative + tutorials cover).
  - **CLI + Workbench** — *inspect & interact with* a running Chronicle store (events, observers, read models,
    replay/diagnose). This is the runtime/operate layer (what Studio is **not**).
  - Story arc: *model it in Studio → generate the slices → build with Arc/Chronicle/Components, typed to React →
    inspect & operate with CLI/Workbench* — optionally AI-accelerated at every step (see the AI-native bet).
  Subsumes and links to: the boundary narrative, the capstone, and the proxy-boundary explanation (a *chapter*).
  *Implementation:* a new site-level topic in `astro.config.mjs` (like the Overview topic) with a hero landing +
  chaptered tour pages; reuse `TopicHero`/`StackDiagram`/`FullStackTabs`.
- 🟡 **AI-native development — "Build Cratis apps with AI agents."** *(SHIPPED: `ai-native-development.mdx` —
  build side (`.ai` skills/agents) + operate side (`cratis init` writes CHRONICLE.md + instruction files for
  Claude Code/Copilot/Cursor/Windsurf + a `chronicle-diagnose` slash command; Chronicle MCP server). Could grow
  into a how-to cluster: a dedicated "set up Cratis AI tooling" + "connect the MCP server" walkthrough.)* A
  genuine differentiator. Grounded in real, shipped tooling (verified locally):
  - **`AI/` repo (Cratis AI)** — canonical `.ai/` config (agents, **skills** like `new-vertical-slice`,
    `cratis-command`, `add-projection`, `cratis-readmodel`; prompts; hooks; coding rules) that drops into any
    Cratis repo via `.github/` + `.claude/` symlinks. Installed with **`cratis init`**. The agents/skills know the
    Cratis way (vertical slices, `[Command]`+`Handle()`, model-bound projections) so an agent scaffolds correct
    slices fast.
  - **`Chronicle.Mcp` repo** — a Dockerized **MCP server** that connects an AI agent to a *running* Chronicle
    server to browse events, observers, and read models (the agent-facing analog of the CLI). So agents both
    **write** the code and **operate/inspect** the running system.
  - *Deliverable:* a how-to + explanation cluster — "Set up Cratis AI tooling (`cratis init`)", "Build a slice with
    an AI agent", "Connect the Chronicle MCP server", plus a section in the Cratis Stack tour on AI-accelerated dev.
    Verify the exact `cratis init` behavior and MCP config against the `AI/` and `Chronicle.Mcp/` repos before writing.
  - *Open Q for the user:* confirm **Workbench**'s scope (visual surface alongside Studio — appears in front-door
    imagery) so we represent it accurately in the tour.

- ✅ **Boundary narrative** — `why-cratis.mdx` ("Use them on their own — or together" + decision table + pluggable-persistence diagram).
- ✅ **Arc standalone** — `arc/arc-without-event-sourcing.md` (command over Mongo/EF, live query, identical React).
- ✅ **Adopting Cratis** — `adopting-cratis.mdx` (greenfield + brownfield, decision flowchart).
- 🟡 **Full-stack type-safety / proxy boundary** — *the differentiator.* Shown in tutorials but never
  *explained* as its own concept. → **Next: an "Understanding the proxy boundary" explanation** (C# → generated
  TS → React; what regenerates, when, what breaks the build) linking down to `arc/backend/proxy-generation/*`
  and `arc/frontend/react/proxy-generation`. Closes the last sliver of handover OPEN #2.
- 🟡 **Capstone** — `build-a-full-app.mdx` is written; needs a verified, runnable Studio/Ada-grade sample (🔧).
- ⬜ **A standalone-Chronicle "Understanding"** — a short page naming Chronicle-from-any-host (worker/console) as a first-class story (the index now states it; a dedicated explanation could go deeper).
- ✅ **API reference generation — DONE (2026-06-04).** DocFX (.NET) + TypeDoc (TS) wired via `npm run build:api`; rendered at `/api/`, linked from the orientation page. CI-wired. (Pages render in DocFX/TypeDoc themes, not Starlight — theming is optional follow-up.)
- ✅ **Arc reference API-correctness cleanup (audit round 3) — DONE.**
  - ✅ **`backend/core/getting-started.md` FIXED** — `ArcApplication.CreateBuilder` (not `ArcApplicationBuilder.CreateBuilder`), `app.UseCratisArc()` no-args (URL via `ArcOptions.Hosting.ApplicationUrl`), model-bound `[Command]`+`Handle()` and `[ReadModel]` static queries (the `ICommand`/`ICommandHandler<T>`/`IQuery`/`IQueryHandler` interfaces don't exist), `CommandResult.Success` removed.
  - ✅ **`backend/asp-net-core/configuration.md` FIXED** — `builder.UseCratisArc(...)` → `AddCratisArc(...)` on `IHostBuilder` (string form is `AddCratisArc(configSectionPath: "…")`, the 4th named param); `app.UseCratisArc()` calls left correct.
  - ✅ **`backend/core/authorization.md` FIXED (blocker resolved).** The current-user accessor was the unblock: inject **`IHttpContextAccessor`** and read **`HttpContext?.User`** (`ClaimsPrincipal`) — verified in Studio `OrganizationSetup.Handle` (`OrganizationSetup.cs:102-114`). Deep sections rewritten to that pattern + `Result<ValidationResult,T>`/`ValidationResult.Error` for in-`Handle` guards + `CommandScenario<T>` for testing.
  - *(Already fixed: `reducers/getting-started.md` retrieval; the `mongodb/getting-started.md` + `arc-without-event-sourcing` bootstrap.)*
  - ⬜ **New (found during the rewrite): `backend/testing/command-scenario.md` references a non-existent `StubIdentityProvider`** (appears only in that doc, not in `Arc/Source`; `IIdentityProvider` has no `roles` ctor). Verify how `CommandScenario<T>` actually sets the current principal/claims and fix the example — likely the next snippet-audit follow-up.
- 🔁 **Snippet-correctness audit (recurring).** Verify framework-API usages in code examples against real source (Studio `.cs`/`.tsx`, `Components/Source/**/*.d.ts`). Done for the Arc + Components flagship tutorials + getting-started (clean) and fixed two Components recipes; **caught a real fabricated-API bug** in the DataPage tutorial. Worth re-running across reference pages / other recipes — delegate to a subagent and verify each finding vs source before fixing.
- 🟡 **Foundation tooling** — **QA stack WIRED** (graceful, advisory, all in `npm run check`): **Vale** (`.vale.ini` + `lint-prose.mjs`), **markdownlint** (`.markdownlint-cli2.jsonc` + `lint-markdown.mjs`), **lychee** external-link check (`.lychee.toml` + `check-external-links.mjs`). All skip when the tool is absent (the Vale pattern), so no deps/lockfile were touched. **To activate:** install the tools — locally `npm i -D markdownlint-cli2` + `brew install vale lychee`; in **CI**, install them in `docs-site.yml` so they actually run (right now they skip everywhere). **Still pending:** Expressive-Code power features (collapsible regions, line numbers via `@expressive-code/plugin-*`) — these are build-imported in `astro.config.mjs`, so adding the plugin deps without installing them **breaks the build**; do this in a focused pass that installs + verifies render in light/dark.

---

## Per-product depth matrix

### Chronicle — event-sourcing engine (standalone)
Reference largely migrated; the work is expert-depth explanations + scenarios.
- ✅ Tutorial (3 ch), get-started + host variants, why-event-sourcing, concepts (+diagrams), coming-from-crud, scenarios (6).
- 🟡 **Constraints / uniqueness** — *(SHIPPED: `understanding-constraints-and-evolution.md` explanation; reference `constraints/*` + scenario `enforce-a-unique-value` already existed.)*
- 🟡 **Migrations / event schema evolution** — *(covered by the same explanation + the already-strong `migrations/index.md` + scenario `evolve-an-event`.)*
- 🟡 **Projections deep-dive** — joins, `[ChildrenFrom]`, keys, AutoMap edges; reducers-vs-projections decision page.
- 🟡 **Reactors / automation** — idempotency, failure & replay, triggering commands; patterns page.
- ⬜ **Dynamic Consistency Boundary (DCB)** — explanation depth (powerful, under-explained).
- 🟡 **Compliance/PII, sinks, subscriptions, event-seeding, namespaces** — reference polish + a scenario each.
- 🟡 **Testing** — EventScenario / ReadModelScenario guides (skills exist; mirror them into docs).

### Arc — full-stack CQRS (standalone + on Chronicle)
- ✅ Tutorial (5 ch), scenarios (6), getting-started (backend+frontend), why-arc, vertical-slices, coming-from-mediatr, **arc-without-event-sourcing**.
- 🟡 **Proxy / type-safety boundary** — "Understanding" page (← *doing next*) + audit `backend/proxy-generation/*` for completeness.
- 🟡 **Identity + auth depth** — *(SHIPPED: `understanding-identity-and-access.mdx` — `IProvideIdentityDetails` enrichment, `[Authorize]`/`[Roles]`/`[AllowAnonymous]` on model-bound commands/queries, and a tenancy section.)* Optional next: how-to recipes (protect a command, enrich identity from a DB, block a user). **`backend/core/authorization.md` now modernized** to the `[Command]`/`Handle()` style ✓ (a fuller pass over the remaining illustrative `: ICommand` snippets is a follow-up). (`auth-and-identity` skill exists.)
- 🟡 **Tenancy depth** — covered conceptually in the identity-and-access page; the reference (`backend/tenancy/*`) exists. Optional: a worked "isolate a tenant end to end" how-to.
- 🟡 **Validation depth** — `ConceptValidator`, severity filtering, business rules via injected read model returning `Result<…>`.
- 🟡 **Observable queries deep-dive** — change streams, demultiplexer/hub, curl debugging (`observable-query-curl` skill exists).
- ⬜ **Persistence guides** — full "Arc over MongoDB" and "Arc over EF Core" how-to guides (brownfield-friendly), beyond the standalone overview page.
- 🟡 **Frontend** — command forms field reference, MVVM option, dialogs, Vite config.

### Components — React library (on Arc)
- ✅ Tutorial (3 ch), getting-started, why-components, coming-from-primereact, choosing-a-component, recipes.
- 🟡 **DataPage / DataTables deep-dive** — *(SHIPPED: enriched `DataPage/index.md` with the compound `DataPage.Columns`/`DataPage.MenuItems` API + a details-panel example; fixed a tutorial bug — `detailsComponent` is lowercase, and `detailsTitle`/`initialSizes` are not real props. Verified vs `Components/Source/DataPage/DataPage.tsx`.)*
- 🟡 **CommandDialog / CommandForm** — field-type reference polish; validation timing; `initialValues` vs `onBeforeExecute` (a known footgun).
- 🟡 **Specialized components** — StepperCommandDialog, Toolbar, Dialogs, Dropdown, PivotViewer, SchemaEditor, TimeMachine — reference + one recipe each where evaluator-facing.
- ✅ **Storybook embed — DONE (2026-06-04).** Static build hosted at `/storybook/`, embedded on the Components → Storybook page (`npm run build:storybook`). No deployed URL needed — it's a site-local static build.

### CLI — operate/explore a running store
- ✅ Getting-started tour, scenarios (fix-a-stuck-observer, replay, verify-events).
- 🟡 Per-command reference organized by **workflow** (not alphabetically); more scenarios.

### Fundamentals — shared .NET/TS utilities
- ✅ C# concept walkthrough.
- 🟡 TS parity (concepts/types/serialization), DI, type discovery — tour-voice + reference polish.

### Contributing — first-class product
- ✅ Wired into nav. 🟡 Light tour-voice polish only.

---

## Prioritized next picks (launch-facing first)

> **⏭️ ACTIVE PRIORITIES are in HANDOVER §0 "NEXT SESSION — START HERE"** (a visual + accuracy QA pass set by the user 2026-05-31): (1) screenshot every page with `shot-scraper` + a real visual-polish pass toward **aspire.dev** (the bar — user says we're far off); (2) fix the **nav flicker/jump** (layout shift); (3) fix the **front-door Mermaid** that doesn't render on the splash template; (4) **rewrite the comparison pages** (Marten/Wolverine/Kurrent) against how they work *today* (local `~/src/repos/marten`+`wolverine`); (5) **remove Chronicle from the Arc product** — make the Arc tutorial Chronicle-free (supersedes the earlier "additive" call); (6) apply **awesome-docs** tools (Doc Detective for automated example testing; Alex/case-police; shot-scraper). The list below is the standing backlog underneath those.

1. **Full-stack type-safety / proxy boundary** (the differentiator; first chapter of the Cratis Stack tour) ← *in progress*.
2. 🟡 **"Cratis Stack" umbrella hero topic** — SHIPPED (landing + topic rebrand). Optional: deeper per-chapter tour pages.
3. 🟡 **AI-native development** — SHIPPED (`ai-native-development.mdx`). Optional: grow into a how-to cluster (setup + MCP walkthrough).
4. 🟡 **Arc identity + tenancy** — explanation shipped (`understanding-identity-and-access`); optional how-to recipes + modernizing the `core/authorization` reference.
5. 🟡 **Chronicle constraints + migrations** — explanation shipped; reference/scenarios already existed.
6. 🟡 **Components DataPage / DataTables** — reference enriched + a tutorial API bug fixed.
7. **Capstone runnable sample + foundation tooling** (🔧 — need build env / deps; batch when environment allows). *(API generation + Storybook embed: ✅ DONE 2026-06-04.)*

## Done this overhaul (don't redo — see HANDOVER §6/§8 for the full list)
Platform (Starlight, topics rail, brand), all 6 products migrated to bucketed Diátaxis, front door,
glossary, comparisons (Marten/Wolverine/Kurrent) + CRUD/MediatR bridges, threaded tutorials (Chronicle/Arc/Components),
scenario/recipe catalogs, getting-started tour pass, concept-page diagrams, and the product-isolation/combination/brownfield narrative.

---

## Documentation backlog — user notes 2026-06-05 (size: S)

Captured so we don't forget. The source repos for the AI/Tools/AuthProxy items all exist locally at
`/Volumes/sourcecode/repos/cratis/{AI,Chronicle.Mcp,AuthProxy,Lens,Studio}` — so every item is groundable against real source.

- ⬜ **QA — information is accurate.** Beyond the snippet audit (~95 fixes landed 2026-06-05 across Chronicle/Arc/Components),
  do a broader prose/claims accuracy pass.
- ⬜ **Don't lose any docs.** Per-page diff of each product's `docs-overhaul` vs `origin/main` `Documentation/` to confirm no
  page was *dropped* in the overhaul (counts show net growth — Arc 251 vs 227, Components 91 vs 79, Fundamentals 33=33 — but
  counts ≠ coverage). Chronicle has no `-main` worktree here → diff against `origin/main`.
- 🟡 **Storybooks (Arc + Components).** Components ✅ (`npm run build:storybook` → `public/storybook`, embedded on
  `/components/storybook`). **Arc ✅ wired 2026-06-05** — Arc.React's 4 stories build via `npm run build:storybook:arc` →
  `public/storybook-arc`, embedded on `/arc/frontend/react/storybook`; `StorybookEmbed` now takes a `storybook` path prop;
  CI (`docs-site.yml`) builds both. *(Verify the Arc build runs clean in CI — Node 23 + yarn.)*
- ⬜ **Onboarding / learning paths.** Split the quickstarts into explicit **Prerequisites** + **single focused steps** per
  product (the front door now has a 3-step quickstart; products have get-started pages but no prereqs split). Existing top-level Guides.
- ✅ **Cratis Stack — AI surfaced as a cluster (2026-06-05).** Per the user, kept it *inside* the existing Cratis Stack topic
  (not a new rail entry): added an **AI** group → `ai-native-development` + new **`plugins.mdx`** + new **`code-analysis.mdx`**.
  - **Plugins** = the `cratis/AI` config (agents/skills/prompts/hooks/rules) surfaced to **GitHub Copilot + Claude Code** via the
    `.github/`/`.claude/` symlink shells, installed via `cratis init` (Claude Code/Copilot/Cursor/Windsurf). ⚠️ **No literal plugin
    marketplace and no Codex packaging exists in `cratis/AI`** — the page documents the real delivery, not an invented one. (User
    said "plugins for claude, copilot, codex" — Codex isn't supported anywhere yet; flagged.)
  - **Code analysis** surfaces the analyzers (Chronicle `CHR0001–0021`, Arc `ARC0001–04`, `ARCCHR0001`) and links down to the
    per-product reference pages. **Chronicle MCP** already lives in `ai-native-development`.
- ✅ **Cratis Stack — Tools (2026-06-05).** New **Tools** group → `tools/vscode-extension.mdx` + `tools/lens.mdx`.
  - **VSCode extension is "Narrator"** (`cratis.narrator`) — LIVE on the VS Marketplace (verified, v1.0.8); page links it +
    `github.com/Cratis/Narrator`. Cloned the repo to `/Volumes/sourcecode/repos/cratis/Narrator` to author from real source.
  - **Lens** (`cratis/Lens`, v0.1.0) — **not on any public store yet**; page documents side-loading and says store links are
    "coming soon" (Chrome/Edge/Firefox/Safari). No fabricated store URLs.
- ✅ **Cratis Stack — AuthProxy (2026-06-05).** New `authproxy.mdx` ported from `cratis/AuthProxy/Documentation` (.NET YARP
  gateway: OIDC single/multi + JWT, tenancy strategies, identity enrichment, invites/lobby, custom pages; config under
  `Cratis:AuthProxy`; container `cratis/authproxy`). Wired into the topic + glob in `astro.config.mjs`. **Gate green: 0/0.**

**Open questions for the user (still):** (1) "Plugins" page documents the *real* per-assistant delivery — confirm OK, or do you want
a forward-looking "coming as installable plugins / Codex" note? (2) Narrator marketplace link is live; Lens store links are stubbed
"coming soon" until published — provide URLs when ready. (3) Onboarding Prerequisites split + the two QA passes (accuracy, don't-lose-docs) still open.
