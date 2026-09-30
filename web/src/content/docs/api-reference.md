---
title: API reference
description: Where to find the generated .NET and TypeScript API reference, and how it's produced.
---

Use this page to find an exact API signature when a guide does not cover your case. The generated references describe documented public APIs at the version built by the site; check your installed package version when a signature differs.

## .NET / C\#

The .NET API reference is generated with **DocFX** from the XML documentation comments across the Chronicle client SDK, Arc, and Fundamentals assemblies.

**[Browse the .NET API reference →](/api/)** — public types and members from the Chronicle clients, Arc (including Arc.Core and MongoDB), and Fundamentals, organized by namespace. Shared extension classes list their contributing assemblies; existing per-library type and member URLs redirect to the canonical pages.

XML comments also appear in IDE IntelliSense. Relevant NuGet packages include [`Cratis.Chronicle`](https://www.nuget.org/packages/Cratis.Chronicle), [`Cratis.Arc`](https://www.nuget.org/packages/Cratis.Arc), [`Cratis`](https://www.nuget.org/packages/Cratis), [`Cratis.Testing`](https://www.nuget.org/packages/Cratis.Testing), [`Cratis.Arc.MongoDB`](https://www.nuget.org/packages/Cratis.Arc.MongoDB), and [`Cratis.Specifications.XUnit`](https://www.nuget.org/packages/Cratis.Specifications.XUnit). Install only the packages your application needs.

## TypeScript

The TypeScript API reference is generated with **TypeDoc** from the `@cratis/*` packages and surfaced alongside the rest of the site:

- [`@cratis/arc`](/api/arc/javascript/arc/) — the Arc client core
- [`@cratis/arc.react`](/api/arc/javascript/arc.react/) — React hooks and bindings
- [`@cratis/arc.react.mvvm`](/api/arc/javascript/arc.react.mvvm/) — the MVVM layer
- [`@cratis/arc.vite`](/api/arc/javascript/arc.vite/) — Vite integration for metadata and queries; the .NET build generates proxies
- [`@cratis/fundamentals`](/api/fundamentals/javascript/) — shared utilities and concepts

## How it's produced (for contributors)

We deliberately **combine tooling**: a modern site for the narrative docs, and the best generator for each kind of API reference. The reference is built in the documentation pipeline from the product source — there's nothing to hand-maintain. See the documentation site's `README.md` for the build details.

## When to reach for what

- **Learning or solving a problem?** Stay in the guides, [tutorial](/chronicle/tutorial/), and [scenarios](/chronicle/scenarios/) — they explain the *why* and the *how*.
- **Looking up an exact signature?** The API reference and your IDE's IntelliSense are the fastest path.
