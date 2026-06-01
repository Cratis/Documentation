# Chronicle docs — migration plan

**Scope:** the event-sourcing engine. Source lives in `Chronicle/Documentation/`; published under `/chronicle/**`. Chronicle is the deepest product and the **voice exemplar** — its tutorial (`Chronicle/Documentation/tutorial/*`) is the reference for the tour voice. Match it.

## Status

- ✅ **Get started** — `get-started/index.mdx` (guided tour) + host variants (console/worker/aspnetcore as guided tours, includes preserved).
- ✅ **Tutorial** (3 chapters + index) — `first-event`, `read-model`, `reacting`. The voice exemplar.
- ✅ **Why** — `why-event-sourcing`.
- ✅ **Concepts** — event-source, event, event-type, event-store, namespaces, projection, subject, constraints, … all with Mermaid diagrams.
- ✅ **Scenarios** (6) — fix-a-stuck-observer, replay-a-projection, verify-events, enforce-a-unique-value, evolve-an-event, test-a-slice.
- ✅ **Coming from CRUD/EF** bridge.
- ✅ **Understanding** — `understanding-constraints-and-evolution`.
- 🟡 Reference (`projections/`, `reducers/`, `reactors/`, `constraints/`, `migrations/`, `sinks/`, `compliance/`, …) — migrated from DocFX; needs an accuracy + "both-voices" pass (narrative pages link *down* into terse reference).

## Remaining tasks (prioritized)

- [ ] 🟡 **Projections deep-dive** — joins, `[ChildrenFrom<T>]`, keys, AutoMap edges; a **reducers-vs-projections** decision page. (Model-bound projections use `[SetFrom<T>]`/`[SetValue<T>]`/`[FromEvent<T>]` — **not** `static On(event)`.)
- [ ] 🟡 **Reactors / automation** — idempotency, failure & replay, triggering commands via `ICommandPipeline`; a patterns page.
- [ ] ⬜ **Dynamic Consistency Boundary (DCB)** — powerful and under-explained; needs a real explanation page.
- [ ] 🟡 **Testing** — `EventScenario` / `ReadModelScenario` guides (skills exist: `write-specs-events`, `write-specs-readmodels` — mirror them into docs).
- [ ] 🟡 **Compliance/PII, sinks, subscriptions, event-seeding, namespaces** — reference polish + one scenario each where evaluator-facing.
- [ ] 🔁 **Snippet audit** — verify every C# example against Studio `*.cs` + `Chronicle/Source`. (Past fixes: the `read-model` tutorial's fabricated projection; `scenarios/test-a-slice` missing the `eventSourceId` arg; `reducers/getting-started` retrieval → `eventStore.ReadModels.GetInstanceById<T>`.)
- [ ] 🟡 **Reference accuracy + both-voices pass** across the migrated reference sections.

## Gotchas

- Host get-started variants share `[!INCLUDE]` files (`prereq`, `docker`, `common`, `mongodb`) — keep them in sync; the snippets there were dedented (don't reintroduce leading indentation).
- Diagrams are pre-rendered at build (see the `documentation-rendering-and-qa` rule) — they're in the HTML, no client delay.

## Definition of done

- [ ] Projections + reactors + testing have an "Understanding…" explanation **and** terse reference that links down to it.
- [ ] DCB has a real explanation page.
- [ ] Every code snippet verified against source.
- [ ] `npm run check` green; pages reviewed in light + dark.
