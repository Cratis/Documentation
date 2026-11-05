---
title: Vertical slices — build the Library with Cratis
description: Build Library workflows with Cratis Arc, Chronicle and Components, from author registration and live lists to reservation expiry and HR imports.
---

A vertical slice keeps one business behavior together, from the action that starts it to the result a user needs. In this series, you build a Library with [Cratis Arc](/arc/), [Cratis Chronicle](/chronicle/) and [Cratis Components](/components/): register an author, show a live author list, expire uncollected reservations and import members from HR. Each tutorial follows one of the four slice patterns from [Event Modeling](https://novanet.no/stop-guessing-start-modeling/).

Follow the backend examples for C#, Kotlin, Java or TypeScript, then connect the shared React UI where the workflow needs one. The TypeScript backend is available from source, not npm. The [backend comparison](#how-the-backends-differ) explains the setup and behavior that differ between languages.

## Why Event Modeling?

Before implementing a Library workflow, agree on what starts it, what fact it records and what someone needs to see afterward. [Event Modeling](https://eventmodeling.org) puts those decisions on a shared timeline, so developers, product owners and domain experts can discuss the same behavior.

The tutorials turn that timeline into code. An author's registration becomes a command and an event; the author list shows how recorded events become information a librarian can use.

### The three building blocks

These tutorials use three building blocks:

| Building block | What it is | Examples |
| ------------ | ---------- | ------- |
| **Events** | Facts — immutable records of things that have already happened | `AuthorRegistered`, `BookBorrowed`, `LoanOverdue` |
| **Commands** | Intentions — what a user or system asks to change, subject to validation and business rules | `RegisterAuthor`, `BorrowBook`, `CancelReservation` |
| **Read Models** | Outputs — how the system informs users about what is going on | The author list, the inventory dashboard, the borrowing history |

For author registration, the command expresses the librarian's intent, the event records the accepted registration, and the read model supplies the list. Updating that list is later work: a successful command does not mean the projection has already caught up.

### The four patterns

Every slice in an event model combines the three building blocks in one of four ways.

#### State Change

The librarian submits `RegisterAuthor` with an author's names. If the input and uniqueness checks pass, Chronicle records `AuthorRegistered`. Rejection leaves the event log unchanged.

An [Arc](/arc/) model-bound command expresses that intent. Its handler returns a Chronicle [event](/chronicle/events/); command validation checks the input before the handler runs, and a Chronicle [constraint](/chronicle/constraints/) enforces uniqueness at append time.

#### State View

Events are **projected** into a read model that the UI displays.

An `Author` read model is built from `AuthorRegistered` events so librarians can browse authors without scanning the event log. The view can lag behind a new registration while event processing catches up. Replaying the events lets you rebuild it when its shape changes.

In Cratis, a [projection](/chronicle/projections/) or reducer builds the [read model](/chronicle/read-models/), and an Arc query exposes it to the frontend. The author-list tutorial uses an observable query to deliver changes to the page.

#### Automation

A daily clock event starts a sweep of overdue reservations. A Chronicle [reactor](/chronicle/reactors/) reads a projected to-do list and sends an Arc command for each candidate, without a librarian opening a form.

The command rechecks the reservation before recording its expiry. A scheduler supplies the clock event; the reactor does not run merely because time has passed.

#### Translation

The HR system reports staff in its own terms. An inbound adapter records that payload as `HRMemberCreated` in Chronicle, and a [reactor](/chronicle/reactors/) maps active staff to the Library's `RegisterMember` command.

The command applies Library rules and records `MemberRegistered`. Library views consume that domain event rather than depending on HR's names and status codes.

## How Cratis maps to Event Modeling

| Pattern | Chronicle | Arc | Components |
| ------- | --------- | --- | ---------- |
| **State Change** | [Event types](/chronicle/events/) stored in the event log, guarded by [constraints](/chronicle/constraints/) | Model-bound command with a handler and validators | [`CommandDialog`](/components/commanddialog/) for the form UI |
| **State View** | [Projections](/chronicle/projections/) or reducers building a [read model](/chronicle/read-models/) | Query over the read model, with generated proxies | [`DataPage`](/components/datapage/) for the listing UI |
| **Automation** | [Reactor](/chronicle/reactors/) observing the event log | Command pipeline to fire commands | No UI — runs in the background |
| **Translation** | [Reactor](/chronicle/reactors/) on integration events recorded in Chronicle | Command pipeline bridging to domain commands | No UI — integration layer |

Arc discovers the application's commands and queries, runs their pipelines and generates the TypeScript proxies the UI calls. This series uses Arc's optional Chronicle integration to record events and build read models; Arc can also run without event sourcing. Components supplies forms and data pages bound to those proxies. See [Arc backends](/arc/backend/) for language-specific setup.

## How the backends differ

The tutorials teach one design in four backend languages. Where a backend cannot follow a step as written, the tutorial says what it does instead and links back to this table:

| Behavior | C# | Kotlin and Java | TypeScript |
| --- | --- | --- | --- |
| Author list ([State View](/scenarios/vertical-slices/state-view/)) | Live: the query observes Chronicle's MongoDB sink | Live: observes the first page of 50 materialized instances; needs Chronicle 19.22.2 or later | Live: `ChronicleReadModels.observeAll` |
| Commands called without a signed-in user | The commands declare no authorization rules | Marked `@AllowAnonymous`, because Arc on the JVM requires an authenticated caller by default | The commands declare no authorization rules |
| How Chronicle finds a reactor's handler ([Automation](/scenarios/vertical-slices/automation/#how-each-backend-runs-the-reactor)) | Supported signatures and event parameter types on an `IReactor` | The event parameter type on a `@Reactor` class | The method name: the event class name with its first letter lowercased, on a `@reactor()` class |
| How the expiry reactor runs commands ([Automation](/scenarios/vertical-slices/automation/#how-each-backend-runs-the-reactor)) | Calls `ICommandPipeline`; throws on authorization failure or exceptions, tolerates validation rejections | Passes each command to `ChronicleCommandSideEffectHandler`; throws on an unsuccessful result | Returns commands; Arc's `reactorCommandResultHandler` runs them and throws on an unsuccessful result |
| Constraints in command specs ([State Change](/scenarios/vertical-slices/state-change/#step-4--command-specs)) | Enforced: the scenario runs an in-process Chronicle kernel | Not enforced: the scenario's event log is in memory | Not enforced: the scenario records events in memory |

## The Library system

The Library domain gives the examples a shared vocabulary:

- **Authors** — register and list authors
- **Members** — register and list library members
- **Book Catalog** — register books with ISBN and associate them with authors
- **Book Inventory** — track how many copies are in stock
- **Reservations** — reserve a book for a member, subject to availability
- **Lending** — lend out a book and track return dates

These tutorials implement author registration and listing, reservation expiry, and member registration from HR. The other Library workflows provide context, not a complete application delivered by this series.

## Tutorials

Start with registration, then use its events to build the author list. The reservation automation and HR translator show two ways to initiate commands without a user submitting a form.

| Tutorial | Pattern | What you build |
| -------- | ------- | -------------- |
| [Register an author](/scenarios/vertical-slices/state-change/) | State Change | Save an author's registration and reject an exact duplicate name |
| [List authors](/scenarios/vertical-slices/state-view/) | State View | Let librarians browse registered authors in a live list |
| [Cancel expired reservations](/scenarios/vertical-slices/automation/) | Automation | End uncollected reservations when the daily sweep finds them overdue |
| [Import members from HR](/scenarios/vertical-slices/translator/) | Translation | Register active HR staff through the Library's own member rules |
