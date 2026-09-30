---
title: Glossary
description: One place for the vocabulary of the Cratis stack — event sourcing, CQRS, and full-stack terms, each defined once and linked to its full explanation.
---

Event sourcing comes with its own vocabulary, and the Cratis stack adds a few terms of its own. This page
gives a short definition of each term across the stack, so the same word means the same thing on every
page. Where a term has a fuller explanation, the name links to it. The products keep their own, more
detailed glossaries: [Chronicle](/chronicle/concepts/glossary/), [Arc](/arc/glossary/), and
[Screenplay](/screenplay/glossary/).

## Event sourcing

These are the core ideas behind [Chronicle](/chronicle/). The [Concepts](/chronicle/concepts/) section
explains how they fit together.

| Term | Definition |
| --- | --- |
| [Event](/chronicle/concepts/event/) | A fact — something that happened, named in the past tense (`AccountOpened`). Immutable and single-purpose. By convention an event has no nullable properties (Chronicle's analyzers warn about them); an optional value usually means you need a second event. |
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
| [Causation](/chronicle/concepts/correlation-identity-causation/) | The chain of steps that led to an event, such as the root process and the command that appended it. With Arc, the command's name and property values are recorded in the chain, permanently. |
| [Tags](/chronicle/concepts/tagging/) | Labels on events for filtering and correlation — see also [event metadata tags](/chronicle/concepts/event-metadata-tags/). |
| [Aggregate](/arc/backend/csharp/chronicle/aggregates/) | A consistency boundary that encapsulates behavior and produces events. |
| [Constraint](/chronicle/constraints/) | A rule, such as uniqueness, that Chronicle checks when an event is appended and rejects the append if it fails. |
| [Dynamic consistency boundary](/chronicle/dynamic-consistency-boundary/) | Enforcing a rule that depends on current state under concurrency, by checking the state the decision was based on when the events are appended. |
| [Subject](/chronicle/concepts/subject/) | The person or entity whose personal data an event contains. PII is encrypted under a key per subject, which defaults to the event source id. |
| [PII](/chronicle/compliance/pii/) | Personal data marked with `[PII]`, encrypted at append time so it can be erased by deleting the subject's key. |

## Turning events into state

How events become the things you read and the actions you take.

| Term | Definition |
| --- | --- |
| [Observer](/chronicle/concepts/observers/) | Anything that watches events and acts — a projection, reducer, or reactor. |
| [Projection](/chronicle/projections/) | Builds a read model by mapping events declaratively. |
| [Reducer](/chronicle/reducers/) | Builds a read model by folding events imperatively. |
| [Reactor](/chronicle/reactors/) | Produces side effects (notifications, calls to other systems) in response to events. An event can be delivered to a reactor more than once, so side effects should be safe to repeat. |
| [Replay](/chronicle/reactors/replay/) | Running an observer over events it has already processed, for example to rebuild a read model. Replay re-delivers events to reactors unless the handler is marked `[OnceOnly]`. |
| [Read model](/chronicle/read-models/) | A queryable view shaped for one screen or question, built from events. |
| **Changeset** | The set of changes an observer applies for a single event. |
| [Eventual consistency](/chronicle/concepts/consistency/) | A read model that catches up shortly after an event is appended — the default. |
| [Immediate consistency](/chronicle/concepts/consistency/) | A read model updated synchronously, before the append returns — for reads you must get right now. |

## Full-stack: CQRS and the frontend

The terms [Arc](/arc/) and [Components](/components/) add on top of Chronicle.

| Term | Definition |
| --- | --- |
| [Command](/arc/backend/csharp/commands/) | An intent to change state — a record with a `Handle()` method. With Arc and Chronicle, events returned from `Handle()` are appended; a command can also return a response or nothing. |
| [Query](/arc/backend/csharp/queries/) | A read of data, exposed to the frontend as a typed proxy. |
| **Observable query** | A query that holds a live connection and pushes new results when the data changes. |
| **CQRS** | Command Query Responsibility Segregation — separating the write side (commands) from the read side (queries). |
| [Proxy generation](/arc/backend/csharp/proxy-generation/) | Arc emitting a typed TypeScript client from your C# commands and queries at build time. |
| [Concept](/fundamentals/csharp/concepts/) | A strongly-typed wrapper around a primitive (`AccountId` over `Guid`) so the compiler catches mix-ups. |
| [Vertical slice](/arc/vertical-slices/) | Everything for one behavior — command, events, projection, UI, specs — kept together in one folder. |

New to all this? Start with [Why developers choose Cratis](/why-cratis/), then the [Chronicle tutorial](/chronicle/tutorial/).
