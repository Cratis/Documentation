---
title: Cratis
description: Build event-sourced applications with Chronicle, Arc, and Components — the full-stack, type-safe Cratis platform.
template: splash
hero:
  title: Event sourcing you can actually be productive with
  tagline: "We treat event sourcing as the default architecture for information systems: capture what happened as immutable facts, project exactly the read models you need, and ship a full-stack, type-safe app — identity, tenancy, backend, React, storage choice, and operations — without the boilerplate."
  image:
    dark: ../../assets/cratis-mark-dark.svg
    light: ../../assets/cratis-mark-light.svg
  actions:
    - text: Get started
      link: '#get-started-in-3-steps'
      icon: right-arrow
    - text: Why event sourcing?
      link: /chronicle/why-event-sourcing/
      variant: minimal
      icon: open-book
    - text: Learn more
      link: /chronicle/
      variant: minimal
      icon: open-book
    - text: GitHub
      link: https://github.com/cratis
      variant: minimal
    - text: Community
      link: /community/
      variant: minimal
---

import { Card, CardGrid, LinkCard, Tabs, TabItem, Steps } from '@astrojs/starlight/components';
import SimpleCard from '../../components/SimpleCard.astro';
import StackJourney from '../../components/StackJourney.astro';
import RotatingHero from '../../components/RotatingHero.astro';

{/* Rotates the hero above through Event Sourcing / CQRS / Application
    Framework / Studio messages. The frontmatter hero is the first pane and
    the no-JS fallback — keep the two in sync. */}
<RotatingHero />

## Get started in 3 steps

Install the .NET templates and spin up your first full-stack Cratis app — Chronicle, Arc, and a React frontend, all wired up — in minutes.

<Steps>

1. **Install the Cratis templates.** Add the official project templates to your .NET CLI. You only need to do this once.

   ```bash
   dotnet new install Cratis.Templates
   ```

2. **Create your application.** Scaffold a new app complete with Chronicle, Arc, and a React frontend.

   ```bash
   dotnet new cratis -n MyApp --allow-scripts Yes
   ```

3. **Run it.** Start the supporting services, then the backend and the frontend from your new app folder.

   ```bash
   cd MyApp && docker compose up -d
   dotnet run
   yarn dev
   ```

</Steps>

Prefer a guided path? The [Chronicle getting-started walkthrough](/chronicle/get-started/) takes one event through a projection and a reactor, step by step.

<StackJourney
  eyebrow="One feature, every layer"
  title="See the full-stack loop before you choose a product"
  intro="Cratis is most different when you follow one behavior all the way through: model the domain, resolve identity and tenant at the edge, build the slice, record the event, render the React screen, then inspect the running system with tools and AI."
/>

## Why developers choose Cratis

Cratis is for teams that want the domain model to be the running system, not a diagram beside it. The big win is fit: Chronicle, Arc, Components, AuthProxy, Studio, the CLI, and the AI tooling are opinionated in the same direction, so codebases stay consistent, predictable, and easier for both developers and agents to work in.

<CardGrid>
  <SimpleCard title="Everything fits together" icon="puzzle" link="/cratis-stack/">
    Domain model, identity, tenant context, backend behavior, React screens, event history, and tools share one set of conventions.
  </SimpleCard>
  <SimpleCard title="Build behavior, not glue" icon="approve-check" link="/why-cratis/">
    Commands, queries, read models, UI, and tooling share one model. You spend time on the slice, not the handoffs between products.
  </SimpleCard>
  <SimpleCard title="One contract to React" icon="seti:typescript" link="/arc/understanding-the-proxy-boundary/">
    C# commands and queries generate the TypeScript your frontend calls. Rename a property and the compiler finds every mismatch.
  </SimpleCard>
  <SimpleCard title="End-to-end foundations" icon="seti:lock" link="/authproxy/">
    Authentication, tenant resolution, identity enrichment, authorization, and tenant isolation are part of the stack instead of every app's custom plumbing.
  </SimpleCard>
  <SimpleCard title="Event sourcing by default" icon="seti:db" link="/chronicle/why-event-sourcing/">
    Chronicle records facts, projects read models, and keeps the history most information systems eventually need.
  </SimpleCard>
  <SimpleCard title="Open event backbone" icon="puzzle" link="/chronicle/architecture/">
    Chronicle exposes a gRPC/protobuf boundary, has a first-class .NET client, and also ships TypeScript and Elixir clients/contracts.
  </SimpleCard>
  <SimpleCard title="Storage choice" icon="seti:db" link="/chronicle/hosting/configuration/storage/">
    Run Chronicle over MongoDB, PostgreSQL, Microsoft SQL Server, or SQLite without changing the event model.
  </SimpleCard>
  <SimpleCard title="Predictable for AI" icon="rocket" link="/ai-native-development/">
    Strong conventions, analyzers, and `.ai` guidance give assistants the same rails developers use to build and operate the system.
  </SimpleCard>
  <SimpleCard title="Live screens by default" icon="laptop" link="/components/">
    Observable queries and typed components keep forms, tables, and dialogs current without reload code or duplicate client models.
  </SimpleCard>
  <SimpleCard title="Inspect it live" icon="rocket" link="/cli/">
    Workbench, CLI, OpenTelemetry, recommendations, jobs, replay, and failed partitions show what Chronicle is doing.
  </SimpleCard>
</CardGrid>

## One feature, one slice — typed end to end

You write the behavior once in C#. Arc generates the TypeScript proxies. The React side can't drift — rename a property in C#, rebuild, and the frontend stops compiling until you fix it.

<Tabs>
<TabItem label="C# — the slice" icon="seti:c-sharp">
```csharp
// Command, event, and read model for one feature — in one file.
[Command]
public record RegisterAuthor(AuthorId Id, AuthorName Name)
{
    public AuthorRegistered Handle() => new(Name);   // returns the fact that happened
}

[EventType]
public record AuthorRegistered(AuthorName Name);

[ReadModel, FromEvent<AuthorRegistered>]
public record Author(AuthorId Id, AuthorName Name)
{
    // This static method *is* the query — exposed over HTTP automatically.
    public static Task<IEnumerable<Author>> AllAuthors(IReadModels readModels) =>
        readModels.Materialized.GetInstances<Author>();
}
```
</TabItem>
<TabItem label="React — the screen" icon="seti:react">
```tsx
// Proxies are generated from the C# above — fully typed, always in sync.
const [authors] = AllAuthors.use();           // typed result, no API client to write

<CommandDialog command={RegisterAuthor} title="Add author">
    <InputTextField value={i => i.name} title="Name" />
</CommandDialog>
```
</TabItem>
</Tabs>

## The platform pieces

<CardGrid>
  <SimpleCard title="Chronicle" icon="seti:db" link="/chronicle/">
    The event sourcing engine — gRPC/protobuf boundary, .NET-first client, storage choice, Orleans runtime, and rich tooling over a durable event log.
  </SimpleCard>
  <SimpleCard title="Arc" icon="puzzle" link="/arc/">
    The full-stack CQRS framework — commands, queries, and the generated proxies that keep React in sync.
  </SimpleCard>
  <SimpleCard title="Components" icon="laptop" link="/components/">
    The React component library — command dialogs, forms, and data tables wired to your proxies.
  </SimpleCard>
  <SimpleCard title="AuthProxy" icon="seti:lock" link="/authproxy/">
    The edge gateway — authentication, tenant resolution, identity enrichment, routing, and invites.
  </SimpleCard>
  <SimpleCard title="CLI" icon="rocket" link="/cli/">
    A terminal window into a running store — inspect events, watch observers, and diagnose issues.
  </SimpleCard>
  <SimpleCard title="AI tooling" icon="approve-check" link="/ai-native-development/">
    Skills, rules, analyzers, CLI catalogs, and MCP support that let agents build and operate with the platform's conventions.
  </SimpleCard>
</CardGrid>

## Choose your starting point

Cratis is modular. For a new information system, the default path is Chronicle + Arc + Components. For an existing system, a bounded CRUD slice, or a frontend/backend contract problem, you can adopt the pieces separately and still keep the same conventions.

| If you need... | Start here |
|---|---|
| A durable history of what happened | [Chronicle](/chronicle/) |
| A language-neutral event-store boundary | [Chronicle architecture](/chronicle/architecture/) |
| MongoDB, PostgreSQL, SQL Server, or SQLite storage | [Chronicle storage](/chronicle/hosting/configuration/storage/) |
| Typed commands, queries, and generated React proxies | [Arc](/arc/) |
| Forms, dialogs, and data tables wired to Arc | [Components](/components/) |
| Authentication, tenant resolution, identity enrichment, and routing | [AuthProxy](/authproxy/) |
| A way to inspect a running store | [CLI](/cli/) |
| AI guidance for building and operating the stack | [AI-native development](/ai-native-development/) |
| A guided adoption path from an existing app | [Adopting Cratis](/adopting-cratis/) |
| A role-based route through the docs | [Learning paths](/learning-paths/) |
| Runtime, package, and storage compatibility | [Version compatibility](/compatibility/) |
| A production deployment checklist | [Production readiness](/production-readiness/) |
| Help choosing a path, debugging setup, or talking through a design | [Community and help](/community/) |
| Dedicated training, architecture review, or implementation help | [Professional help](/professional-help/) |
| A place to suggest improvements or report confusing docs | [Feedback and suggestions](/feedback/) |

Coming from a familiar architecture? Start with the bridge that matches the shape of your code: [CRUD / EF Core](/chronicle/coming-from-crud/), [MediatR, MVC, and Arc](/arc/coming-from-mediatr-and-mvc/), or [PrimeReact and Components](/components/coming-from-primereact/).

## Ready to build?

<CardGrid>
  <LinkCard title="Get started" description="Scaffold a project, run it, and watch one event flow through a projection and a reactor — in minutes." href="/chronicle/get-started/" />
  <LinkCard title="Why developers choose Cratis" description="The platform fit: strong conventions, open Chronicle boundaries, typed contracts, storage choice, and a system you can inspect." href="/why-cratis/" />
  <LinkCard title="Build the library, step by step" description="Learn the model by building a small event-sourced system one concept at a time." href="/chronicle/tutorial/" />
  <LinkCard title="Build a full-stack feature" description="Put Chronicle, Arc, and Components together — backend to React, type-safe throughout." href="/build-a-full-app/" />
  <LinkCard title="Follow a learning path" description="Choose a route for event sourcing, full-stack building, evaluation, operations, frontend work, or contribution." href="/learning-paths/" />
  <LinkCard title="Read the FAQ" description="Quick answers for adoption, production readiness, product boundaries, and support channels." href="/faq/" />
  <LinkCard title="Ask the community" description="Join Discord for questions, design discussion, setup help, and guidance on which GitHub repository owns an issue." href="/community/" />
  <LinkCard title="Share feedback" description="Tell us what is confusing, missing, rough, or worth improving in Cratis and the docs." href="/feedback/" />
</CardGrid>
