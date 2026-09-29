---
title: Vertical slices
description: Step-by-step tutorials that build an event-sourced Library system one slice at a time, following Event Modeling patterns.
---

This series of tutorials builds a **Library system** end to end, one behavior at a time. Each tutorial corresponds to one of the four slice patterns from [Event Modeling](https://novanet.no/stop-guessing-start-modeling/), and each one builds on the previous.

By the end you will have seen how every layer of the Cratis stack fits together: [Chronicle](/chronicle/) event sourcing, [Arc](/arc/)'s CQRS application model, and the purpose-built [Components](/components/) library. Each tutorial shows the backend in C#, Kotlin, Java and TypeScript. The TypeScript backend is a source preview; the [backend differences](#how-the-backends-differ) below list what it and the JVM backends do differently.

## Why Event Modeling?

Most software projects don't fail because of bad code. They fail because the team built the wrong thing — or built the right thing but nobody agrees on what it actually does. A product owner, a developer, and a domain expert sit in a meeting, all walk out believing they understood each other, and three weeks later reality proves otherwise.

[Event Modeling](https://eventmodeling.org) addresses this directly. It is a way to design and describe information systems using a **shared timeline** — a visual blueprint everyone on the team can read, from developers to domain experts to product owners. Unlike a traditional specification document, an event model is collaborative and alive. It uses only three building blocks and four patterns. You can explain the core concept in minutes; the rest you learn by doing.

### The three building blocks

Every Event Model is made from exactly three concepts:

| Building block | What it is | Examples |
| ------------ | ---------- | ------- |
| **Events** | Facts — immutable records of things that have already happened | `AuthorRegistered`, `BookBorrowed`, `LoanOverdue` |
| **Commands** | Intentions — what a user (or system) is trying to do, which will cause an event | `RegisterAuthor`, `BorrowBook`, `CancelReservation` |
| **Read Models** | Outputs — how the system informs users about what is going on | The author list, the inventory dashboard, the borrowing history |

Put them together and you have a complete picture of any workflow: a command comes in, gets validated, an event is recorded, the read model is updated — and the user sees the result.

### The four patterns

Every slice in an event model combines the three building blocks in one of four ways.

#### State change

A user submits a command. It gets validated. An event is recorded.

`RegisterAuthor` fires → `AuthorRegistered` is stored. The intent is explicit, the outcome is captured. This is the most common pattern — the write side of your system.

In Cratis this is: an [Arc](/arc/) model-bound command whose handler returns a Chronicle [event](/chronicle/events/), optionally guarded by a command validator or a Chronicle [constraint](/chronicle/constraints/).

#### State view

Events are **projected** into a read model that the UI displays.

An `Author` read model gets built from `AuthorRegistered` events. It is always up to date, and you can rebuild it from scratch at any point by replaying the events. This is the read side — fast, purpose-built, and completely independent from the write side.

In Cratis this is: a [read model](/chronicle/read-models/) built by a [projection](/chronicle/projections/) or reducer, with a query that the frontend calls — observable where the backend supports it, so the UI updates in real time.

#### Automation

A processor watches a read model (think: a to-do list), picks up items, and fires a command to handle each one — entirely behind the scenes.

Sending an overdue notice when a loan passes its return date. Canceling a reservation that was never collected. Triggering a payment. No human involved; the same building blocks, automated.

In Cratis this is: a Chronicle [reactor](/chronicle/reactors/) that observes the event stream and sends commands through Arc's command pipeline back into your own system.

#### Translation

When an event comes from an external system — one you don't own — you translate its language into yours. You don't want raw payloads as domain events. You want `BookInformationReceived` and `MemberImported` — events that mean something in your own context.

In Cratis this is: a Chronicle [reactor](/chronicle/reactors/) that listens for external events and fires commands in your own system, which in turn produce domain events with your own vocabulary.

## How Cratis maps to Event Modeling

| Pattern | Chronicle | Arc | Components |
| ------- | --------- | --- | ---------- |
| **State Change** | [Event types](/chronicle/events/) stored in the event log, guarded by [constraints](/chronicle/constraints/) | Model-bound command with a handler and validators | [`CommandDialog`](/components/commanddialog/) for the form UI |
| **State View** | [Projections](/chronicle/projections/) or reducers building a [read model](/chronicle/read-models/) | Query over the read model, with generated proxies | [`DataPage`](/components/datapage/) for the listing UI |
| **Automation** | [Reactor](/chronicle/reactors/) observing the event log | Command pipeline to fire commands | No UI — runs in the background |
| **Translation** | [Reactor](/chronicle/reactors/) on external event streams | Command pipeline bridging to domain commands | No UI — integration layer |

[Chronicle](/chronicle/) stores the facts (events), [Arc](/arc/) carries the intent (commands) and serves the queries, and [Components](/components/) renders the result. For the language-specific APIs, see [Arc backends](/arc/backend/).

## How the backends differ

The tutorials teach one design in four backend languages. Where a backend cannot follow a step as written, the tutorial says what it does instead and links back to this table:

| Behavior | C# | Kotlin and Java | TypeScript (preview) |
| --- | --- | --- | --- |
| Unique constraint over first and last name ([State change](/scenarios/vertical-slices/state-change/), [Translation](/scenarios/vertical-slices/translator/)) | Enforced when the event is appended | Not expressible yet, so registration has no append-time uniqueness rule ([Chronicle.Kotlin#101](https://github.com/Cratis/Chronicle.Kotlin/issues/101)) | Enforced when the event is appended |
| Author list ([State view](/scenarios/vertical-slices/state-view/)) | Live: the query observes Chronicle's MongoDB sink | Snapshot: the kernel's materialized observation fails on MongoDB ([Chronicle#4365](https://github.com/Cratis/Chronicle/issues/4365)) | Live: `ChronicleReadModels.observeAll` |
| Commands called without a signed-in user | The commands declare no authorization rules | Marked `@AllowAnonymous`, because Arc on the JVM requires an authenticated caller by default | The commands declare no authorization rules |
| Times in events and read models ([Automation](/scenarios/vertical-slices/automation/)) | `DateTimeOffset` | Epoch milliseconds: Chronicle rejects the JSON objects the JVM client writes for `java.time` values ([Chronicle.Kotlin#104](https://github.com/Cratis/Chronicle.Kotlin/issues/104)) | `Date` |
| How Chronicle finds a reactor's handler ([Automation](/scenarios/vertical-slices/automation/#how-each-backend-runs-the-reactor)) | Supported signatures and event parameter types on an `IReactor` | The event parameter type on a `@Reactor` class | The method name: the event class name with its first letter lowercased, on a `@reactor()` class |
| How a reactor runs commands ([Automation](/scenarios/vertical-slices/automation/#how-each-backend-runs-the-reactor)) | It calls the injected `ICommandPipeline` and throws on failure | It passes each command to `ChronicleCommandSideEffectHandler` and throws on failure | It returns the commands; Arc's `reactorCommandResultHandler` runs them |
| Constraints in command specs ([State change](/scenarios/vertical-slices/state-change/#step-4--command-specs)) | Enforced: the scenario runs an in-process Chronicle kernel | Not enforced: the scenario's event log is in memory | Not enforced: the scenario records events in memory |

## The Library system

All four tutorials build parts of a **Library** system with the following capabilities:

- **Authors** — register and list authors
- **Members** — register and list library members
- **Book Catalog** — register books with ISBN and associate them with authors
- **Book Inventory** — track how many copies are in stock
- **Reservations** — reserve a book for a member, subject to availability
- **Lending** — lend out a book and track return dates

The tutorials do not implement everything. Instead, each one picks the behavior that best illustrates a single pattern, so the focus stays on the technique, not the domain complexity.

## Tutorials

Work through these in order — each one builds on the context from the previous.

| Tutorial | Pattern | What you build |
| -------- | ------- | -------------- |
| [Register an author](/scenarios/vertical-slices/state-change/) | State Change | `RegisterAuthor` command, `AuthorRegistered` event, `AddAuthor` React form using `CommandDialog` |
| [List authors](/scenarios/vertical-slices/state-view/) | State View | `Author` read model built from events, `AllAuthors` query (observable where the backend supports it), `Authors` listing page using `DataPage` |
| [Cancel expired reservations](/scenarios/vertical-slices/automation/) | Automation | `ReservationDueForExpiry` to-do list, passive `PendingReservation` read model, and a `ReservationExpiryReactor` that sends `CancelExpiredReservation` for each overdue reservation |
| [Import members from HR](/scenarios/vertical-slices/translator/) | Translation | `MemberImportReactor` that listens for `HRMemberCreated` external events and fires `RegisterMember` in the library domain |
