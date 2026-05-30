---
title: How Cratis compares
description: An honest look at how Cratis relates to Marten, Wolverine, and Kurrent/EventStoreDB — what's different, and when each is the right choice.
---

If you're evaluating Cratis, you've probably used — or seriously considered — Marten, Wolverine, or Kurrent (formerly EventStore). They're excellent, mature tools, and this page is an honest take on how Cratis is *different*, not a takedown. The goal is to help you choose well.

## The one thing that sets Cratis apart

**Cratis is full-stack.** Marten, Wolverine, and Kurrent are backend tools — they stop at your .NET API, and the frontend is your problem. Cratis goes all the way through: [Arc](/arc/) generates **type-safe TypeScript proxies** from your C# commands and queries, and [Components](/components/) renders them, so a feature is one [vertical slice](/arc/vertical-slices/) from event to React screen with nothing hand-wired in between.

Everything else flows from a few deliberate bets:

| Cratis bets on… | …which differs from |
|---|---|
| **Full-stack type safety** (C# → generated TS → React) | Marten/Wolverine/Kurrent stop at the backend |
| **Convention over configuration** — commands are records with `Handle()`, read models are *declared* | More explicit wiring (handlers, projection classes, client setup) |
| **Storage flexibility** — MongoDB by default, extensible | Marten is PostgreSQL; Kurrent is its own engine |
| **One coherent, opinionated stack** | Assembling best-of-breed libraries yourself |

## Where each tool shines (and when to stay)

- **Marten** — a superb document store *and* event store on PostgreSQL. If you're all-in on Postgres, love its document features, and want the JasperFx "Critter Stack," Marten is a great fit. → [Coming from Marten](./marten)
- **Wolverine** — a powerful mediator and full messaging framework (transports, sagas, durability). If you need cross-service async messaging across many transports, that's its home turf — Cratis is not a general-purpose message bus. → [Coming from Wolverine](./wolverine)
- **Kurrent / EventStoreDB** — a battle-tested, multi-language event-sourcing database with strong operational and cloud tooling. If you need first-class clients across Java/Node/Go/etc. or its operational maturity, it's a strong choice. → [Coming from Kurrent / EventStoreDB](./kurrent)

Cratis is for teams who want the **full-stack, convention-driven, .NET + React** experience as one stack — and are happy on MongoDB (or an extension store).

## Already coming from a pattern, not a product?

- [Coming from CRUD and Entity Framework](/chronicle/coming-from-crud/)
- [Coming from MediatR or MVC](/arc/coming-from-mediatr-and-mvc/)

Each page below maps the concepts you know onto Cratis, shows the same feature side by side, and gives concrete migration steps.
