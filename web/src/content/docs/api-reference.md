---
title: Cratis API reference for .NET and TypeScript
description: Find public types, members, and signatures in the generated Cratis .NET and TypeScript API references, with coverage and package-version guidance.
---

The Cratis API reference lets you look up public types, members, and exact signatures for the .NET and TypeScript libraries listed below. Use it when a guide does not cover the call you need. The references describe the source version built by the site, not necessarily your installed package version; compare versions if a signature differs.

## .NET / C\#

[Browse the .NET API reference →](/api/) to find types and members by namespace. DocFX generates it from assemblies and their XML documentation comments. It covers seven assemblies:

- Cratis Chronicle: the .NET client (`Cratis.Chronicle`), ASP.NET Core integration (`Cratis.Chronicle.AspNetCore`), and testing helpers (`Cratis.Chronicle.Testing`).
- Cratis Arc: the application framework (`Cratis.Arc`), core command and query pipelines (`Cratis.Arc.Core`), and MongoDB read-model persistence (`Cratis.Arc.MongoDB`).
- Cratis Fundamentals: shared building blocks (`Cratis.Fundamentals`).

Shared namespaces and extension classes have one page listing their contributing assemblies. Existing per-library type and member URLs redirect to those pages.

XML comments also appear in IDE IntelliSense. Package details are available on NuGet for [`Cratis.Chronicle`](https://www.nuget.org/packages/Cratis.Chronicle), [`Cratis.Arc`](https://www.nuget.org/packages/Cratis.Arc), [`Cratis`](https://www.nuget.org/packages/Cratis), [`Cratis.Testing`](https://www.nuget.org/packages/Cratis.Testing), [`Cratis.Arc.MongoDB`](https://www.nuget.org/packages/Cratis.Arc.MongoDB), and [`Cratis.Specifications.XUnit`](https://www.nuget.org/packages/Cratis.Specifications.XUnit). Install only the packages your application needs.

## TypeScript

TypeDoc generates a separate reference for each of these TypeScript packages:

- [`@cratis/arc`](/api/arc/javascript/arc/) — the Arc client core
- [`@cratis/arc.react`](/api/arc/javascript/arc.react/) — React hooks and bindings
- [`@cratis/arc.react.mvvm`](/api/arc/javascript/arc.react.mvvm/) — model-view-viewmodel (MVVM) integration for React
- [`@cratis/arc.vite`](/api/arc/javascript/arc.vite/) — Vite integration for metadata and queries; the backend generates proxies
- [`@cratis/fundamentals`](/api/fundamentals/javascript/) — shared utilities and concepts

These generated references do not cover every backend or Chronicle client. For other runtimes, start with [Chronicle clients](/chronicle-clients/) or [Arc backends](/arc/backend/) and use that implementation's API documentation.

## How it's produced (for contributors)

The documentation pipeline runs DocFX and TypeDoc against the product source and serves their generated output under `/api/`. Make API documentation changes in the product source rather than editing generated pages. The documentation site's `README.md`, under “API reference and Storybook,” lists the generation inputs and build requirements.

## When to reach for what

Use the API reference or your IDE's IntelliSense when you know the operation and need its signature. For a worked example, follow the [Chronicle tutorial](/chronicle/tutorial/) to build from a first event to a read model, or choose a [Chronicle scenario](/chronicle/scenarios/) for a specific problem.
