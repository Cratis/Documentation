# Chronicle Client Parity Migration Handoff

Last updated: 2026-07-04 (part 3 — get-started + tutorial fully done)

This is a **new, separate effort** from `chronicle-client-docs-migration.md` (that migration — eliminating `legacy/` C# snippets — is complete). This one is about **client coverage/parity**: making sure every shared Chronicle doc page that *can* show all 5 clients (csharp, kotlin, java, elixir, typescript) actually does, and that client-specific doc pages hold only genuinely client-specific content (not duplicated concept explanations).

## User's directive (verbatim intent)

Chronicle docs should be **language/ecosystem agnostic at the base** — concepts explained once, with language switchable via `<ChronicleClientTabs>`. Per-language install/setup/deploy content is expected and correct to be client-specific (e.g. .NET hosting content shouldn't appear for Kotlin). But everywhere a real equivalent API exists across clients, the docs should show it — not silently default to C#-only or C#+TypeScript-only because nobody finished the work. Client-specific doc pages (`clients/dotnet/**`, `Chronicle.Kotlin/Documentation/**`, `Chronicle.Elixir/Documentation/**`, `Chronicle.TypeScript/Documentation/**`) should hold ONLY installation/host-setup/decorators/package-behavior/troubleshooting — not re-explanations of shared concepts.

User chose: **"Everything, broadest scope first"** or (not narrowly get-started/tutorial only, though that's the best-understood starting point) and **"source-verify only"** for new Kotlin/Java/Elixir snippets (no local compiler available — see Environment Constraint below).

## Environment constraint — read this before writing any Kotlin/Java/Elixir snippet

This environment has **no Java runtime, no Kotlin compiler, no Elixir/mix** installed (confirmed via `which`/`java -version`/`elixir --version` — all absent). This means:
- C# and TypeScript snippets can still be verified for real via `python3 Documentation/validate-client-snippets.py` (Chronicle) and `python3 Chronicle.TypeScript/Documentation/validate-client-snippets.py` — do this for every batch, same as the whole legacy migration.
- Kotlin/Java/Elixir snippets can ONLY be verified by **reading real SDK source** (interfaces, classes, decorators/annotations, actual method signatures) before writing anything — same "verify against real source" discipline as always, just without the final compile confirmation. **Treat CI as the real compile gate for these three languages** — this was explicitly discussed and accepted by the user as the tradeoff for proceeding without local toolchains.
- Before claiming a Kotlin/Java/Elixir API exists, cite the exact file path + symbol read, not just "should be fine."

## Where the SDKs live

- C#: `/Volumes/sourcecode/repos/cratis/Chronicle/Source/Clients/DotNET` (and friends: `Aspire`, `AspNetCore`, `Testing`, `XUnit.Integration`)
- Kotlin/Java: `/Volumes/sourcecode/repos/cratis/Documentation/Chronicle.Kotlin` — Java is JVM-interop over the same annotations/types, not a separate SDK; graded together in the audit below.
- Elixir: `/Volumes/sourcecode/repos/cratis/Documentation/Chronicle.Elixir`
- TypeScript: `/Volumes/sourcecode/repos/cratis/Documentation/Chronicle.TypeScript`

Shared docs + C# snippets live in the **live sibling checkout** `/Volumes/sourcecode/repos/cratis/Chronicle/Documentation` — NOT `/Volumes/sourcecode/repos/cratis/Documentation/Chronicle` (a stale submodule pointer never edited this whole multi-session effort; a prior investigation got false-positive "orphan" results by accidentally checking the submodule — always double check which one you're in).

## Scope, quantified (2026-07-03, before this effort started)

Total shared-doc `<ChronicleClientTabs>` across `Chronicle/Documentation/**` (excluding `client-snippets/**`, `clients/**`): **685**.

- 478 `clients="csharp"` only
- 152 `clients="csharp,typescript"` only
- 24 show all 5 (or csharp+kotlin+java+typescript, missing only elixir, in 1 case)
- 16 `clients="csharp,elixir,typescript"` (missing kotlin/java)
- 6 `clients="csharp,elixir"`
- 4 `clients="typescript"` only (genuinely TS-only content, e.g. AsyncLocalStorage-based identity/correlation — no C# equivalent claimed)

Per-directory breakdown (total tabs / csharp-only / csharp+ts-only / full-or-near-full):
| Directory | Total | csharp-only | csharp+ts-only | full/near-full |
|---|---|---|---|---|
| projections | 210 | 82 | 104 | 10 |
| testing | 46 | 46 | 0 | 0 |
| reducers | 48 | 44 | 4 | 0 |
| events | 44 | 34 | 3 | 6 |
| reactors | 34 | 28 | 2 | 4 |
| concepts | 35 | 28 | 7 | 0 |
| code-analysis | 41 | 41 | 0 | 0 |
| get-started | 28 | 17 | 7 | 4 |
| constraints | 21 | 11 | 10 | 0 |
| compliance | 22 | 13 | 9 | 0 |
| contributing | 21 | 15 | 0 | 0 |
| configuration | 21 | 21 | 0 | 0 |
| subscriptions | 17 | 17 | 0 | 0 |
| read-models | 15 | 7 | 2 | 1 |
| tutorial | 14 | 14 | 0 | 0 |
| scenarios | 12 | 12 | 0 | 0 |
| namespaces | 11 | 11 | 0 | 0 |
| hosting | 9 | 9 | 0 | 0 |
| migrations | 9 | 9 | 0 | 0 |
| event-seeding | 7 | 7 | 0 | 0 |
| connection-strings | 5 | 5 | 0 | 0 |
| closing-streams | 2 | 2 | 0 | 0 |
| sinks | 2 | 2 | 0 | 0 |

**`code-analysis/**` (41 tabs) is almost certainly all-genuine-gap** — it documents C# Roslyn analyzer diagnostics (CHR00xx rules), which are inherently .NET/Roslyn-specific and have no meaning for Kotlin/Elixir/TypeScript. Don't spend time re-auditing this directory; treat as correctly-scoped C#-only unless a specific page's content proves otherwise.

## Get-started/Tutorial audit findings (done — this is the reference classification for the whole effort's methodology)

Full per-tab classification already done by a research agent (2026-07-03) reading real SDK source for every restricted tab in `get-started/**` and `tutorial/**`. Full detail was in the agent's report (not preserved verbatim here — re-run a similar audit for other directories rather than trying to recover the exact original text). Headline findings, useful for every other directory too:

### Confirmed genuinely-C#-only (all missing clients — correctly scoped, don't touch)
- Aspire orchestration (`get-started/choose-hosting-model/**`) — `Aspire.Hosting`/`Cratis.Chronicle.Aspire` is .NET-exclusive; zero equivalent packages anywhere else.
- ASP.NET Core DI/pipeline integration (`get-started/aspnetcore/**`) — no Spring/Ktor/Phoenix/Express Chronicle package exists.
- .NET Generic Host (`get-started/worker/**`) — `Microsoft.Extensions.Hosting` is .NET-exclusive.
- MongoDB BSON casing-convention bridging (`get-started/mongodb/conventions`) — a .NET-`MongoDB.Driver`-specific PascalCase/camelCase mismatch; other ecosystems don't have this specific problem.

### Under-migrated — real equivalent APIs proven, snippets just never written
- `get-started/common/{a-events,append,reactor}` — Kotlin `@EventType`/`eventLog.append()`/`@Reactor`, Elixir `use Chronicle.Events.EventType`, all proven via already-existing `get-started/client-flow.md`/`test-event.md`/`test-reactor.md` snippets in those repos.
- `get-started/console/connect` — literally already shown for all 5 clients elsewhere (`client-flow.md`); this tab is a pure duplicate that was never opened up to more clients.
- `tutorial/first-event/book-added`, `tutorial/read-model/events`, `tutorial/reacting/notification-sent-event` — basic event type definitions, trivially portable, same shape as already-proven snippets.
- `tutorial/reacting/waitlist-notifier` — Kotlin has real constructor-injection equivalent (`IReactorsService.register(reactor: Any)`, `observation/ReactorsService.kt`); Elixir/TypeScript achievable with ordinary function calls inside the handler (different idiom, same result).

### Mixed — split verdict per client (need per-client judgment, not blanket treatment)
- `get-started/common/book-read-model` / `tutorial/read-model/book` — **Kotlin/Java: genuine gap** (no literal/conditional `[SetValue<T>]` equivalent; `ISetBuilderFor` only offers `.to()/.toEventSourceId()/.toProperty()` per `IProjectionBuilderFor.kt`). **Elixir: under-migrated** (`set:` DSL supports literals, `read_models/read_model.ex`). **TypeScript: under-migrated** (`setValue()`/`setFrom()` exist, and a TS snippet for this exact concept ALREADY EXISTS at `Chronicle.TypeScript/Documentation/client-snippets/get-started/common/book-read-model.md` but isn't wired into the shared tab's `clients=` list — check this class of "already exists, just not wired" case in every directory before writing new content from scratch).
- `get-started/common/borrowed-book-read-model` / `tutorial/read-model/borrowed-book` — Kotlin/Java: genuine gap (no `RemovedWith` equivalent anywhere). Elixir: under-migrated (`removed_with/2` macro, `read_model.ex:187`). TypeScript: under-migrated (`removedWith()`, `projections/modelBound/removedWith.ts`).
- `get-started/common/query-read-models` — Kotlin/Java: genuine gap, partial (`getInstanceByKey` exists, no "get all instances" method at all, `IReadModelsService.kt`). Elixir: under-migrated (`get_instances/2`/`all/2`, `read_models.ex`).
- `get-started/common/materialized-paging` — Kotlin/Java: genuine gap (no paging API found at all). Elixir: under-migrated (`query/2` with `:page`/`:page_size`, `read_models.ex:341`).
- `tutorial/reacting/reading-state` — Kotlin/Java: under-migrated (`getInstanceByKey` + manual constructor injection both proven). Elixir: under-migrated with caveat (no context injection; call `Chronicle.ReadModels.get_instance_by_id/3` directly against the registered client process, requires the read model be `passive: true`). TypeScript: genuine gap for the injection mechanism specifically (`getInstanceById` exists but reactors are always no-arg-constructed, `Reactors.ts:206` — would need a different snippet shape, e.g. shared client singleton import, not a direct port of the C# constructor-injection pattern).
- `tutorial/reacting/explicit-append` — all three (Kotlin/Java, Elixir, TypeScript): under-migrated, real equivalents proven (`AppendResult.isSuccess` in Kotlin `AppendResult.kt` and TS `eventSequences/AppendResult.ts`; Elixir `Chronicle.append/2` returns `:ok | {:error, term()}`).

### Confirmed genuine gap, no equivalent anywhere in any of the 4 non-C# clients
- Typed `EventSourceId<T>` wrapper — Kotlin/Elixir/TypeScript all use raw strings for event-source ids, no wrapper-with-factory pattern (`tutorial/first-event/book-id`, `tutorial/first-event/append` — the append tab specifically builds on `BookId.New()`; a plain-string-id variant of the same snippet would be under-migrated instead of a gap).
- `[OnceOnly]` idempotency (`tutorial/reacting/once-only`) — zero hits searching Kotlin/Elixir/TypeScript source for onceonly/once_only/idempoten* patterns.
- Reactor-return-value auto-append convention (`tutorial/reacting/side-effect`) — none of the three auto-append a reactor handler's return value; Kotlin's dispatch loop, Elixir's `dispatch_event/2`, and TypeScript's `Reactors.ts:257` all discard/ignore it. Explicit append (`IEventLog.Append` from inside the handler) is the only path in all three.

### Borderline, doc-scope choice rather than SDK gap
- `get-started/common/mongo-query`, `tutorial/read-model/{query,borrowed-books-query}` — raw native-MongoDB-driver access bypassing the Chronicle client entirely (explicitly framed that way in prose). Every language has its own MongoDB driver so equivalent snippets are technically writable, but this isn't a Chronicle SDK capability question — low priority, would not require any client SDK verification, just driver-idiom snippets.

## Client-specific docs duplication findings (done — a second, separate audit)

Worst offenders found (full list; a research agent read every prose page in all 4 client-specific trees and compared content, not just checked `sharedTopicBridge: true` frontmatter presence):

1. **Correlation/identity/causation explained 4 times, no cross-reference** — Elixir's `context.md` (284 lines, no bridge) + TypeScript's `correlation.md` (109) + `identity.md` (91) + `auditing.md` (100), none bridged to each other or to a shared doc. **Clearest consolidation candidate in the whole audit.**
2. **Jobs and Webhooks have NO shared doc page at all** — only Elixir (`jobs.md` 111 lines, `webhooks.md` 129 lines) and TypeScript (`jobs.md` 46 lines, `webhooks.md` 64 lines) document them, at very different depths, no shared anchor to bridge to. Kotlin and .NET don't document Jobs/Webhooks at all. **This is a real coverage gap in the shared corpus** (a `Chronicle/Documentation/**` jobs/webhooks concept page needs to exist), not just a client-side duplication problem.
3. **Elixir `event-store-subscriptions.md`** (140 lines, no bridge) re-teaches outbox/inbox/implicit-explicit-subscriptions already owned by shared `subscriptions/{index.md,implicit-subscriptions.mdx,explicit-subscriptions.mdx,outbox-inbox.mdx}`.
4. **Elixir `sinks.md`** (91 lines) vs **TypeScript `sinks.md`** (55 lines) — both re-explain "what is a sink" duplicating shared `sinks/index.mdx`, ~40% depth mismatch, neither bridges.
5. **Elixir `event-stores.md`** (203 lines, no bridge) — its Overview re-explains event store/namespace/multi-tenancy concepts already owned by shared `concepts/event-store.md`/`concepts/namespaces.md` before reaching legitimate Elixir-specific discovery-API mechanics.
6. **Kotlin `get-started/index.md`** (137 lines, no bridge) — explains reactors/reducers as general concepts inline, no links to shared `reactors/`/`reducers/` pages.
7. **Kotlin `reference/annotations.md`**'s `@Pii` entry over-explains the general compliance/encryption-at-rest mechanism instead of just the annotation's own parameters.
8. **Kotlin `reference/configuration.md`**'s "Namespace" section over-explains general tenant isolation with no link out.
9. **`.NET clients/dotnet/getting-started.md`** (71 lines) re-explains general event-sourcing concepts in prose (append→projection/reducer/reactor flow) rather than bridging per-concept; only 2 prose pages total in the whole .NET client tree, neither uses `sharedTopicBridge: true` (0/2, vs Kotlin 14/20, Elixir 12/23, TypeScript 12/20).
10. TypeScript's own bridge convention is inconsistently applied: 12/20 files use `sharedTopicBridge: true` correctly, but `correlation.md`, `identity.md`, `auditing.md`, `sinks.md`, `jobs.md`, `webhooks.md` (6 files) skip it entirely.

## 2026-07-04 update, part 2 — `get-started/common/**` batch 1 done (7 of 8 tabs)

Wired real Kotlin/Java/Elixir content (or honest "does not support this workflow yet" stubs for confirmed genuine gaps) into 7 of the 8 `get-started/common/**` tabs:

- **`a-events`, `append`, `reactor`** (under-migrated, real content added for all 3 new clients): Kotlin/Java `@EventType`/`eventLog.append()`/`@Reactor`, Elixir `use Chronicle.Events.EventType`/`Chronicle.append/2`/`use Chronicle.Reactors.Reactor`. Verified against real source: Kotlin's `ReactorsService.kt` confirms reactors are discovered by **second-parameter type** (like C#), not by method name (unlike TypeScript) — checked directly, not assumed from the single-method `test-reactor.md` precedent. Java requires the existing `BuildersKt.runBlocking(...)`-plus-`Continuation` boilerplate for any snippet touching a suspend function (`append`) — verbose, but it's the established, only way to call Kotlin suspend APIs from Java in this corpus (mirrors `client-flow.md`).
- **`book-read-model`, `borrowed-book-read-model`, `query-read-models`, `materialized-paging`** (mixed verdict): added real Elixir content (`set:`/`removed_with`/`Chronicle.all/2`/`Chronicle.ReadModels.query/2` with `page`/`page_size` — confirmed via `read_model.ex`'s own extensive moduledoc and `read_models.ex`'s `query/2`). Added "does not support this workflow yet" stubs for Kotlin **and** Java (confirmed: `IProjectionBuilderFor.kt` has no literal-value setter, only `SetFrom`; no `RemovedWith` annotation exists anywhere; `IReadModelsService.kt` only has `getInstanceByKey`, no "get all" or paging method at all). TypeScript was already real and wired for these (pre-existing, just needed `clients=` widened to include the 3 new ones).
- Fixed a genuine prose bug found while doing this: the shared tip about wrapping ids in a typed `BookId` said "the tutorial shows exactly that" without scoping — but the typed-id wrapper is a confirmed C#-only capability (see genuine-gap list below), so the tip was factually wrong for Kotlin/Elixir/TypeScript readers now seeing this section. Rewrote it to name the C#-specific pattern explicitly and state plainly that the other three clients use plain string ids. Same fix applied to the `OnLoan`/`RemovedWith`/"get all instances"/paging prose — each now says explicitly which languages lack the capability, rather than silently only-ever-showing C#/TypeScript and leaving the reader to guess why other tabs are simply missing.

**Not yet done from `get-started/common/**`**: `mongo-query` (native MongoDB driver access, doc-scope choice not an SDK gap — low priority, see plan below).

Verified: `python3 Documentation/validate-client-snippets.py` (C#, 0 errors — untouched but re-verified since shared prose changed), `python3 Chronicle.TypeScript/Documentation/validate-client-snippets.py` (TypeScript, 0 errors), `npm run chronicle-client-docs:check` (audit passed, confirms every listed client for every touched tab has a real snippet file on disk — this check runs regardless of local toolchain availability, so it's a genuine signal even for Kotlin/Java/Elixir), full `npm run build` (841 pages), `node scripts/lint-docs.mjs` (0 errors, 195 pre-existing warnings unchanged), and a live screenshot + markdown-mirror text check confirming Elixir's real content and Kotlin/Java's stub text both render correctly in the actual tabs.

**Not verified**: Kotlin/Java/Elixir compilation for real (no local toolchain, per the accepted tradeoff). Every API claim in this batch was checked against real SDK source with file path citations (see above) — this is the most that's achievable without CI. If a future session gets access to Kotlin/Java/Elixir toolchains, running `Documentation/Chronicle.Kotlin/Documentation/validate-client-snippets.py` and the Elixir equivalent against this batch specifically would be the highest-value thing to confirm.

**Remaining in `get-started/**` + `tutorial/**`** (per the part-1 classification): `get-started/console/connect` (pure duplicate, trivial port), `tutorial/first-event/{book-added,book-id,append}`, `tutorial/read-model/{events,book,borrowed-book,query,borrowed-books-query}`, `tutorial/reacting/{notification-sent-event,waitlist-notifier,reading-state,explicit-append,once-only,side-effect}`. Same methodology: verify per-client source, write real content or honest gap-notes, never guess.

## 2026-07-04 update, part 3 — `get-started/**` and `tutorial/**` are now FULLY DONE (the whole audited section from part 1)

Finished the rest of `get-started/console/connect` and all of `tutorial/**` (first-event, read-model, reacting — 14 tabs across 3 pages). Combined with part 2's `get-started/common/**` batch, **the entire part-1 audited scope is complete**.

### `get-started/console/connect` (1 tab)

Pure duplicate case confirmed correct — wrote real Kotlin/Java/Elixir/TypeScript content mirroring the already-proven `client-flow.md` pattern (connect + get event store + print name), verified `ChronicleOptions.development()`/`getEventStore(name, namespace)` exact signatures per client first (Java needed both args explicit — no `@JvmOverloads` on `getEventStore`, confirmed by grep).

### `tutorial/first-event.mdx` (3 tabs)

- `book-added` — under-migrated, real content all 4.
- `book-id` — genuine gap confirmed (typed `EventSourceId<T>` doesn't exist anywhere else) — unsupported stubs, and rewrote the surrounding prose to say so explicitly instead of just silently narrowing the tab.
- `append` — real content for all 4, using **plain generated string/Guid ids** (not a typed wrapper) — matches part-1's note that a plain-id variant of this snippet is under-migrated, not a gap.

### `tutorial/read-model.mdx` (5 tabs, 2 skipped)

- `events` (renamed to `a-events` — see bug below), `book`, `borrowed-book` — same mixed-verdict shape as `get-started/common`'s equivalents (Kotlin/Java gap on `[SetValue<T>]`/`[RemovedWith<T>]`; Elixir/TypeScript real). Prose updated to name the gap explicitly at each tab.
- `query`, `borrowed-books-query` — left `csharp`-only, deliberately, per part 1's "borderline, doc-scope choice not an SDK gap, low priority" call (native MongoDB driver access bypassing Chronicle entirely; every language has its own driver, but porting isn't a Chronicle-SDK-parity question).

### `tutorial/reacting.mdx` (6 tabs) — found and corrected a part-1 classification error via deeper verification

- `notification-sent-event` — under-migrated, trivial, real content all 4.
- `waitlist-notifier` — under-migrated, real content all 4 (Kotlin/Java: constructor-injected notification interface, real per `IReactorsService.register(reactor: Any)` taking a pre-built instance; Elixir/TypeScript: module-level function call instead of constructor injection, since neither supports reactor DI).
- `once-only` — genuine gap confirmed, all 4 (zero hits for onceonly/once_only/idempoten* patterns anywhere in 3 SDKs' source).
- **`reading-state` and `explicit-append` — corrected from part 1's "under-migrated" to a genuine gap for Kotlin/Java (both) and TypeScript (explicit-append only... actually both)**: part 1 assumed Kotlin/Java could call `getInstanceByKey`/`append` from inside a reactor handler because the SDK *has* those methods. Deeper verification this part found they're both `suspend fun`, while `ReactorsService.kt`'s dispatch loop calls handler methods via plain `fn.call(reactor, event, ctx)` — **not** `callSuspend()` — meaning **reactor handler methods cannot be `suspend` at all**, so they structurally cannot `await` any suspend API. There's no established/safe bridge pattern in this corpus (a nested `runBlocking` inside the dispatch coroutine's own scope is the only technical option and is fragile enough — thread-pool exhaustion risk — that teaching it felt irresponsible without being able to test it). Marked both **unsupported** for Kotlin/Java. Separately, TypeScript reactors are confirmed always constructed via a hardcoded no-arg constructor (`Reactors.ts`, literal `new (reactorType as new () => ...)()`) with no DI mechanism and no established module-singleton workaround anywhere in the corpus — marked `explicit-append` unsupported for TypeScript too (matching `reading-state`, which part 1 had already correctly flagged as a TS gap). **Elixir has neither limitation** (`Chronicle.append/2` and `Chronicle.read_model/3` are plain module functions needing no injected reference, and Elixir reactor handlers are ordinary synchronous callbacks with no suspend/coroutine distinction) — real content for both, verified against `chronicle.ex`'s own moduledoc-documented API.
- `side-effect` — genuine gap confirmed, all 4 (none of the 3 non-C# SDKs auto-append a reactor handler's return value; explicit append is the only path everywhere but C#).

### Bugs found and fixed while writing this batch

- **TS decorator-value ordering bug recurred** (the exact class documented in the legacy-migration handoff's reminders 6/15/17): `tutorial/read-model/book.md` (`@setValue(BookAdded/BookBorrowed/BookReturned, ...)`) sorted alphabetically **before** `tutorial/read-model/events.md` (which declares those event classes) — `"book" < "events"` — causing `TS2449: Class used before its declaration`. Fixed with the established technique: renamed to `a-events.md` in **all 4 non-C# client repos plus the C# one** (the snippet id is shared across every `<ChronicleClientTabs>` participant, so the id must be renamed everywhere, not just where the bug manifested), and updated the shared `.mdx`'s `snippet=` attribute to match.
- **Elixir cross-file consistency**: `waitlist-notifier.md` and `reading-state.md`/`explicit-append.md` all reference a `MyApp.NotificationService` stub module — since the Elixir validator concatenates every snippet file into **one** compilation (confirmed by reading `generate_test()`), defining the same module twice across snippet files is a real duplicate-module error. Fixed by defining the stub **once** (in `waitlist-notifier.md`, with both a 1-arg and 2-arg `notify_next_in_line` clause so every caller's arity is covered) and having every other file that needs it just `alias` it, never redeclare it. Same reasoning applied to `MyApp.ReadModels.Book` — `reading-state.md` originally redefined it; fixed to alias the one already declared in `read-model/book.md`.
- **TypeScript `Guid` import path**: initially imported `Guid` from `@cratis/fundamentals` (technically where it's defined) instead of `@cratis/chronicle`, which every existing validated snippet in the corpus actually imports it from (a re-export). Caught by grepping existing precedent before trusting my own assumption — fixed to match established convention.
- **TypeScript `noUnusedParameters`/no-DOM-lib constraints**: `Source/tsconfig.json` has `lib: ["ES2022"]` only (no `"DOM"`) and no `@types/node` dependency — so neither the Web Crypto global `crypto.randomUUID()` nor `import { randomUUID } from 'node:crypto'` type-checks. Used `Guid.create()` (the corpus's own real, already-imported-elsewhere utility) for generating illustrative ids instead of reaching for a runtime API the project's own compiler config doesn't support.

Verified: C# validator (`validate-client-snippets.py`, 0 errors) and TypeScript validator (0 errors, this is the one that actually caught the decorator-ordering bug for real) both run for real after every batch; Kotlin/Java/Elixir remain source-verification-only per the accepted tradeoff. Full chain re-run after the whole batch: `npm run chronicle-client-docs:check` (0 legacy, 0 direct fences, all snippet files present for every listed client), `npm run build` (841 pages, unchanged), `node scripts/lint-docs.mjs` (0 errors, 195 pre-existing warnings), and a live screenshot + markdown-mirror check of `/chronicle/tutorial/reacting/` confirming every tab (real content and "not supported" stubs alike) renders correctly.

**New standing reminders for this effort** (distinct from the legacy-migration handoff's list, though related): (1) **new** — before marking a Kotlin/Java snippet "under-migrated" because the SDK *has* the needed method, check whether that method is `suspend` AND whether the calling context (e.g. `ReactorsService.kt`'s dispatch) invokes handlers via plain `.call()` rather than `.callSuspend()` — if so, the handler itself cannot be suspend, and the API is structurally unreachable from that context regardless of whether it "exists." (2) **new** — TypeScript reactors have a hardcoded no-arg constructor (`Reactors.ts`) with no DI mechanism at all; any pattern requiring a reactor to hold an injected reference (an event store, a service) is a TypeScript gap unless the corpus already has an established module-singleton workaround — don't invent one ad hoc. (3) **new** — the Elixir validator merges every snippet file into one compilation (confirmed via `generate_test()`); never redeclare a module (event type, read model, stub service) that another snippet file in the same directory tree already declares — alias/reference it instead, and if multiple call arities are needed across files, add every arity to the ONE shared declaration.

## Part 4 — `events/**` (concurrency, cross-cutting-properties, event-source-id, getting-events, getting-state, redaction, filtering, observing-appends, appending*, transactions)

Went through every remaining file directly under `Chronicle/Documentation/events/` (concurrency, cross-cutting-properties, and event-source-id were covered earlier in part 3's tail-end and are not repeated here). Two important repo-layout facts surfaced this part and are worth recording permanently:

- **Two live checkouts of the C# `Chronicle` repo exist on this machine**: `/Volumes/sourcecode/repos/cratis/Chronicle` (a standalone sibling clone, at a newer commit, with the actual `<ChronicleClientTabs>`-based `events/**` content) and `/Volumes/sourcecode/repos/cratis/Documentation/Chronicle` (a git submodule reference, at an older commit, still showing pre-migration raw C# fences with stale/wrong API shapes). Per `sync-content.mjs`'s `firstExisting()` resolution (sibling path tried first, submodule path as fallback), **the sibling `cratis/Chronicle` wins and is what the site actually builds from** — the submodule copy is inert as long as the sibling exists. Always edit `/Volumes/sourcecode/repos/cratis/Chronicle/Documentation/**`, never `/Volumes/sourcecode/repos/cratis/Documentation/Chronicle/**`.
- **Kotlin, Elixir, and TypeScript have no equivalent standalone sibling** — only `/Volumes/sourcecode/repos/cratis/Documentation/Chronicle.Kotlin`, `Documentation/Chronicle.Elixir`, `Documentation/Chronicle.TypeScript` exist, so for those three clients the submodule-style path *is* the real, active one. This matches every read/write already done in this effort for those three clients — no correction needed there, just confirmed and now written down so it's not re-litigated.

### `events/getting-events.mdx` (3 tabs)

- `for-event-source` (C# `GetForEventSourceIdAndEventTypes`) — **Elixir has a real equivalent**: `Chronicle.EventSequences.EventLog.get_for_event_source(id, event_types: [...])`, confirmed via full source read of `event_log.ex` (public `def get_for_event_source/2`, not delegated at the top-level `Chronicle` module but directly callable). Kotlin/Java/TypeScript: confirmed genuine gap — their public `IEventSequence`/`IEventLog` surfaces expose only `append`/`appendMany`/`hasEventsFor` (Kotlin/Java) or those plus `getTailSequenceNumber` (TypeScript); no raw event reading anywhere. Real Elixir snippet written; explicit "does not support this workflow yet" stubs added for Kotlin/Java/TypeScript (asymmetric — Elixir proves the capability isn't inherently C#-only, so the other three needed an honest note, not silent omission); `clients=` widened to all 5.
- `from-checkpoint` (`GetFromSequenceNumber`) — genuine gap for **all** non-C# clients (Elixir's `get_tail_sequence_number` hardcodes `EventTypes: []` with no from-sequence-number equivalent at all; Kotlin/Java/TypeScript have nothing). Left `csharp`-only, no stubs — uniform gap, matches the `concurrency.mdx` precedent (asymmetric gaps get honest stubs; uniform C#-only capabilities don't need clutter).
- `tail` (combines `GetTailSequenceNumber` + `GetFromSequenceNumber`) — same uniform-gap reasoning; left `csharp`-only. Added a cross-reference note pointing to `getting-state` for the tail-*number* alone, which Elixir/TypeScript can do.

### `events/getting-state.mdx` (3 tabs)

- `tail` (bare `GetTailSequenceNumber()`) — **Elixir and TypeScript both have real equivalents** (`Chronicle.get_tail_sequence_number()` top-level delegate; TS `IEventSequence.getTailSequenceNumber(eventSourceId?)`). Kotlin/Java: confirmed **no such method exists anywhere** in the Kotlin SDK source (`grep` for `TailSequenceNumber` across all of `Source/` returned nothing) — genuine gap. Real snippets written for Elixir/TypeScript; stubs added for Kotlin/Java; `clients=` widened to all 5.
- `tail-for-event-source` (scoped by event source + event-type filter) — genuine gap for all non-C# clients: Elixir's `get_tail_sequence_number` hardcodes `EventTypes: []` in its gRPC request with no options to override it (confirmed by reading the full function body, not just its doc comment); TypeScript's `getTailSequenceNumber` takes only an optional `eventSourceId`, no event-type filter; Kotlin/Java have no method at all. Left `csharp`-only.
- `tail-for-observer` (`GetTailSequenceNumberForObserver`) — genuine gap, all non-C# clients; nothing resembling observer-aware tail computation exists anywhere. Left `csharp`-only.

### `events/redaction.mdx` (6 tabs) — confirmed uniform genuine gap, no changes

Grepped all three non-C# SDK source trees for `redact`/`Redact` — zero hits anywhere (Kotlin, Elixir, TypeScript). Redaction is a C#-only capability today across the board. Left entirely as `csharp`-only; no stub files (uniform gap, not asymmetric).

### `events/filtering/**` (3 files: by-event-source-type, by-event-stream-type, by-tag; 6-7 tabs total) — confirmed uniform genuine gap, no changes

These declare `[EventSourceType]`/`[EventStreamType]`/`[FilterEventsByTag]` on a **reducer or reactor** to filter which events it's dispatched. Checked each non-C# client's reactor registration mechanism directly: Kotlin's `@Reactor` annotation has only an `id` property (`Reactor.kt`); Elixir's `use Chronicle.Reactors.Reactor` + `@handles` only declares event types, no source-type/stream-type/tag filter option (confirmed via the macro's full moduledoc); TypeScript's `reactor()` decorator takes only `id` and `eventSequenceId` (the `FilterTags`/`EventSourceType`/`EventStreamType` fields visible in `Reactors.ts`'s internal registration payload are hardcoded "no filter" defaults, not exposed as decorator parameters anywhere). Confirmed uniform C#-only gap across all three attributes/tabs. Left as `csharp`-only, no stubs.

### `events/observing-appends.mdx` (4 tabs: shape, subscribing, wait-for-completion-append, wait-for-completion-append-many) — confirmed uniform genuine gap, no changes

This is Chronicle's `IEventSequence.AppendOperations` Rx.NET-style `IObservable<T>` plus the `WaitForCompletion()` extension from `Cratis.Chronicle.Observation` — grepped all three non-C# SDKs for any append-observable or wait-for-completion concept; zero hits (TypeScript's generated gRPC contracts do define `WaitForObserverCompletionRequest`/`Response` types internally, but there is no public wrapper function anywhere in `Source/` exposing them — confirmed by searching the actual hand-written `Source/` tree, not the generated `.contracts` package). Left `csharp`-only, no changes.

### `events/appending.mdx`, `appending-many.mdx`, `appending-with-tags.mdx`, `transactions.mdx` — already fully migrated, no changes needed

All tabs in these four files are already at `clients="csharp,kotlin,java,elixir,typescript"` except `appending.mdx`'s `occurred` tab, which is correctly `csharp,elixir`-only (Kotlin/Java/TypeScript `AppendOptions` types confirmed via source to have no `occurred`/timestamp-override field at all — genuine gap, already correctly scoped from earlier work, re-verified this part and left untouched).

### Verification

Ran the full chain after this batch: `npm run sync` (670 `ChronicleClientTabs` placeholders now, up from before this part's additions; 1 pre-existing broken toc entry unrelated to this work — no toc.yml files were touched this part), `npm run chronicle-client-docs:check` (0 legacy snippets across all 5 clients, 0 direct fences, C# validator passed for real, TypeScript validator passed for real, Kotlin/Java/Elixir blocked-by-toolchain as expected), `npm run build` (841 pages, clean), `node scripts/lint-docs.mjs` (0 errors, 196 pre-existing style warnings), and a markdown-mirror spot check of `dist/chronicle/events/getting-events.md` confirming the Elixir tab shows real code and the Kotlin/Java/TypeScript tabs render the exact `does not support this workflow yet` stub text.

**events/** is now fully audited — every remaining gap is a confirmed, source-verified genuine SDK limitation (not an oversight), and every asymmetric gap (where at least one non-C# client can do something the others can't) has an honest inline prose note plus an explicit stub tab. No further events/** work is needed unless the underlying SDKs gain new capabilities.

## Part 5 — `reactors/**` and `reducers/**`

### Key finding: reducers are a real, working SDK feature in Kotlin and Elixir — just never wired into the shared docs

Before this part, `reducers/getting-started.mdx` only listed `csharp,typescript`, which reads as "Kotlin/Java/Elixir don't have reducers." That's wrong — confirmed via source that Kotlin (`observation/Reducer.kt`, `ReducersService.kt`, `IReducersService.kt`) and Elixir (`reducers/reducer.ex`) both have complete, working reducer implementations. This was a genuine **under-migration**, not a gap — the biggest finding of this part.

- **Kotlin/Java dispatch** (`ReducersService.kt`): handler methods take `(event)` or `(event, current)` — **no `EventContext` parameter, ever** (dispatch is hardcoded to `params.size == 2` or `3`, and the 3rd param is always `current`, never context). Return value **is** the new read-model state (unlike reactors, where the return value is ignored) and read-model type is inferred from the first handler's return type. Non-suspend only (`fn.call`, not `callSuspend`).
- **Elixir dispatch** (`reducer.ex`): a single `reduce/3` callback per module, pattern-matched per event struct, `use Chronicle.Reducers.Reducer, model: ReadModelModule, id: "..."`. **Does** receive a context map as the 3rd argument (`event_source_id`, `sequence_number`, `occurred`, `observation_state`) — richer than Kotlin/Java here.
- **TypeScript dispatch** (`Reducers.ts` line ~327): `await reducerInstance[entry.methodName](content, currentState)` — **2 args only, no context**, but the call **is** awaited, so an `async` handler works (unlike Kotlin/Java, which can't await). Confirmed by reading the actual dispatch loop, not just the type signature.

Wrote real Kotlin/Java/Elixir content (matching each language's real constraints above) and widened `clients=` to all 5 for: `reducers/getting-started.mdx`'s `read-model`, `reducer-implementation`, `retrieving-state` tabs, `reducers/index.mdx`'s and `reactors/index.mdx`'s `basic-example` tabs (both were also stuck at `csharp,typescript` despite Kotlin/Elixir having no blocker), and `reactors/event-processing.mdx`'s `event-context` tab (a plain event+context handler — every client supports this, confirmed via each one's real dispatch mechanism).

### `reducer-attribute` — a genuine TypeScript under-migration caught mid-investigation

`reducers/getting-started.mdx`'s `reducer-attribute` tab was `csharp`-only, but TypeScript's `reducer(id, eventSequenceId, readModel)` decorator already supports both `id` and an explicit event sequence — confirmed via `reducer.ts`'s real signature. Wrote the TS snippet and widened to `csharp,kotlin,java,elixir,typescript` (Kotlin/Java/Elixir get `id`-only, since none of their reducer registration options include an event-sequence override — confirmed via `Reducer.kt`'s annotation properties and the Elixir moduledoc's documented `use` options). Same finding applied to `reactors/event-sequence.mdx`'s equivalent `reactor-attribute` tab, which was already correctly `csharp,typescript` from earlier work — re-verified, no change needed there.

### Confirmed uniform genuine gaps (no widening, honest `:::note` added instead of silent omission)

- **`reactors/side-effects.mdx`** (12 tabs) — auto-appending a reactor's return value as a side-effect event is C#-only. Kotlin/Java ignore the return value entirely (confirmed in `ReactorsService.kt`'s dispatch, which never reads `fn.call()`'s result); Elixir's `handle/2` return (`:ok`/`{:error, _}`) is a success/failure signal, not an event; TypeScript's dispatch doesn't inspect the return either. All 4 other clients append follow-up events by calling the append API explicitly inside the handler instead.
- **`reactors/once-only.mdx`** — `OnceOnly` attribute has no equivalent anywhere else; side effects must be designed idempotent instead (already the documented convention elsewhere).
- **`reactors/filtering.mdx`, `reducers/filtering.mdx`** (observer-level `[FilterEventsByTag]`/`[EventSourceType]`/`[EventStreamType]`) and **`reactors/external-event-store-subscriptions.mdx`, `reducers/external-event-store-subscriptions.mdx`** (`[EventStore]`-attribute-driven inbox routing) — confirmed C#-only via the same reasoning as `events/filtering.mdx` in part 4 (no filter/EventStore attribute concept anywhere in Kotlin's `@Reactor`/`@Reducer`, Elixir's `use ... Reactor/Reducer`, or TypeScript's `reactor()`/`reducer()`).
- **`reactors/event-sequence.mdx`, `reducers/event-sequence.mdx`** (the standalone `[EventSequence]`/`[EventLog]` attributes, as opposed to the inline parameter already covered above) — C#-only; TypeScript reaches the same end result through the inline decorator parameter instead of a separate attribute, so it's not a capability gap for TS, just a different syntax already shown elsewhere on the same page.
- **`reactors/event-processing.mdx`**'s `dependencies`/`read-model-key` tabs and **`reducers/passive-reducers.mdx`** (`isActive`/`[Passive]`) and **`reducers/tagging-reducers.mdx`** (`[Tag]`/`[Tags]`) — all confirmed C#-only; none of the other 3 clients' registration mechanisms expose DI-resolved extra parameters, an active/passive toggle, or tagging.
- **`reactors/event-processing.mdx`**'s `supported-signatures` tab and **`reducers/event-processing.mdx`**'s 13 non-context pattern/signature tabs (method-discovery, basic-sync/async patterns, first-event, the 5 "processing pattern" tabs, skip-invalid-state, recording-errors, minimize-object-creation, reuse-collections) — **left as a single C# reference with one clarifying `:::note` per page** rather than translated 4x each. Rationale (a deliberate scope call, not a gap-avoidance shortcut): these are elaborations/idioms on top of a mechanism already fully and correctly shown per-client in `getting-started.mdx` — porting 13+12 pattern tabs across 4 languages each would be ~100 more snippet files for illustrative variations on `with`-expression-style immutable updates, not new API surface. The note tells the reader exactly which primitives differ per client (context availability, async support) and points back to `getting-started` for the real per-client shape.

### Verification

`npm run sync` (670 placeholders, unchanged — this batch only widened `clients=` on existing tabs and added 2 new snippet files' worth of content to already-existing single-tab pages, no brand-new `<ChronicleClientTabs>` lines), `npm run chronicle-client-docs:check` (0 legacy, 0 direct fences, C# and TypeScript validators passed for real, Kotlin/Java/Elixir blocked-by-toolchain as expected), `npm run build` (841 pages, clean), `node scripts/lint-docs.mjs` (0 errors, 196 pre-existing warnings), and a markdown-mirror spot check of `dist/chronicle/reducers/getting-started.md` confirming the Elixir tab renders real, correct code.

**Standing reminder added**: before concluding "this client doesn't support X" from a `clients=` attribute alone, **check the actual source** — a narrow `clients=` list can just mean "nobody wired this tab yet," not "the SDK can't do it." This part's `reducers/getting-started.mdx` (`csharp,typescript` for a feature Kotlin and Elixir both fully support) is exactly that trap, and it was sitting in the single most-visible reducers page.

## Part 6 — `concepts/**`

Went through all 20 files in `Chronicle/Documentation/concepts/`; 14 are pure prose (`.md`, no `<ChronicleClientTabs>`) and needed no work. Of the 6 with tabs:

### Under-migrated, fixed with real content

- **`event-type-migrations.mdx`** (5 tabs, was `csharp,typescript`) — **Elixir has a full, real migration system** (`Chronicle.Events.Migration` behaviour + `MigrationBuilder` with `rename_property`, `default_value`, `split_property`, `combine_properties` — confirmed via source and its own test file for the exact 0-based `part` index convention). Wrote real Elixir content for all 5 tabs (defining-migrations, split, combine, rename, default-value), widened to all 5 clients. Kotlin/Java confirmed a genuine, total gap — zero hits for "migration" anywhere in the Kotlin SDK source — added stubs and a clarifying note.
- **`designing-read-models.mdx`** (2 tabs, was `csharp,typescript`) — `strongly-consistent` (a plain `getInstanceByKey`/`read_model` call) is real everywhere; wrote Kotlin/Java/Elixir content reusing the same pattern established in part 5's reducer work. `query-ladder` (get-all-instances + materialized paging) — **Elixir has both** (`Chronicle.all/1` for strongly-consistent replay-all, `Chronicle.ReadModels.query/2` for materialized paging with `page`/`page_size`, confirmed via `read_models.ex`); wrote real Elixir content and widened. Kotlin/Java confirmed a genuine gap — `IReadModelsService` has only `getInstanceByKey`, no bulk/paged read at all.
- **`modeling-events.mdx`** (3 tabs, was `csharp`-only) — these are pure event-shape illustrations (fact-vs-intent naming, single-purpose events, no-nullable-property pattern) with no framework-API dependency at all, so genuinely portable to every client. Wrote real Kotlin/Java/Elixir/TypeScript content and widened all 3 tabs to all 5 clients.
- **`subject.mdx`** (3 tabs, was `csharp`-only) — **Elixir's `append/3` has a real `:subject` option** (confirmed in `event_log.ex`'s moduledoc and the request-building code). Wrote Elixir content for `default` and `explicit`, widened those two, added Kotlin/Java/TypeScript stubs (asymmetric — Elixir proves it isn't inherently C#-only). The third tab, `implicit-with-attribute` (a `[Subject]` property attribute for auto-derivation), stays C#-only — confirmed no such attribute exists in Elixir's `EventType` macro either, so it's still a genuine gap even though Elixir supports the *explicit* subject path.

### Confirmed uniform genuine gaps (no widening, `:::note` added)

- **`geospatial.mdx`** — `Point`/`LineString`/`Polygon` from Cratis.Fundamentals have zero equivalent in any of the other 3 client SDKs (grepped all three; no geospatial type anywhere).
- **`tagging-reactors.mdx`** — same `[Tag]`/`[Tags]`-on-observer mechanism already confirmed gap in part 5 for reducers; applied the identical note to the reactor version.
- **`tagging.mdx`** (14 tabs) — mostly the same static-tag/observer-tag mechanism (uniform gap), **except** dynamic append-time tags: Elixir's `append/3` supports a real `:tags` option (confirmed in the moduledoc), so wrote real Elixir content for `dynamic-event-tags` (noting in the snippet comment that the resulting tag count differs from C#'s example, since Elixir can't add the *static* tags that C#'s version of the same event also carries) and widened that one tab; Kotlin/Java/TypeScript get stubs (no `tags` append option in any of the three, confirmed via each language's `AppendOptions`/append signature). One consolidated `:::note` at the top of the page covers the remaining 13 static-tag/observer-tag/context tabs rather than 13 individual notes.

### Verification

`npm run sync`, `npm run chronicle-client-docs:check` (0 legacy, 0 direct fences, C# and TypeScript validators passed for real — this is what actually confirmed the new Elixir-inspired TS content already existed correctly and the new C#-side widening didn't break anything), `npm run build` (841 pages, clean), `node scripts/lint-docs.mjs` (0 errors, 196 pre-existing warnings), and a markdown-mirror spot check of `dist/chronicle/concepts/event-type-migrations.md` confirming the new Elixir tab renders real, correct code.

### What's left in this effort

- [x] `get-started/**` + `tutorial/**`
- [x] `events/**`
- [x] `reactors/**`, `reducers/**`
- [x] `concepts/**`
- [x] `projections/**` (largest section — 210 tabs, done via 3 parallel agents — see part 7)
- [x] `constraints/**`, `compliance/**`, `testing/**`, `scenarios/**` (see part 8)
- [x] `subscriptions/**`, `read-models/**` (see part 9)
- [x] `namespaces/**`, `hosting/**`, `migrations/**`, `configuration/**`, `connection-strings/**`, `event-seeding/**`, `closing-streams/**`, `sinks/**`, `contributing/**` (see part 10 — mostly confirmed out of scope/uniform-gap, one real Elixir win)
- [x] `code-analysis/**` — confirmed genuinely C#/Roslyn-only (41 tabs, all `csharp`; the page's own first sentence already says "for the .NET client"). Zero changes needed, no verification re-run required.
- [x] **The entire client-tabs sweep of `Chronicle/Documentation/**` is now complete** — every directory with `<ChronicleClientTabs>` has been audited at least once.
- [x] **Client-specific docs consolidation — fully done.** New shared Jobs/Webhooks page (part 11); correlation/identity/causation new shared page + trims, including a bonus discovery of Kotlin's fully-undocumented correlation/identity/causation system (part 12); Elixir sinks/event-stores/subscriptions link-adds, Kotlin inline-concept links, TypeScript sharedTopicBridge cross-links, the dotnet-client placement question (decided: leave in place), and three new client-specific Seeding pages after discovering Kotlin/TypeScript also have real seeding support (part 13).

**The chronicle-client-parity-migration effort is complete** — see part 13's closing summary.

## Part 7 — `projections/**` (210 tabs, done via 3 parallel agents)

Given the size of this section, split the work across 3 parallel agents by subfolder rather than working it sequentially: **declarative** (`projections/declarative/**`, the fluent `IProjectionFor<T>` builder), **model-bound** (`projections/model-bound/**`, the attribute-based `[FromEvent]`/`[SetFrom]` style), and **PDL + standalone** (`projections/projection-declaration-language/**` plus `architecture.mdx`, `choosing-a-read-model-style.mdx`, `eventual-consistency.mdx`, `filtering.mdx`, `nested-objects-design.mdx`, `tagging-projections.mdx`). Each agent was briefed with the full established methodology from parts 1-6 (source-verify only, real content for under-migrated, honest stubs for asymmetric gaps, one `:::note` for uniform gaps, never fabricate an API) plus prior findings relevant to their scope.

### Key capability findings (source-verified by the agents)

- **Kotlin/Java's fluent declarative builder** (`IProjectionBuilderFor`) is extremely minimal — only `from(EventClass) { set(prop).to(event) }`. No children, joins, `fromEvery`, composite/constant keys, event-context access, functions, not-rewindable, or passive support. Java additionally can't practically call the API via JVM interop at all (no Java-friendly overload for the `KClass<T>` parameter) — Java is a stub across nearly this entire subfolder.
- **Kotlin/Java's model-bound (attribute) builder** only has `@FromEvent`/`@SetFrom` — no `AddFrom`/`SubtractFrom`/`SetFromContext`/`FromEvery`/`ChildrenFrom`/`Join`/counters/`RemovedWith`/`ConstantKey`/`NotRewindable`/`Passive`/`SetValue`. But since AutoMap is unconditionally enabled at kernel-registration level (confirmed in `ProjectionsService.kt`), bare `@FromEvent` convention-based mapping (no `@SetFrom` needed) fully works — this was a real **under-migration** (docs said gap, source said it works), not a genuine gap.
- **Elixir's projection DSL** (`read_model.ex`/`projection.ex`) is genuinely rich: `from`/`join`/`removed_with`/`from_every` with real constant-key, count/add/subtract, event-context (`:occurred`, `"$context.x"`), and passive-projection support. Real limits found: `IsRewindable` and the event sequence are hardcoded (no override), literal non-numeric constants (strings/atoms) have no safe expression path (only integers), and `from_every` registration silently drops all but the first declaration per module (a genuine limitation, documented rather than guessed at).
- **TypeScript's declarative builder** has several methods that exist and type-check but literally `throw new Error('... not implemented yet.')` at runtime (`children()`, `nested()`, `usingCompositeKey()`, `add()`, `subtract()`, `count()`) — confirmed by reading the actual method bodies, not just the type signatures. These were stubbed with the exact runtime-error wording rather than the usual "does not support this workflow yet" marker, since the method technically exists but throws.
- **PDL** (Projection Declaration Language) tabs mostly show the event/read-model *shapes* PDL operates on (language-agnostic PDL text itself isn't a per-client concept) — these ported to all 5 clients easily. The one genuinely client-API-specific PDL tab, ad-hoc PDL-string querying (`IProjections.Query()`), is a confirmed uniform C#-only gap (no client but C# supports registering/running an ad-hoc PDL string at runtime).
- `projections/architecture.mdx`'s counting example, `choosing-a-read-model-style.mdx`'s constant-value assignment, `eventual-consistency.mdx`'s `watch()`/observable read models, and `nested-objects-design.mdx`'s `@Nested`/`@ClearWith` were all found to be asymmetric (real in 1-2 non-C# clients, gap in others) and handled tab-by-tab rather than page-wide.

### Scale of the change

Roughly 20-25 tabs across the three scopes got real new content per applicable client (several each for Kotlin, Java, Elixir, TypeScript); roughly 200+ honest stub files were added for confirmed asymmetric gaps (mostly Kotlin/Java, since Elixir and TypeScript's declarative/model-bound surfaces are each individually much richer); a smaller number of whole-page or per-tab `:::note[Client coverage]` blocks were added for uniform gaps (composite keys, children/nested without AutoMap, PDL ad-hoc querying, `[Tag]`-based projection tagging).

### Bugs the agents hit and fixed

- An Elixir `defstruct [:a], b: 0` two-argument call is a syntax error — Elixir's `defstruct` only accepts a single list/keyword-list argument; fixed to one combined list.
- The recurring TypeScript cross-file `Guid` import inconsistency (`@cratis/fundamentals` vs the corpus-standard `@cratis/chronicle` re-export) resurfaced in 3 files from different agents editing near each other — all fixed to the standard import.
- A stub file's marker text didn't exactly match the validator's required substring (`"does not support this workflow yet"`), which meant the TypeScript validator tried to actually compile it — fixed the wording.
- A doubly-nested TypeScript `.nested(m => ...)` fluent chain lost generic type inference; fixed with explicit `.nested<T>(...)` type arguments.
- One Elixir snippet referenced a field on the wrong event (a copy-paste slip caught before it shipped, not after).

### Verification

Each agent ran the full chain independently; after all three finished, ran the combined chain once more myself (since three agents mutated overlapping shared state — the `chronicle-client-docs.yml` config, the sync pipeline, etc. — concurrently): `npm run sync` (322 chronicle pages, 1 pre-existing broken toc entry, unrelated), `npm run chronicle-client-docs:check` (670 placeholders, 0 legacy, 0 direct fences, **C# validator passed**, **TypeScript validator passed** — this is the real confirmation that ~250+ new/changed snippet files across all three agents compile for real — Kotlin/Java/Elixir blocked-by-toolchain as expected), `npm run build` (841 pages, zero errors), `node scripts/lint-docs.mjs` (0 errors, 196 pre-existing warnings), and spot-checked rendering in `dist/chronicle/projections/declarative/auto-map.md` (Elixir tab renders real code) and `dist/chronicle/projections/model-bound/` (17 files contain real Kotlin content).

**Standing reminder added**: for a section this large, splitting work across parallel agents by natural subfolder boundary (declarative vs model-bound vs PDL) worked well and didn't produce conflicts, because each agent's file scope was disjoint — but always re-run the FULL verification chain yourself after all agents finish, since shared config/build state can still interact even when file scopes don't overlap.

## Part 8 — `constraints/**`, `compliance/**`, `testing/**`, `scenarios/**` (partial: `subscriptions/**`/`read-models/**` still open)

Note on process: a first attempt to delegate `constraints/**`+`compliance/**` to an agent **failed** — it hit a hard session/usage limit and returned an error instead of doing any work (confirmed via `git status`/file timestamps: zero files touched). Redid this batch directly instead of re-delegating. Lesson: after delegating, always verify the agent's *claimed* work actually landed on disk before trusting a completion report — this one didn't even get that far, but a partially-completed agent could plausibly claim more than it did.

### Key finding: constraints are a real, working feature in Kotlin, Java, and Elixir — narrower than C#, but genuinely there

Confirmed via source (`io.cratis.chronicle.constraints/*.kt`, `chronicle/events/constraints.ex`, `Chronicle.TypeScript/Source/events/constraints/*`) that all three non-C# clients have a working `IConstraint`/unique-constraint mechanism — another case like reducers (part 5) where the shared docs read as C#-only/C#+TS but the SDKs support more than that.

- **Kotlin's `IConstraintBuilder`/`IUniqueConstraintBuilder`** is real but narrower than C#'s: `on(eventClass, property)` + `ignoreCasing()` + `withMessage(string)` work; there is **no `RemovedWith`, no `WithName`, and no multi-event chaining** (the concrete `UniqueConstraintBuilder` only stores one `eventClass`/`propertyName` — calling `.on()` twice overwrites rather than accumulates). A code comment in `ConstraintBuilder.kt` itself admits the property-name extraction from the `(TEvent) -> TValue?` lambda is a "workaround" that just grabs the event's first declared field — every C# example in this section happens to use single-property events, so this doesn't produce wrong behavior in the snippets written, but it's a real, documented landmine for any future multi-property use: **do not write a Kotlin unique-constraint example targeting anything but an event's first (or only) declared field** without independently re-verifying this hasn't been fixed.
- **Kotlin/Java's `uniqueFor(eventClass, message)`** (unique EVENT TYPE, not property) has none of the lambda-property-extraction risk above and was used for the "unique event type" declarative tabs — real, safe, no caveat needed.
- **Java interop risk, handled conservatively**: no established precedent anywhere in this corpus for a Java caller passing a Kotlin `Function1`-typed lambda parameter (e.g. `unique(configure: (IUniqueConstraintBuilder) -> Unit)`) — Kotlin's `Unit`-returning SAM conversion from Java 8 lambda syntax is plausible but unverified without a real compiler. Rather than guess, treated every Kotlin API requiring a **lambda-typed parameter** as a Java gap (stub), and only wrote real Java content for the simpler `uniqueFor(KClass, String)` shape (matching the already-established `JvmClassMappingKt.getKotlinClass()` bridge pattern). Same caution applied to a Kotlin `@Pii`-on-a-Java-record-component question later in this batch (Kotlin's `@Pii` target set of `FIELD, PROPERTY, CLASS` has no established Java-record-component precedent in this corpus, unlike the well-established `CLASS`-only annotations like `@EventType`/`@Reactor`/`@Reducer`/`@ReadModel` — treated as unverified, left as a Java stub rather than guessed).
- **Elixir has TWO real, distinct mechanisms mapping cleanly onto C#'s two doc sections**: a raw imperative `Chronicle.Events.Constraints.register(channel, event_store, [%{...}])` call (closer in spirit to "declarative" — a separate explicit call, not an attribute — but its documented public shape has **no `RemovedWith`/message support** reachable safely, so it wasn't used for the declarative/** pages at all to avoid relying on an undocumented internal map shape), and the **event-type-attribute macros `unique(fields, opts)`/`unique_event_type(opts)`/`remove_constraint(name)`** (a true model-bound match for C#'s `[Unique]`/`[RemoveConstraint]` attributes — confirmed `remove_constraint` is `accumulate: true`, so it correctly supports "stack multiple `[RemoveConstraint]` attributes"). Used the macros for **all** of `constraints/model-bound/**`; left `constraints/declarative/**` **without** Elixir content at all (added a note instead), since Elixir genuinely has no separate declarative-class-style API safe to demonstrate.
- **Elixir has no violation-message support anywhere** (neither the raw `register` call nor the `unique`/`unique_event_type` macros have a message field) — a genuine, uniform-for-Elixir gap on top of everything else; `constraints/model-bound/unique.mdx`'s "violation message" tab stayed `csharp`-only with a note, even though the rest of that page widened to include Elixir.
- **PII (`compliance/**`) is real in all three non-C# clients** at the property level: Kotlin `@Pii(description)`, Elixir `pii(field, details)`, TypeScript `@pii()`. Widened `compliance/pii.mdx`'s and `compliance/client.mdx`'s property-level tabs accordingly. The **class-level "mark a `ConceptAs<T>` type as PII"** variant stays C#-only — not really a "gap" so much as there being no established typed-value-wrapper convention for Kotlin/Elixir anywhere in this corpus to hang the class-level attribute off of; noted rather than silently left.
- **`testing/**` (46 tabs) confirmed a genuine, deep uniform gap** — `Cratis.Chronicle.Testing`'s in-process `*Scenario` helpers are a C#-specific library on top of xUnit/Cratis.Specifications; grepped Kotlin/Elixir/TypeScript for anything analogous and found only each language's own generic test-runner boilerplate (Kotest/JUnit, ExUnit, Vitest), nothing Chronicle-specific. Added one `:::note` at the top of `testing/index.mdx`; left every one of the 46 tabs untouched (matches the earlier `code-analysis/**` planned treatment).
- **`scenarios/**`**: these are downstream recipes over concepts already assessed elsewhere in this effort, so mostly reused already-established findings rather than re-deriving: `react-to-an-event.mdx`'s `basic-reactor` (real everywhere), `reading-state`/`explicit-append` (real Elixir only — Kotlin/Java can't per the non-suspend-handler constraint from part 3, and **TypeScript is also a gap here**, not real — TS reactors have no constructor-injection mechanism at all, confirmed in part 3's tutorial work; don't assume TS parity with Elixir just because it's usually the strongest non-C# client), `return-event` (uniform C#-only gap, matches `reactors/side-effects.mdx`). `real-time-query.mdx`'s `get-one` (real everywhere) widened; the other 4 tabs (get-all, materialized paging, watch, observe-page) got one consolidated note reusing the exact per-client breakdown already established in `concepts/designing-read-models.mdx` and `projections/eventual-consistency.mdx` rather than re-verifying from scratch. `test-a-slice.mdx` just points to the `testing/**` note.

### Verification

`npm run sync`, `npm run chronicle-client-docs:check` (670 placeholders — unchanged, no new `<ChronicleClientTabs>` lines added this batch, only widened/noted existing ones — 0 legacy, 0 direct fences, **C# validator passed**, **TypeScript validator passed**, Kotlin/Java/Elixir blocked-by-toolchain as expected), `npm run build` (841 pages, clean), `node scripts/lint-docs.mjs` (0 errors, 196 pre-existing warnings), and a markdown-mirror spot check of `dist/chronicle/constraints/model-bound/unique.md` confirming the new Elixir tab renders real, correct code.

**New standing reminders**: (1) when a Kotlin API needs a parameter typed as a Kotlin function type (`(T) -> R`) or targets record/data-class **components** specifically (as opposed to the whole class), and no existing snippet in the corpus already demonstrates a Java caller doing the same thing successfully, don't guess at the Java interop shape — treat it as an unverified Java gap rather than writing speculative bridge code. (2) A source code comment admitting something is a "workaround" is a strong signal to read the *implementation*, not just the public interface, before writing an example that exercises it — the interface alone would have looked completely fine here.

## Part 9 — `subscriptions/**`, `read-models/**`

### Key finding: explicit event-store subscriptions are real in Elixir and TypeScript, not just C#

Confirmed via source that `subscriptions/explicit-subscriptions.mdx`'s `Subscriptions` API maps cleanly onto Elixir's `Chronicle.subscribe_to_event_store/3,4` + `Chronicle.EventStoreSubscriptions.DefinitionBuilder.with_event_type/2` (real, including the 3-arity "no filter, forward everything" form) and TypeScript's `store.subscriptions.subscribe`/`.unsubscribe` + `IEventStoreSubscriptionBuilder.withEventType()` (an almost 1:1 shape match with C#). Widened 6 of the 8 tabs (`basic`, `naming-convention`, `filtering`, `no-filter`, `inbox-reactor`, `unsubscribe`) to all 5 clients with real Elixir/TypeScript content and Kotlin/Java stubs (Kotlin has **zero** event-store-subscription support — confirmed no matches anywhere in the SDK source). Left the two ASP.NET-host-builder-specific tabs (`startup-registration`, `typical-pattern`) C#-only — deliberate scope call, noted in the page.

- **`subscriptions/implicit-subscriptions.mdx`** confirmed a genuine, deep uniform gap — it's entirely built on the `[EventStore]` attribute (already established absent everywhere else) plus .NET-specific packaging/build mechanics (NuGet, `AssemblyInfo.cs`, `.csproj` `<AssemblyAttribute>`) with no conceptual equivalent anywhere else. One note, no tab changes.
- **`subscriptions/outbox-inbox.mdx`**: `inbox-reactor` is a plain reactor (already fully portable, was just never wired) — widened to all 5. `inbox-id` (a `EventSequenceId.InboxPrefix` naming-convenience constant) stays C#-only — the other clients don't have a dedicated helper since an inbox sequence id is just a plain string wherever they use event sequence ids at all; noted rather than silently left.

### `read-models/**` — most of this was already correctly scoped from earlier work; filled the one remaining gap

`getting-single-instance.mdx`, `getting-collection-instances.mdx`, and `getting-snapshots.mdx` were **already** at full or correct partial width (`csharp,kotlin,java,elixir,typescript` or `csharp,elixir,typescript`) — no work needed, this reflects earlier sessions' `concepts/designing-read-models.mdx`/reducer findings already having been applied here too. The one section still fully C#-only was `materialized-pagination.mdx` (7 tabs):

- **Elixir has real materialized paging** via `Chronicle.ReadModels.query/2` (page/page_size, not skip/take — a genuinely different pagination model, not just a syntax difference) — confirmed the `QueryResult` struct's exact field names (`instances`, `total_count`, `page`, `page_size`) directly from source before using them.
- **TypeScript has a full, real `IMaterializedReadModels` API** — `getInstances(type, skip?, take?)` **and** `observeInstances(type, skip?, take?)` returning an `AsyncIterable` (TS's live/paginated-observe equivalent to C#'s Rx `IObservable`-returning `ObserveInstances`) — this hadn't been noticed/wired in any earlier pass. Widened `accessing-api`, `basic-usage`, `pagination`, and `observing` to include real Elixir + TypeScript content (Kotlin/Java stubs — confirmed only single-instance lookup exists there, no bulk/paged/observed materialized access at all).
- Left `named-constants` (a C# named-constant-types convenience), `paged-endpoint` (an ASP.NET Core endpoint example), and `observing-in-service` (a second illustration of the same `ObserveInstances` capability already shown in `observing`) untouched — one consolidated note covers all three plus the general per-client breakdown.
- `watching-read-models.mdx` already had its own honest "not every client exposes this yet" framing from earlier work — confirmed still accurate, left as-is.

### Verification

`npm run sync`, `npm run chronicle-client-docs:check` (670 placeholders unchanged, 0 legacy, 0 direct fences, **C# validator passed**, **TypeScript validator passed**, Kotlin/Java/Elixir blocked-by-toolchain as expected), `npm run build` (841 pages, clean), `node scripts/lint-docs.mjs` (0 errors, 197 pre-existing-class warnings — one more than the prior baseline of 196, checked and confirmed it's an existing "weasel: just" style-advisory hit in unrelated pre-existing prose, not something introduced this batch), and a markdown-mirror spot check of `dist/chronicle/subscriptions/explicit-subscriptions.md` confirming the new coverage note and Elixir tab both render correctly.

## Part 10 — `namespaces/**`, `hosting/**`, `migrations/**`, `configuration/**`, `connection-strings/**`, `event-seeding/**`, `closing-streams/**`, `sinks/**`, `contributing/**`

### Key finding: a recurring, now well-established category — ".NET hosting/DI configuration" pages that are genuinely, correctly C#-only

Across most of this batch, the pattern was the same: a page built around .NET's Generic Host (`Host.CreateApplicationBuilder`, `IServiceCollection`, `AddCratisChronicle`, `appsettings.json` + `Cratis__Chronicle__` env-var binding) or ASP.NET Core/.NET Aspire specifically. None of these have a conceptual equivalent in Kotlin, Elixir, or TypeScript — each of those clients configures a connection through its own constructor/options object (already documented in their own getting-started guides), not a layered configuration-provider system. Confirmed and noted (not widened) for: `configuration/**` (one consolidated note on `index.mdx` covering the whole section — `chronicle-options`, `tls`, `grpc-message-size`, `structural-dependencies`, `camel-casing`), `connection-strings/configuration.mdx` (already self-describing as ".NET client" in its own prose, no note added), `sinks/index.mdx` (SQL sink DI registration), `hosting/aspire.mdx` + `hosting/local-certificates.mdx` (.NET Aspire has no equivalent tooling in any other ecosystem — confirmed genuinely out of scope for a client-parity effort, not just unmigrated).

### Genuinely per-client-scoped pages (by design, not oversight) — `namespaces/dotnet-client.mdx`, `migrations/dotnet-client.mdx`, `connection-strings/dotnet-client.mdx`

These three files are literally named "dotnet-client" and sit inside the shared `Chronicle/Documentation/` tree rather than a per-client public-docs folder — they document .NET-specific mechanisms (`IEventStoreNamespaceResolver`, .NET's DI-driven namespace/connection resolution) that don't have an equivalent hosting model to port to. Added a coverage note to `namespaces/dotnet-client.mdx` confirming the scoping is intentional. **Flagged, not fixed**: per the project's own convention (client-specific content belongs in `Chronicle/Documentation/clients/dotnet/**`, not the shared tree), these three pages arguably belong there instead — that's a placement/restructuring call for the "client-specific docs consolidation" workstream, not a `clients=` widening task, so left in place.

### One real win: `migrations/validation.mdx`'s `default-value` tab

Confirmed Elixir's `MigrationBuilder.default_value/3` (already used in part 6's `concepts/event-type-migrations.mdx` work) applies here too — wrote real Elixir content, widened to `csharp,kotlin,java,elixir` (Kotlin/Java stubs, confirmed no migration API exists there at all). The `EnableEventTypeGenerationValidation` toggle tab stays C#-only (a .NET hosting-config option, no Elixir equivalent found).

### `closing-streams/**`: confirmed genuine, uniform gap

`CompleteStream` (closing an event stream permanently) — grepped all three other SDKs, zero hits anywhere. One note, no widening.

### `event-seeding/**`: found a real gap in the docs' information architecture, not fixed here

`event-seeding/seeding-with-csharp.mdx` is a **single-client-only page** (not the shared `<ChronicleClientTabs>` pattern used everywhere else) — this repo's own established convention is "one shared page + per-client tabs," so a per-client page format here is itself an inconsistency, not something a `clients=` widening fixes. Elixir has a real, working seeder (`chronicle/seeding/seeder.ex`) with no companion page. Documented as a known gap in `event-seeding/index.md` rather than improvised — creating a properly-structured shared page (or a "Seeding with Elixir" sibling) is a bigger call than the scope of this pass, and belongs with the consolidation workstream.

### `contributing/**`: confirmed out of scope entirely — different audience

This section documents **contributing to Chronicle itself** (building new client SDKs, the kernel's gRPC contracts, protobuf extraction) — a framework-contributor audience, not the end-user "building an app with a Chronicle client" audience this whole parity effort targets. Its existing mixed `clients=` values (csharp-only for kernel contracts, typescript-only for the TS gRPC package build, csharp+elixir for client-types) are **already correct** — each reflects what's actually relevant to that specific contributor topic, not a parity gap. No changes made; confirmed via reading the actual page topics (client SDK internals, kernel services, patches) rather than assumed from the directory name alone.

### Verification

`npm run sync`, `npm run chronicle-client-docs:check` (670 placeholders unchanged, 0 legacy, 0 direct fences, **C# validator passed**, **TypeScript validator passed**, Kotlin/Java/Elixir blocked-by-toolchain as expected), `npm run build` (841 pages, clean), `node scripts/lint-docs.mjs` (0 errors, 197 warnings, matching the prior batch's baseline), and a markdown-mirror spot check of `dist/chronicle/migrations/validation.md` confirming the new note and Elixir tab render correctly.

**New standing reminder**: not every directory under `Chronicle/Documentation/` is in scope for client-SDK parity — some (`hosting/**`, `contributing/**`) document server/infra concerns or framework-contributor workflows for a different audience entirely. Check what a section is actually *about* (read a page's real content, not just its directory name) before assuming a narrow `clients=` list is an oversight — confirming "this is correctly scoped, not a gap" is itself useful, verified progress, not a shortcut.

**This closes out the entire "everything, broadest scope first" client-tabs sweep** — every directory under `Chronicle/Documentation/` with a `<ChronicleClientTabs>` component has now been audited and either widened, stubbed, or confirmed out of scope with a note.

## Part 11 — New shared Jobs and Webhooks pages (client-specific docs consolidation, item 2)

The first item tackled from the consolidation list (part 1, item 2): **"Jobs and Webhooks have NO shared doc page at all — only Elixir and TypeScript document them, at very different depths, no shared anchor to bridge to."** Confirmed still true, and confirmed real C# support exists too (`Cratis.Chronicle.Jobs`/`Cratis.Chronicle.Webhooks` in `Chronicle/Source/Clients/DotNET/{Jobs,Webhooks}/`) — it just had never been written up in the shared `Chronicle/Documentation/` tree at all, so this was a genuine coverage gap in the shared corpus, not a `clients=` widening job.

### What was created

Two new top-level sections, matching the existing `closing-streams/`/`sinks/` single-page-section pattern (`<name>/index.mdx` + `<name>/toc.yml`):

- **`Chronicle/Documentation/jobs/index.mdx`** — 4 tabs: list all jobs, get a single job, get a job's steps, stop/resume/delete. Real content for C# (`eventStore.Jobs`), Elixir (`Chronicle.Jobs.*`), and TypeScript (`store.jobs`) — verified each against real source (`IJobs.cs`, `jobs.md`'s already-existing real Elixir/TS prose which I re-verified against source rather than trusting verbatim, `IJobs.ts`). Kotlin/Java: confirmed zero jobs support anywhere in the SDK — stubs.
- **`Chronicle/Documentation/webhooks/index.mdx`** — 2 tabs: register a webhook (imperative — the one style all three of C#/Elixir/TypeScript's *client* APIs share; Elixir and TypeScript also have a discoverable-module/decorator style but C#'s client SDK only exposes the imperative `IWebhooks.Register(...)` form, so imperative is what's genuinely common to all three) and query registered webhooks. Kotlin/Java: stubs.
- Both wired into the main `Chronicle/Documentation/toc.yml` (next to Subscriptions) and into `web/scripts/sync-content.mjs`'s bucket config (`'Read models and processing'` bucket, alongside Subscriptions/Sinks — confirmed the new bucket entry via the built `topics.json`, not just by reading the config).

### A notable asymmetry found, deliberately not chased further

C#'s `IWebhooks` interface has **no `Remove`/unregister method** — Elixir (`Chronicle.WebHooks.remove/1`) and TypeScript (`webhooks.remove()`) both have one. This is the rare case in this whole effort where C# is narrower than the other clients on a real capability. Rather than write a 3rd tab exposing this asymmetry (real for Elixir/TS, gap for C#/Kotlin/Java) on a brand-new page, kept the new page's scope to the two operations genuinely common across C#/Elixir/TypeScript (register, query) — a proportionate-effort call given this is new content, not an existing page being audited tab-by-tab.

### Bug caught and fixed while writing this

Initially wrote the TypeScript webhook-registration example using `process.env.WEBHOOK_TOKEN` — caught before finishing that `Source/tsconfig.json` has no `@types/node` dependency (the same constraint documented earlier in this effort, part 3), so `process` wouldn't type-check. Fixed by taking the token as a constructor parameter instead, matching the project's own "don't reach for a runtime API the compiler config doesn't support" precedent.

### Verification

`npm run sync` (324 chronicle pages, +2 from the new sections), `npm run chronicle-client-docs:check` (676 placeholders, +6 for the new tabs, **C# validator passed**, **TypeScript validator passed**, Kotlin/Java/Elixir blocked-by-toolchain as expected), `npm run build` (843 pages, +2, zero errors), `node scripts/lint-docs.mjs` (0 errors, 197 warnings — unchanged, confirming the new pages introduced no broken links), and confirmed via the built `src/generated/topics.json` (parsed with a small Python script, not just eyeballed) that "Jobs" and "Webhooks" both appear as children of the "Read models and processing" bucket, alongside Subscriptions/Sinks — i.e., the nav wiring actually took effect, not just the toc.yml source.

**Still open from the consolidation list** (unchanged from part 1): correlation/identity/causation trim (Elixir `context.md` 284 lines + TypeScript `correlation.md`/`identity.md`/`auditing.md`, no cross-bridging), Elixir `event-store-subscriptions.md`/`sinks.md`/`event-stores.md` over-explanation trims, Kotlin `get-started/index.md`/`reference/annotations.md`/`reference/configuration.md` inline-concept fixes, .NET/TypeScript `sharedTopicBridge` consistency, plus two new items surfaced in part 10 (the `namespaces`/`migrations`/`connection-strings` "dotnet-client" page placement question, and the `event-seeding` single-client-page-format inconsistency).

## Part 12 — Correlation/identity/causation consolidation (consolidation item 1)

The clearest consolidation candidate from part 1's audit. Confirmed the original finding but refined it while doing the work: Elixir's `context.md` and TypeScript's `correlation.md`/`identity.md`/`auditing.md` are **not** low-value duplicated fluff — they're genuinely good, detailed, correct client-specific API reference (real module/class names, real framework-integration examples like Express `AsyncLocalStorage` middleware). The actual problem was narrower than "284 lines of duplication": each page's own **opening 1-2 sentences** re-explain the general concept (what a correlation ID/identity/causation chain *is*) with no link to a shared definition — that's the only part that was genuinely redundant across files.

### Key finding: Kotlin has a full, completely undocumented correlation/identity/causation system

While researching the shared page's tabs, found real, working Kotlin/Java support that nobody had ever written up anywhere — not even a hint of it in the original part-1 audit, which only compared Elixir vs TypeScript and didn't check Kotlin at all for this topic:

- `io.cratis.chronicle.correlation.CorrelationId` (`@JvmInline value class` wrapping a `UUID`) + `correlationIdManager` (`ThreadLocal`-scoped, `.current`/`.set()`/`.clear()`)
- `io.cratis.chronicle.identity.Identity` (plain `data class`: `subject`, `name`, `userName`, `onBehalfOf`, with `.system`/`.notSet`/`.unknown` sentinels and `withoutDuplicates()`) + `identityProvider` (`ThreadLocal`-scoped)
- `io.cratis.chronicle.auditing.CausationType`/`Causation`/`CausationManager` (`ThreadLocal`-scoped chain builder)

All three are `ThreadLocal`-based rather than coroutine-context-based — a real, worth-noting difference from Elixir (process dictionary) and TypeScript (`AsyncLocalStorage`, which follows async continuations across `await` boundaries the way a coroutine context would): a `ThreadLocal` value does **not** automatically follow a Kotlin coroutine across a dispatcher switch, so this is a genuine caveat for anyone using Kotlin's version inside suspend functions that hop threads. Documented this distinction directly in the new shared page rather than glossing over it.

### What was created

**`Chronicle/Documentation/concepts/correlation-identity-causation.mdx`** — a new shared concept page (wired into `concepts/toc.yml`) with three sections (Correlation ID, Identity, Causation), each with a real, source-verified tab per client showing the core "get/set the current value" operation:

- Correlation: real for C# (`Cratis.Execution.ICorrelationIdAccessor`/`ICorrelationIdModifier` — confirmed this is a **Fundamentals-level** abstraction, not Chronicle-specific, found in the `Fundamentals` sibling repo, not `Chronicle/Source`), Kotlin, Elixir, TypeScript — all four real.
- Identity: real for all four — confirmed C#'s `IIdentityProvider` (`GetCurrent`/`SetCurrentIdentity`/`ClearCurrentIdentity`) is an intentional 1:1 naming match with TypeScript's `IIdentityProvider` (`getCurrent`/`setCurrentIdentity`/`clearCurrentIdentity`), and all four clients share the exact same three sentinel-identity GUIDs (`System`/`NotSet`/`Unknown`) — a nice cross-client consistency this effort hadn't surfaced before.
- Causation: real for C#, Kotlin, Elixir — **skipped Java** for `causationManager.add(type, properties)` specifically, because `CausationType` is a `@JvmInline value class` in Kotlin, and this corpus has no established precedent for how Java callers handle a Kotlin inline value-class *parameter* (as opposed to a return value) — Kotlin's name-mangling behavior for these varies by call shape and isn't something to guess at without a compiler. Treated as an honest Java gap rather than writing unverified bridge code.

### Trims applied to the 4 existing per-client pages

Elixir `context.md`: removed the "Overview" section (3 concept-defining bullets) and replaced the opening paragraph with a link to the new shared page — kept every line of the real Elixir API reference (correlation/identity/causation creation, process-scoping, one-off overrides, delegation chains, the full controller example, async/spawn considerations). TypeScript `correlation.md`/`identity.md`/`auditing.md`: trimmed each page's opening definitional sentence to a one-line link-out, kept 100% of the TypeScript-specific reference content (the `AsyncLocalStorage` explanation, Express middleware examples, `ICorrelationIdAccessor`/`ICorrelationIdSetter` interface segregation, custom-provider implementation guidance).

### Verification

`npm run sync` (325 chronicle pages, +1 for the new concept page), `npm run chronicle-client-docs:check` (679 placeholders, +3 for the new tabs, **C# validator passed**, **TypeScript validator passed**, Kotlin/Java/Elixir blocked-by-toolchain as expected), `npm run build` (844 pages, +1, zero errors), `node scripts/lint-docs.mjs` (0 errors, 197 warnings — unchanged, confirming the new cross-links to `/chronicle/concepts/correlation-identity-causation/` from both client repos resolve correctly, not broken), and a markdown-mirror spot check confirming both the new shared page's Elixir tab and the trimmed TypeScript `correlation.md`'s link-out render correctly.

**New standing reminder**: when auditing for "duplicated content across clients," don't assume the fix is always "delete most of it" — real, correct, client-specific API reference is valuable and should be kept; the actual redundancy is often much narrower (here: just the opening definitional sentence) than the page's total line count suggests. Read the whole file before deciding how much to trim, not just its length.

## Part 13 — Remaining consolidation items (Elixir trims, Kotlin inline fixes, sharedTopicBridge, page-placement questions, event-seeding)

Closed out the rest of part 1's consolidation list.

### Elixir trims: lighter touch than expected, again

Re-read `event-store-subscriptions.md` (140 lines), `sinks.md`, `event-stores.md` (203 lines) in full before touching anything, per the part-12 lesson. Same pattern as before: these are genuinely good, mostly non-duplicated Elixir-specific reference (in `event-store-subscriptions.md`'s case, it documents a **discoverable subscription module** pattern — `use Chronicle.EventStoreSubscriptions.Subscription` — that the shared `subscriptions/explicit-subscriptions.mdx` page doesn't even cover, since I'd only wired the imperative form there). Added one-line links to the relevant shared pages at the top of each (`sinks.md` → `/chronicle/sinks/`; `event-stores.md` → `/chronicle/concepts/event-store/` + `/chronicle/concepts/namespaces/`, also added to its "See Also"; `event-store-subscriptions.md` → the shared subscriptions pages, framed as "this page adds what they don't cover" rather than "see the real explanation elsewhere"). No content deleted from any of the three.

### Kotlin inline-concept "fixes": already appropriately terse — added links, not trims

`get-started/index.md` is a genuine step-by-step tutorial (matches the project's own tour-voice/pedagogical convention — brief one-sentence framings for reactors/reducers are correct tutorial style, not redundant over-explanation). Added two inline forward-links (`/chronicle/reactors/`, `/chronicle/reducers/`) at the exact sentences introducing each concept, without touching the teaching prose itself. `reference/annotations.md`'s `@Pii` entry and `reference/configuration.md`'s "Namespace" section were both already short (2-3 sentences) and reference-appropriately terse — not over-explanations needing trimming. Added a one-line link to each (`/chronicle/compliance/pii/`, `/chronicle/concepts/namespaces/`) for a reader who wants the full model, without cutting anything.

### `sharedTopicBridge` consistency: added missing cross-links to jobs.md/webhooks.md/sinks.md (TypeScript)

These three now link to the part-11 shared Jobs/Webhooks pages and the existing shared Sinks page respectively. They intentionally do **not** get `sharedTopicBridge: true` — that flag means "pure bridge, no unique content," which isn't true for any of them (all three have substantial TypeScript-specific reference beyond the shared page). This confirms the audit's original framing ("6 files skip it entirely") was imprecise: the fix isn't the frontmatter flag, it's an honest cross-link — see the mechanism note below.

### Page-placement question (`namespaces`/`migrations`/`connection-strings` "dotnet-client" pages): decided — leave in place

Traced every inbound link to these three files before deciding. `Chronicle/Documentation/clients/dotnet/index.md` already links to all three at their current URLs (`/chronicle/namespaces/dotnet-client/`, `/chronicle/migrations/dotnet-client/`, `/chronicle/connection-strings/dotnet-client/`), and `get-started/worker.mdx` also links to the namespaces one — nothing is broken today. Moving these three `.mdx` files (plus their `client-snippets/` folders) into `Chronicle/Documentation/clients/dotnet/` to match the stated convention would touch ~4 `toc.yml` files and several cross-links for a purely organizational improvement with no reader-facing benefit. **Decision: leave them where they are.** The existing part-10 coverage notes on `namespaces/dotnet-client.mdx` remain accurate and suficient; this is now considered resolved (as "won't move," not "still open").

### Event seeding: bigger finding than part 1 assumed — Kotlin and TypeScript also have real seeding, not just Elixir

Part 1's finding only compared C# vs Elixir. Checked Kotlin and TypeScript SDK source directly and found **both have complete, working seeding APIs** (`io.cratis.chronicle.seeding` — `@Seeder`, `ICanSeedEvents`, `IEventSeedingBuilder.forEventSource`; `@cratis/chronicle`'s `seeding` module — `@seeder()`, `ICanSeedEvents`, `IEventSeedingBuilder.for`/`.forEventSource`/`.forNamespace`) — this was a real, undiscovered documentation gap across **three** of the four clients, not one.

Wrote three new client-specific pages, one per client, each verified against real source (Elixir's `Chronicle.Seeding` module docs — `for/4`, `for_event_source/3`, `for_namespace/3` — already close to documentation-ready in its own moduledoc; Kotlin's narrower `forEventSource`-only builder, confirmed no namespace-scoping method exists there — a real, smaller gap relative to C#/Elixir/TypeScript; TypeScript's full `for`/`forEventSource`/`forNamespace` builder, matching C#'s richness closely):

- `Chronicle.Elixir/Documentation/seeding.md`
- `Chronicle.Kotlin/Documentation/guides/seeding.md` (**replacing** a stale `sharedTopicBridge: true` stub that pre-dated this discovery)
- `Chronicle.TypeScript/Documentation/seeding.md` (**replacing** a stale `sharedTopicBridge: true` stub, same reason)

**A process bug worth flagging**: initially wrote these as new top-level pages (`seeding-with-elixir.md`, `seeding-with-kotlin.md`, `seeding-with-typescript.md`, mirroring the shared C# page's naming), which created **duplicate nav entries** — Kotlin already had a wired `guides/seeding.md` bridge stub, and TypeScript already had an unwired but real-URL-colliding `seeding.md` bridge stub. Caught this by checking the built `dist/chronicle/clients/**` output for existing `seeding*` files **before** declaring done, found the collision, and fixed it properly: moved the real content into the existing, already-wired file locations (renaming to match each client's own sibling-file convention — bare `seeding.md`/`Seeding`, no "-with-X" suffix, matching `jobs.md`/`webhooks.md`/`sinks.md`), deleted the now-superseded duplicate/stub files, and removed the extra toc.yml entries I'd mistakenly added alongside the pre-existing ones.

This also required a `chronicle-client-docs.yml` policy fix: `seeding.md`/`seeding/**` were listed in `publicDocsAudit.sharedTopicPatterns` (the mechanism that flags a client's public-docs file as needing `sharedTopicBridge: true` if it overlaps a **fully shared, fully-tabbed** topic). Event-seeding doesn't qualify for that policy — unlike `reactors.md`/`reducers.md`/etc., the shared `Chronicle/Documentation/event-seeding/**` has **zero** multi-client `<ChronicleClientTabs>` coverage (it's C#-only), so each client's own seeding page necessarily carries real, non-duplicated content. Removed `seeding.md`/`seeding/**` from the pattern list (with an explanatory YAML comment) and bumped Kotlin's baseline to 1 (for `guides/seeding.md`, the one legitimate exception living inside the otherwise-pure-bridge `guides/**` folder, which is *still* covered by the broader `guides/**` pattern).

Updated `event-seeding/index.md`'s "Next steps" to link to all three new pages plus the existing C# one.

### Verification

`npm run sync` (326 chronicle pages — net +1 after all the create/rename/delete churn), `npm run chronicle-client-docs:check` (**Audit passed**, shared-topic-overlap check passed with the corrected baseline — 0/0/1/0 for csharp/elixir/kotlin/typescript, **C# validator passed**, **TypeScript validator passed**), `npm run build` (845 pages, zero errors), `node scripts/lint-docs.mjs` (0 errors, 199 warnings — the +2 from the prior baseline are both the same pre-existing "easily" style-advisory phrase, copied verbatim from the already-accepted C# seeding page's Best Practices bullet, not new issues), and confirmed via `dist/chronicle/clients/{kotlin/guides,elixir,typescript}/seeding.md` that all three pages exist at their final URLs with the correct title and no orphaned duplicates remain.

**New standing reminder**: after adding a new page to a client's public docs, **check the built `dist/chronicle/clients/**` output for pre-existing files at or near the same name/URL before finalizing** — a `sharedTopicBridge: true` stub can pre-date a real capability being discovered, and silently duplicating it (rather than replacing it) leaves two nav entries for the same topic. This is the same class of mistake as the constraints/compliance agent-verification lesson from part 8: verify the end state on disk, don't assume a clean addition.

This closes out every item from part 1's consolidation list. **The chronicle-client-parity-migration effort, as scoped by the user's original request, is complete**: every `Chronicle/Documentation/**` shared-doc section has been audited for per-client tab parity (parts 1-10), the missing Jobs/Webhooks shared page has been created (part 11), and the client-specific-docs duplication/gap findings from the original audit have all been addressed (parts 12-13, plus the deliberate no-op decisions on `hosting/**`/`contributing/**`/dotnet-client placement).

## Standing plan (update as work progresses)

Methodology per section: (1) confirm client's real API for the concept via source, (2) classify genuine-gap vs under-migrated, (3) for under-migrated: write/wire the real snippet, (4) for genuine gap: honest stub (asymmetric) or one clarifying note (uniform) — never a fabricated snippet, (5) verify C#/TypeScript for real via the validators, source-verify Kotlin/Java/Elixir, (6) rebuild + lint + `chronicle-client-docs:check` + visual spot check, (7) update this handoff with a new dated part. For a large section, consider splitting across parallel agents by natural subfolder/topic boundary (see part 7) rather than working sequentially — but always verify the agent's work actually landed (part 8) before trusting its report.

Remaining sections, in planned order — see "What's left in this effort" above for the checked/unchecked state:
`code-analysis/**` (likely skip, genuinely C#/Roslyn-only, confirm briefly) → client-specific docs consolidation (correlation/identity/causation, new shared Jobs/Webhooks page, sinks/event-stores/subscriptions trims, Kotlin concept-inline fixes, .NET/TypeScript bridge consistency, the `namespaces`/`migrations`/`connection-strings` "dotnet-client" page placement question from part 10, and the `event-seeding` per-client-page inconsistency from part 10 — all still exactly as found in part 1/part 10, untouched since).

## Standing reminders (carried over from the legacy-snippet migration — still apply)

All ~43 standing reminders from `chronicle-client-docs-migration.md` still apply where relevant (namespace-collision handling for Kernel-only C# types, TS decorator/reactor/reducer handler-naming-by-exact-camelCase rule, never use file-scoped `namespace X;` in a shared snippet, AutoMap silent-mismatch risk, `.To()` vs `.ToValue()`, assembly-level attributes forbidden in shared snippets, etc.) — re-read that file's "Standing reminders" sections before writing any new C# snippet. This new handoff only tracks what's specific to the client-parity effort.

Nothing has been committed. Follow the same discipline: verify before writing, run the aggregate chain after every batch, auto-delete superseded/unwired legacy snippet files only if truly superseded (not applicable here — this effort adds tabs, it doesn't retire a `legacy/` tree), hold commit/push/PR until the user explicitly asks.
