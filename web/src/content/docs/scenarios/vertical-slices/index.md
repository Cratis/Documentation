---
title: Vertical Slices
description: Step-by-step tutorials that build an event-sourced Library system one slice at a time, following Event Modeling patterns.
---

# Vertical Slices

This series of tutorials builds a **Library system** end to end, one behaviour at a time. Each tutorial corresponds to one of the four slice patterns from [Event Modeling](https://novanet.no/stop-guessing-start-modeling/), and each one builds on the previous.

By the end you will have seen how every layer of the Cratis stack fits together: [Chronicle](/chronicle/) event sourcing, [Arc](/arc/)'s CQRS application model, and the purpose-built [Components](/components/) library.

---

## Why Event Modeling?

Most software projects don't fail because of bad code. They fail because the team built the wrong thing — or built the right thing but nobody agrees on what it actually does. A product owner, a developer, and a domain expert sit in a meeting, all walk out believing they understood each other, and three weeks later reality proves otherwise.

[Event Modeling](https://eventmodeling.org) addresses this directly. It is a way to design and describe information systems using a **shared timeline** — a visual blueprint everyone on the team can read, from developers to domain experts to product owners. Unlike a traditional specification document, an event model is collaborative and alive. It uses only three building blocks and four patterns. You can explain the core concept in minutes; the rest you learn by doing.

### The Three Building Blocks

Every Event Model is made from exactly three concepts:

| Building Block | What it is | Examples |
| ------------ | ---------- | ------- |
| **Events** | Facts — immutable records of things that have already happened | `AuthorRegistered`, `BookBorrowed`, `LoanOverdue` |
| **Commands** | Intentions — what a user (or system) is trying to do, which will cause an event | `RegisterAuthor`, `BorrowBook`, `CancelReservation` |
| **Read Models** | Outputs — how the system informs users about what is going on | The author list, the inventory dashboard, the borrowing history |

Put them together and you have a complete picture of any workflow: a command comes in, gets validated, an event is recorded, the read model is updated — and the user sees the result.

### The Four Patterns

Three building blocks. Four ways to combine them. That is the entire vocabulary.

#### State Change

A user submits a command. It gets validated. An event is recorded.

`RegisterAuthor` fires → `AuthorRegistered` is stored. The intent is explicit, the outcome is captured. This is the most common pattern — the write side of your system.

In Cratis this is: an [Arc](/arc/) model-bound command whose handler returns a Chronicle [event](/chronicle/events/), optionally guarded by a command validator or a Chronicle [constraint](/chronicle/constraints/).

#### State View

Events are **projected** into a read model that the UI displays.

An `Author` read model gets built from `AuthorRegistered` events. It is always up to date, and you can rebuild it from scratch at any point just by replaying the events. This is the read side — fast, purpose-built, and completely independent from the write side.

In Cratis this is: a [read model](/chronicle/read-models/) built by a [projection](/chronicle/projections/) or reducer, with a query that the frontend calls — observable where the backend supports it, so the UI updates in real time.

#### Automation

A processor watches a read model (think: a to-do list), picks up items, and fires a command to handle each one — entirely behind the scenes.

Sending an overdue notice when a loan passes its return date. Cancelling a reservation that was never collected. Triggering a payment. No human involved; the same building blocks, automated.

In Cratis this is: a Chronicle [reactor](/chronicle/reactors/) that observes the event stream and sends commands through Arc's command pipeline back into your own system.

#### Translation

When an event comes from an external system — one you don't own — you translate its language into yours. You don't want raw payloads as domain events. You want `BookInformationReceived` and `MemberImported` — events that mean something in your own context.

In Cratis this is: a Chronicle [reactor](/chronicle/reactors/) that listens for external events and fires commands in your own system, which in turn produce domain events with your own vocabulary.

---

## How Cratis Maps to Event Modeling

| Pattern | Chronicle | Arc | Components |
| ------- | --------- | --- | ---------- |
| **State Change** | [Event types](/chronicle/events/) stored in the event log, guarded by [constraints](/chronicle/constraints/) | Model-bound command with a handler and validators | [`CommandDialog`](/components/commanddialog/) for the form UI |
| **State View** | [Projections](/chronicle/projections/) or reducers building a [read model](/chronicle/read-models/) | Query over the read model, with generated proxies | [`DataPage`](/components/datapage/) for the listing UI |
| **Automation** | [Reactor](/chronicle/reactors/) observing the event log | Command pipeline to fire commands | No UI — runs in the background |
| **Translation** | [Reactor](/chronicle/reactors/) on external event streams | Command pipeline bridging to domain commands | No UI — integration layer |

Each tutorial shows the backend code in C#, Kotlin, Java and TypeScript, and notes where a backend does not support a step yet. For the language-specific APIs, see [Arc backends](/arc/backend/).

The key insight: [Chronicle](/chronicle/) stores the facts (events), [Arc](/arc/) wires up the intent (commands) and the queries, [Components](/components/) renders the result. Each layer has one job and they compose cleanly.

---

## The Library System

All four tutorials build parts of a **Library** system with the following capabilities:

- **Authors** — register and list authors
- **Members** — register and list library members
- **Book Catalog** — register books with ISBN and associate them with authors
- **Book Inventory** — track how many copies are in stock
- **Reservations** — reserve a book for a member, subject to availability
- **Lending** — lend out a book and track return dates

The tutorials do not implement everything. Instead, each one picks the behaviour that best illustrates a single pattern, so the focus stays on the technique, not the domain complexity.

---

## Tutorials

Work through these in order — each one builds on the context from the previous.

| Tutorial | Pattern | What you build |
| -------- | ------- | -------------- |
| [State Change — Register an Author](./state-change) | State Change | `RegisterAuthor` command, `AuthorRegistered` event, `AddAuthor` React form using `CommandDialog` |
| [State View — List Authors](./state-view) | State View | `Author` read model built from events, `AllAuthors` query (observable where the backend supports it), `Authors` listing page using `DataPage` |
| [Automation — Cancel Expired Reservations](./automation) | Automation | `ReservationDueForExpiry` to-do list, passive `PendingReservation` read model, and a `ReservationExpiryReactor` that sends `CancelExpiredReservation` for each overdue reservation |
| [Translation — Import Members from HR](./translator) | Translation | `MemberImportReactor` that listens for `HRMemberCreated` external events and fires `RegisterMember` in the library domain |
