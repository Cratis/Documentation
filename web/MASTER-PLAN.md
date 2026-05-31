# Cratis docs — master plan (depth & coverage roadmap)

> The living backlog of documentation **depth** work. Pair this with `HANDOVER.md` (current
> state, how to run/verify, gotchas) and `KNOWN-ISSUES.md` (build-env-only items). When you
> finish something here, tick it and add a one-line note to the handover's §8 ledger.
>
> **Last updated:** 2026-05-31, after the product-isolation / combination / brownfield narrative pass.

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

- ⬜ **"Cratis Stack" — an umbrella hero topic / tour.** A first-class top topic (its own icon-rail entry,
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
- ⬜ **AI-native development — "Build Cratis apps with AI agents."** A genuine differentiator, and currently
  undocumented in the site. Grounded in real, shipped tooling (verified locally):
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
- 🔧 **API reference generation** — .NET DocFX over ~7 assemblies + TS TypeDoc over `@cratis/*`. Orientation page exists.
- 🔧 **Foundation tooling** — Expressive-Code power features (collapsible regions, line numbers, expected-output `data-disable-copy`) + QA stack (Vale/markdownlint/lychee). Needs `package.json` deps; degrade gracefully where binaries absent.

---

## Per-product depth matrix

### Chronicle — event-sourcing engine (standalone)
Reference largely migrated; the work is expert-depth explanations + scenarios.
- ✅ Tutorial (3 ch), get-started + host variants, why-event-sourcing, concepts (+diagrams), coming-from-crud, scenarios (6).
- ⬜ **Constraints / uniqueness** — "Understanding constraints" explanation + recipes + reference audit. *(Expert credibility.)*
- ⬜ **Migrations / event schema evolution** — the hardest part of event sourcing; "Understanding" + recipes.
- 🟡 **Projections deep-dive** — joins, `[ChildrenFrom]`, keys, AutoMap edges; reducers-vs-projections decision page.
- 🟡 **Reactors / automation** — idempotency, failure & replay, triggering commands; patterns page.
- ⬜ **Dynamic Consistency Boundary (DCB)** — explanation depth (powerful, under-explained).
- 🟡 **Compliance/PII, sinks, subscriptions, event-seeding, namespaces** — reference polish + a scenario each.
- 🟡 **Testing** — EventScenario / ReadModelScenario guides (skills exist; mirror them into docs).

### Arc — full-stack CQRS (standalone + on Chronicle)
- ✅ Tutorial (5 ch), scenarios (6), getting-started (backend+frontend), why-arc, vertical-slices, coming-from-mediatr, **arc-without-event-sourcing**.
- 🟡 **Proxy / type-safety boundary** — "Understanding" page (← *doing next*) + audit `backend/proxy-generation/*` for completeness.
- ⬜ **Identity + auth depth** — `IProvideIdentityDetails`, `[Roles]`, protecting commands/queries, Microsoft Identity, dev principals. *(Enterprise evaluators; `auth-and-identity` skill exists.)*
- ⬜ **Tenancy depth** — isolation, resolvers, tenant context, per-tenant DB.
- 🟡 **Validation depth** — `ConceptValidator`, severity filtering, business rules via injected read model returning `Result<…>`.
- 🟡 **Observable queries deep-dive** — change streams, demultiplexer/hub, curl debugging (`observable-query-curl` skill exists).
- ⬜ **Persistence guides** — full "Arc over MongoDB" and "Arc over EF Core" how-to guides (brownfield-friendly), beyond the standalone overview page.
- 🟡 **Frontend** — command forms field reference, MVVM option, dialogs, Vite config.

### Components — React library (on Arc)
- ✅ Tutorial (3 ch), getting-started, why-components, coming-from-primereact, choosing-a-component, recipes.
- ⬜ **DataPage / DataTables deep-dive** — the most-used surface; details panels, menu items, columns, selection.
- 🟡 **CommandDialog / CommandForm** — field-type reference polish; validation timing; `initialValues` vs `onBeforeExecute` (a known footgun).
- 🟡 **Specialized components** — StepperCommandDialog, Toolbar, Dialogs, Dropdown, PivotViewer, SchemaEditor, TimeMachine — reference + one recipe each where evaluator-facing.
- 🔧 **Storybook embed** — needs a deployed Storybook URL to iframe.

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

1. **Full-stack type-safety / proxy boundary** (the differentiator; first chapter of the Cratis Stack tour) ← *in progress*.
2. 🌟 **"Cratis Stack" umbrella hero topic** (the platform showcase — proposed by the user; likely the single highest-impact launch piece).
3. 🌟 **AI-native development** (build Cratis apps with AI agents — `cratis init`, the `.ai/` skills, Chronicle MCP server).
4. **Arc identity + tenancy** (enterprise/multi-tenant evaluators probe these early).
5. **Chronicle constraints + migrations** (expert credibility — where event sourcing gets hard).
6. **Components DataPage / DataTables deep-dive** (most-used surface).
7. **Capstone runnable sample + API generation + foundation tooling** (🔧 — need build env / deps; batch when environment allows).

## Done this overhaul (don't redo — see HANDOVER §6/§8 for the full list)
Platform (Starlight, topics rail, brand), all 6 products migrated to bucketed Diátaxis, front door,
glossary, comparisons (Marten/Wolverine/Kurrent) + CRUD/MediatR bridges, threaded tutorials (Chronicle/Arc/Components),
scenario/recipe catalogs, getting-started tour pass, concept-page diagrams, and the product-isolation/combination/brownfield narrative.
