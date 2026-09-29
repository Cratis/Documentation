---
title: Scenarios
description: End-to-end tutorials that show you how to build real software using the full Cratis stack — from event-sourced backend to reactive frontend.
---

Scenarios are end-to-end tutorials that show you how to build real software using the full Cratis stack — from event-sourced backend to reactive frontend — with concrete, working examples.

Each scenario builds a complete vertical slice of a real system instead of covering one API at a time. You see how **[Chronicle](/chronicle/)**, **[Arc](/arc/)**, and **[Components](/components/)** fit together at every layer, and why that combination matters.

:::caution[Arc for TypeScript is a source preview]
The backend tabs include Arc for TypeScript. No package is published to npm, it does not have full parity with Arc on .NET, and its package names and APIs can still change.
:::

## What you will find here

| Section | Description |
| ------- | ----------- |
| [Camel casing](/scenarios/camel-casing/) | How to get camelCase field names consistently in Chronicle projections and Arc MongoDB documents, for each Arc backend. |
| [Vertical slices](/scenarios/vertical-slices/) | Step-by-step tutorials that build an event-sourced Library system one slice at a time, following Event Modeling patterns. |
| [Real-time chat](/scenarios/chat/) | How to use Arc observable queries to build a live multi-room chat, with no polling and no manual WebSocket setup: in memory, over RabbitMQ, with frontend-managed state, and with incremental pushes (that backend is shown in C# only). |

## Approach

Each tutorial adds exactly one behavior, a single vertical slice, so you can follow along without getting lost in unrelated complexity. The slice goes all the way from the domain event and the backend that handles it, in C#, Kotlin, Java, or TypeScript, to the React component the user interacts with.

The code uses the same packages, conventions, and components as a real Cratis project, not simplified toy APIs, and each step explains why it is done that way as well as what to type.
