# Arc docs — migration plan

**Scope:** the full-stack CQRS framework. Source lives in **`Arc/Documentation/`** (the repo is `Cratis/ApplicationModel`, cloned as `Arc`); published under `/arc/**`. Arc's differentiator is **full-stack type safety** (C# → generated TS proxies → React) — lead with it everywhere.

## Status

- ✅ **Tutorial** (5 chapters) — `first-slice`, `validation`, `books-and-relationships`, `real-time`, `authorization` (threads one author/library app, full-stack with `FullStackTabs`).
- ✅ **Scenarios** (6) — validate-a-command, return-a-result-or-error, react-to-an-event, query-related-data, run-a-command-from-react, test-a-command.
- ✅ **Getting started** (backend `your-first-command` + frontend).
- ✅ **Why Arc**, **vertical-slices**, **coming-from-mediatr-and-mvc**.
- ✅ **arc-without-event-sourcing** (Arc standalone over MongoDB), **understanding-identity-and-access**, **understanding-the-proxy-boundary**.
- ✅ Reference cleanup done — `backend/core/getting-started`, `asp-net-core/configuration`, `authorization`, `reducers/getting-started` all fixed to real APIs.
- 🟡 Reference (`backend/**`, `frontend/**`) — migrated; needs the both-voices + accuracy pass.

## ⚠️ Decision needed before the tutorial work: de-Chronicle Arc

The user's firm direction (supersedes the earlier "keep Chronicle as Arc's flagship"): **Arc product docs must be isolated from Chronicle**, but the Arc **tutorial still teaches command→event→projection (Chronicle)**.

- **Plan:** make the canonical **Arc tutorial Chronicle-free** (Arc over MongoDB/EF — reuse the `arc-without-event-sourcing` shape) and move the Arc **+** Chronicle *combination* to the **Cratis Stack** tour / a combined capstone.
- **Keep** the legitimate `backend/chronicle/` integration category — that's Arc's *optional* Chronicle integration. The fix is making the **tutorial + getting-started Chronicle-free by default**, not removing the integration reference.
- **🚦 CONFIRM THE EXACT SPLIT WITH THE USER BEFORE REWRITING THE TUTORIAL.** `grep -ri chronicle Arc/Documentation` to find the leakage.

## Remaining tasks (prioritized)

- [ ] 🚦 **De-Chronicle the tutorial + getting-started** (after confirming the split above).
- [ ] 🟡 **Proxy / type-safety boundary** — explanation shipped; audit `backend/proxy-generation/*` for completeness and link down.
- [ ] 🟡 **Identity + auth how-tos** — explanation shipped; add recipes (protect a command, enrich identity from a DB, block a user). `backend/testing/command-scenario.md` references a **non-existent `StubIdentityProvider`** — fix how `CommandScenario<T>` sets the principal.
- [ ] ⬜ **Persistence guides** — full "Arc over MongoDB" and "Arc over EF Core" how-tos (brownfield-friendly), beyond the standalone overview.
- [ ] 🟡 **Validation depth** — `ConceptValidator`, severity filtering, business rules via injected read model returning `Result<…>`.
- [ ] 🟡 **Observable queries deep-dive** — change streams, demultiplexer/hub, curl debugging (`observable-query-curl` skill exists).
- [ ] 🟡 **Frontend** — command-form field reference, MVVM option, dialogs, Vite config.
- [ ] 🔁 **Snippet audit** vs Studio `*.cs`/`*.tsx`. (Note: the model is `[Command]`+`Handle()` on the record and `[ReadModel]` static queries — the `ICommand`/`ICommandHandler<T>`/`IQuery` interfaces **do not exist**; current user is `IHttpContextAccessor` → `HttpContext.User`.)

## Definition of done

- [ ] Tutorial + getting-started are Chronicle-free; the combination lives in the Cratis Stack tour.
- [ ] Persistence (Mongo/EF) how-tos exist for brownfield adopters.
- [ ] Identity/validation/observable-query depth filled in.
- [ ] Every snippet verified; `npm run check` green; reviewed light + dark.
