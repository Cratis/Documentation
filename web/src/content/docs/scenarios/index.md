# Scenarios

Scenarios are end-to-end tutorials that show you how to build real software using the full Cratis stack — from event-sourced backend to reactive frontend — with concrete, working examples.

Rather than covering individual APIs in isolation, each scenario builds a complete vertical slice of a real system. You will see how **[Chronicle](/docs/chronicle/)**, **[Arc](/docs/arc/)**, and **[Components](/docs/components/)** fit together at every layer, and why that combination matters.

## What you will find here

| Section | Description |
| ------- | ----------- |
| [Camel Casing](/docs/scenarios/camel-casing/) | How to configure camel casing consistently for Chronicle projections and Arc MongoDB documents from a Cratis meta package setup. |
| [Vertical Slices](/docs/scenarios/vertical-slices/) | Step-by-step tutorials that build an event-sourced Library system one slice at a time, following Event Modeling patterns. |
| [Real-Time Chat](/docs/scenarios/chat/) | How to use Arc observable queries with an in-memory service to build a live multi-room chat — no polling, no manual WebSocket setup. |

## Approach

Every scenario follows the same discipline:

- **One behaviour at a time.** Each tutorial adds exactly one piece of functionality — a single vertical slice — so you can follow along without getting lost in unrelated complexity.
- **End-to-end.** Each slice goes all the way from the domain event in C# to the React component the user interacts with.
- **Real tooling.** The code uses the exact packages, conventions, and components you would use in a production Cratis project — not simplified toy APIs.
- **Explained, not just shown.** Each step explains *why* things are done a particular way, not just *what* to type.
