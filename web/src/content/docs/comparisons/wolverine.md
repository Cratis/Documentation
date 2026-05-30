---
title: Coming from Wolverine
description: How Wolverine's command handling maps onto Cratis Arc — handlers, invocation, and cascading messages side by side, plus what Arc does and doesn't replace.
---

[Wolverine](https://wolverinefx.net/) is a command-execution and messaging framework; Cratis [Arc](/arc/) is the command/query layer of a full-stack app framework. They overlap on the **mediator/command-handling** part — and that's where the mapping is clean. Arc is *not* a general-purpose message bus, so the messaging side of Wolverine has no direct Cratis equivalent (more below).

## Concept map

| Wolverine | Cratis Arc |
|---|---|
| Handler method `Handle(TCommand)` discovered by convention | A `[Command]` record with `Handle()` **on the record** |
| `IMessageBus.InvokeAsync(command)` + `app.MapPost(...)` | Automatic HTTP mapping — no endpoint wiring |
| Cascading messages (return a message → auto-published) | Return **events**; [reactors](/chronicle/reactors/) react and can trigger further commands |
| `UseWolverine()` | The Cratis Arc registration |
| You write the frontend client | Generated, type-safe proxies + [Components](/components/) |
| Full messaging: transports, sagas, durability/outbox | Out of scope — Arc is the app's command/query surface, not a bus |

## Side by side

**A command and its handler**

```csharp
// Wolverine — a record + a handler method (often a separate class)
public record CreateIssue(string Title);

public static class CreateIssueHandler
{
    public static IssueCreated Handle(CreateIssue command) => new(command.Title);
}
```

```csharp
// Cratis Arc — Handle() lives on the command record; no separate handler
[Command]
public record CreateIssue(IssueId Id, string Title)
{
    public IssueCreated Handle() => new(Title);
}

[EventType]
public record IssueCreated(string Title);
```

**Exposing it over HTTP**

```csharp
// Wolverine — map the endpoint and invoke through the bus
app.MapPost("/issues/create", (CreateIssue body, IMessageBus bus) => bus.InvokeAsync(body));

// Cratis Arc — nothing to map; the command is exposed automatically,
// and a typed proxy is generated for the frontend.
```

**Follow-up work after the command**

```csharp
// Wolverine — return a cascading message; Wolverine publishes it
public static (IssueCreated, NotifyWatchers) Handle(CreateIssue command) => (...);

// Cratis — the command returns the event; a reactor reacts to it
public class WatcherNotifier(INotifications n) : IReactor
{
    public Task IssueCreated(IssueCreated @event, EventContext ctx) => n.NotifyWatchers(ctx.EventSourceId);
}
```

## The mental shift

- **From handler-method discovery to command-with-`Handle()`.** Wolverine finds `Handle` methods anywhere and routes messages to them through `IMessageBus`. Arc puts `Handle()` on the command record itself and maps it to HTTP for you, so there's no bus call or endpoint to write — and the frontend gets a generated client.
- **From cascading messages to events + reactors.** Wolverine's "return a message and it gets published" becomes "the command appends an event, and a [reactor](/chronicle/reactors/) reacts" — which also gives you the full event-sourced history for free.
- **Arc is not a message bus.** Wolverine is also a serious async messaging framework — transports (RabbitMQ, Azure Service Bus, Kafka, …), sagas, durable outbox. Cratis doesn't replace that. If you need cross-service messaging, keep using a transport (or Wolverine) for that concern; use Arc for the application's own commands and queries.

## Migration steps

1. **Commands** — turn Wolverine command records into `[Command]` records and move the handler body into `Handle()` on the record (inject collaborators as `Handle` parameters).
2. **Endpoints** — delete `MapPost(...) + InvokeAsync(...)`; Arc exposes commands automatically.
3. **State changes** — have `Handle()` return the event(s); model the read side as a [projection](/chronicle/projections/).
4. **Cascading messages** — re-express as [reactors](/chronicle/reactors/) (and, for new events, trigger a command via the command pipeline).
5. **Frontend** — consume the generated proxies instead of a hand-written client.
6. **Cross-service messaging** — leave on your existing transport; it's a separate concern.

## When to keep Wolverine

For genuine asynchronous messaging across services and transports — with sagas, scheduling, and durable delivery — Wolverine is purpose-built and Cratis doesn't aim to replace it. The two can coexist: Arc for the app's command/query surface, a transport for integration. If you're using Wolverine purely as an in-process mediator for a single app, Arc covers that and adds the full-stack, event-sourced story.
