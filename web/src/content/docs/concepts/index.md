---
title: Concepts
description: "Concepts behind event-sourced systems: event sourcing, CQRS, event stores, event modeling, projections, read models and event-driven architecture."
---

These pages explain the ideas behind event-sourced systems, independent of any product. Each one defines the concept, shows how it works, gives a short example, and says when not to use it. Examples use [Chronicle](/chronicle/) and [Arc](/arc/) so you can see the idea in real code.

| Page | Question it answers |
| --- | --- |
| [What is event sourcing?](/concepts/event-sourcing/) | What does it mean to store changes as events instead of current state? |
| [CQRS explained](/concepts/cqrs/) | Why separate the model that changes data from the model that reads it? |
| [Event store vs. a regular database](/concepts/event-store/) | How is a database built for events different from a relational or document database? |
| [Event modeling: a practical guide](/concepts/event-modeling/) | How do you design an event-sourced system before writing code? |
| [Keeping decisions correct under concurrency](/concepts/keeping-decisions-correct/) | Why does read, decide, append break under concurrency, and how do you make a rule hold? |
| [The Dynamic Consistency Boundary](/concepts/dynamic-consistency-boundary/) | What does it mean to draw the consistency boundary per decision, and where do Chronicle and Arc sit? |
| [Read this first: write-side consistency](/concepts/read-this-first-write-side-consistency/) | How do DCB, stream-version checks and aggregates map onto Chronicle's guards? |
| [Decisions that hold, from model to frontend](/decisions-that-hold-walkthrough/) | How do you build one guarded rule across Screenplay, Arc, Chronicle and a React frontend? |
| [Agentic development with event sourcing](/agentic-development/) | Why do explicit events, commands and specifications make AI coding agents safer to rely on? |
| [Projections and read models](/concepts/projections-and-read-models/) | How do events become queryable views? |
| [Event-driven architecture vs. event sourcing](/concepts/event-driven-architecture/) | How do messaging between services and event storage relate? |
| [Event sourcing and GDPR](/concepts/event-sourcing-gdpr/) | How do you erase personal data from an immutable event log? |

Start with [what is event sourcing?](/concepts/event-sourcing/) if the terms are new. When you are ready to build, continue with [Get started with Chronicle](/chronicle/get-started/) or the [Cratis Stack overview](/cratis-stack/).
