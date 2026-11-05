---
title: Event sourcing concepts and architectural choices
description: "Event sourcing records facts, CQRS separates read and write models, and projections build views. Learn when each choice fits your application."
---

Event sourcing preserves business changes as facts, CQRS separates writing from reading, and event-driven architecture connects components through events. These are separate choices: needing a history does not automatically mean needing a message broker, and separating commands from queries does not require an event store.

Use these explanations to decide what one feature needs before choosing its implementation. The examples use [Cratis Chronicle](/chronicle/) for event storage and processing and [Cratis Arc](/arc/) for commands and queries. Neither component requires adopting the whole Cratis Platform.

## Find the question you need to answer

| Page | Question it answers |
| --- | --- |
| [What is event sourcing?](/concepts/event-sourcing/) | What does it mean to store changes as events instead of current state? |
| [CQRS explained](/concepts/cqrs/) | Why separate the model that changes data from the model that reads it? |
| [Event store vs. a regular database](/concepts/event-store/) | How is a database built for events different from a relational or document database? |
| [Event modeling: a practical guide](/event-modeling/) | How do you design an event-sourced system before writing code? |
| [Keeping decisions correct under concurrency](/concepts/keeping-decisions-correct/) | Why does read, decide, append break under concurrency, and how do you make a rule hold? |
| [The Dynamic Consistency Boundary](/concepts/dynamic-consistency-boundary/) | What does it mean to draw the consistency boundary per decision, and where do Chronicle and Arc sit? |
| [Read this first: write-side consistency](/concepts/read-this-first-write-side-consistency/) | How do DCB, stream-version checks and aggregates map onto Chronicle's guards? |
| [Decisions that hold, from model to frontend](/decisions-that-hold-walkthrough/) | How do you build one guarded rule across Screenplay, Arc, Chronicle and a React frontend? |
| [Agentic development with event sourcing](/agentic-development/) | How can explicit events, commands and specifications give AI coding agents clearer boundaries? |
| [Projections and read models](/concepts/projections-and-read-models/) | How do events become queryable views? |
| [Event-driven architecture vs. event sourcing](/concepts/event-driven-architecture/) | How do messaging between services and event storage relate? |
| [Event sourcing and GDPR](/concepts/event-sourcing-gdpr/) | How do you erase personal data from an immutable event log? |
| [Organization, workspace and namespace](/concepts/organization-workspace-namespace/) | Which word names the customer, the place people work, and where that work is stored, and who owns each? |

## Choose a starting point

Start with [what is event sourcing?](/concepts/event-sourcing/) if you need to explain how today's state came to be. Follow with projections to see how that history becomes a useful screen or report. If your immediate problem is a model that serves both reads and writes poorly, start with CQRS instead.

When you are ready to store a first event, continue with [Get started with Chronicle](/chronicle/get-started/). Use the [Cratis Platform component overview](/cratis-stack/) to understand how the components fit together and which ones your application actually needs.
