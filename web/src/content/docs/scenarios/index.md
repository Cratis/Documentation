---
title: Cratis scenarios for building application workflows
description: Choose a Cratis guide to align MongoDB names, build an event-sourced Library workflow, or deliver live chat updates through Arc and React.
---

Cratis scenarios help you build a specific application behavior or solve a configuration problem. Choose the outcome you need: matching MongoDB names, an event-sourced Library workflow, or a chat page that updates as messages arrive.

The Library tutorials connect [Chronicle](/chronicle/) events to [Arc](/arc/) commands and queries and a React interface built with [Components](/components/). The chat guides focus on Arc's observable queries, which push changed results to the frontend. You do not need every Cratis product for every scenario.

:::caution[Arc for TypeScript distribution and parity]
The backend tabs include Arc for TypeScript. No package is published to npm, it does not have full parity with Arc on .NET, and its package names and APIs can still change.
:::

## What you will find here

| Section | What you can do |
| ------- | --------------- |
| [Camel casing](/scenarios/camel-casing/) | Make Chronicle projections and Arc MongoDB access agree on field and collection names. Start with an application using both integrations. |
| [Vertical slices](/scenarios/vertical-slices/) | Register and list Library authors, then add automation and external-event translation. Follow the tutorials in order; each builds on the previous context. |
| [Real-time chat](/scenarios/chat/) | Deliver messages to a live multi-room chat. Start in memory, then choose RabbitMQ, frontend-managed state, or incremental pushes. The incremental-push backend is shown in C# only. |

## Approach

Choose your backend before following a guide. Examples use C#, Kotlin, Java or TypeScript where that backend supports the step; the series pages explain the differences. For backend setup, start with [Arc backends](/arc/backend/), then use the prerequisites on the guide you choose.

A vertical slice follows one behavior through the layers it needs, such as submitting a command and displaying the resulting read model. The Library series teaches that sequence. If you already have an application and need one naming fix or a different way to deliver live query results, go directly to the relevant how-to.
