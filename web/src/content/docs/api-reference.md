---
title: API reference
description: Where to find the generated .NET and TypeScript API reference, and how it's produced.
---

The narrative documentation — guides, concepts, tutorials — is what you're reading here. The **API reference** is the exhaustive, generated description of every public type and member, produced directly from the source so it never drifts.

## .NET / C#

The .NET API reference is generated with **DocFX** from the XML documentation comments across the Chronicle client SDK, Arc, and Fundamentals assemblies. In the published site it lives under `/api`, organized per package.

While you're coding, the same XML docs power **IntelliSense** in your IDE — so the reference is right there as you type. The packages:

- [`Cratis.Chronicle`](https://www.nuget.org/packages/Cratis.Chronicle) — the Chronicle client SDK
- [`Cratis.Arc`](https://www.nuget.org/packages/Cratis.Arc) — the Arc application framework

## TypeScript

The TypeScript API reference is generated with **TypeDoc** from the `@cratis/*` packages (Arc and its React bindings, Fundamentals) and surfaced alongside the rest of the site. The packages:

- [`@cratis/arc`](https://www.npmjs.com/package/@cratis/arc)
- [`@cratis/components`](https://www.npmjs.com/package/@cratis/components)

## How it's produced (for contributors)

We deliberately **combine tooling**: a modern site for the narrative docs, and the best generator for each kind of API reference. The reference is built in the documentation pipeline from the product source — there's nothing to hand-maintain. See the documentation site's `README.md` for the build details.

## When to reach for what

- **Learning or solving a problem?** Stay in the guides, [tutorial](/chronicle/tutorial/), and [scenarios](/chronicle/scenarios/) — they explain the *why* and the *how*.
- **Looking up an exact signature?** The API reference and your IDE's IntelliSense are the fastest path.
