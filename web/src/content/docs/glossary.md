---
title: Glossary
description: One place for the vocabulary of the Cratis stack — event sourcing, CQRS, and full-stack terms, each defined once and linked to its full explanation.
---

Event sourcing comes with its own vocabulary, and the Cratis stack adds a few terms of its own. This is
the one place each term is defined — one term, one meaning, everywhere. Where a term has a fuller
explanation, the name links to it.

## Event sourcing

These are the core ideas behind [Chronicle](/chronicle/). The [Concepts](/chronicle/concepts/) section
explains how they fit together.

| Term | Definition |
| --- | --- |
| [Event](/chronicle/concepts/event/) | A fact — something that happened, named in the past tense (`AccountOpened`). Immutable, never nullable, never multipurpose. |
| [Event type](/chronicle/concepts/event-type/) | The schema and identity of an event — its shape and name. |
| [Event source](/chronicle/concepts/event-source/) | The thing an event happened *to*, identified by an id (an account, a book). |
| [Event sequence](/chronicle/concepts/event-sequence/) | An ordered, append-only stream of events you can subscribe to. The **event log** is the primary one — your source of truth. |
| **Sequence number** | An event's position within a sequence. |
| [Event store](/chronicle/concepts/event-store/) | The database that holds event sequences. |
| **Event sourcing** | Storing state as the full history of events, deriving current state by replaying them. See [when to use it](/chronicle/concepts/when-to-use-event-sourcing/). |
| [Namespace](/chronicle/concepts/namespaces/) | A partition of an event store, used for multi-tenancy. |
| **Tenant** | An isolated set of data for one customer — see [namespaces](/chronicle/namespaces/). |
| **Identity** | Who or what caused an event. |
| **Correlation** | Links events that belong to the same logical operation. |
| **Causation** | Links an event to the event that caused it. |
| [Tags](/chronicle/concepts/tagging/) | Labels on events for filtering and correlation — see also [event metadata tags](/chronicle/concepts/event-metadata-tags/). |
| [Aggregate](/arc/backend/chronicle/aggregates/) | A consistency boundary that encapsulates behavior and produces events. |

## Turning events into state

How events become the things you read and the actions you take.

| Term | Definition |
| --- | --- |
| [Observer](/chronicle/concepts/observers/) | Anything that watches events and acts — a projection, reducer, or reactor. |
| [Projection](/chronicle/projections/) | Builds a read model by mapping events declaratively. |
| [Reducer](/chronicle/reducers/) | Builds a read model by folding events imperatively. |
| [Reactor](/chronicle/reactors/) | Produces side effects (notifications, calls to other systems) in response to events. |
| [Read model](/chronicle/read-models/) | A queryable view shaped for one screen or question, built from events. |
| **Changeset** | The set of changes an observer applies for a single event. |
| [Eventual consistency](/chronicle/concepts/consistency/) | A read model that catches up shortly after an event is appended — the default. |
| [Immediate consistency](/chronicle/concepts/consistency/) | A read model updated synchronously, before the append returns — for reads you must get right now. |

## Full-stack: CQRS and the frontend

The terms [Arc](/arc/) and [Components](/components/) add on top of Chronicle.

| Term | Definition |
| --- | --- |
| [Command](/arc/backend/commands/) | An intent to change state — a record with a `Handle()` method that appends events. |
| [Query](/arc/backend/queries/) | A read of data, exposed to the frontend as a typed proxy. |
| **Observable query** | A query that holds a live connection and pushes new results when the data changes. |
| **CQRS** | Command Query Responsibility Segregation — separating the write side (commands) from the read side (queries). |
| [Proxy generation](/arc/backend/proxy-generation/) | Arc emitting a typed TypeScript client from your C# commands and queries at build time. |
| [Concept](/fundamentals/csharp/concepts/) | A strongly-typed wrapper around a primitive (`AccountId` over `Guid`) so the compiler catches mix-ups. |
| [Vertical slice](/arc/vertical-slices/) | Everything for one behavior — command, events, projection, UI, specs — kept together in one folder. |

New to all this? Start with [Why developers choose Cratis](/why-cratis/), then the [Chronicle tutorial](/chronicle/tutorial/).
