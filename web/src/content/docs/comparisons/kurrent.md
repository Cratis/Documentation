---
title: Coming from Kurrent / EventStoreDB
description: How Kurrent (EventStoreDB) maps onto Cratis Chronicle — typed events, appending, and building read models side by side, plus migration steps.
---

[Kurrent](https://kurrent.io/) (formerly EventStoreDB) and Cratis [Chronicle](/chronicle/) are both event-sourcing databases. The biggest differences: Chronicle is **.NET-first with strongly-typed events** (no manual serialization), it **builds read models for you** with declarative projections (rather than you writing catch-up subscriptions or server-side JavaScript), and it continues through to a **type-safe React frontend**.

## Concept map

| Kurrent / EventStoreDB | Cratis Chronicle |
|---|---|
| Stream (e.g. `book-123`) | An [event source](/chronicle/concepts/event-source/) and its events |
| `EventData` — a type string + JSON bytes you build | A `[EventType]` record; serialization is handled |
| `AppendToStreamAsync(stream, expectedState, eventData)` | `eventStore.EventLog.Append(id, @event)` |
| `ReadStreamAsync(...)` then deserialize + fold yourself | Query a [read model](/chronicle/read-models/) a projection already built |
| Catch-up / persistent **subscriptions** you write | **Observers** — projections, reducers, reactors — run by the kernel |
| Server-side **projections in JavaScript** | Declarative **projections in C#** |
| Multi-language clients (Java, Node, Go, …) | .NET-first SDK (+ generated TypeScript for the UI) |
| Your frontend, your problem | Generated proxies + [Components](/components/) |

## Side by side

**Define and append an event**

```csharp
// Kurrent / EventStoreDB — build EventData (type name + JSON bytes), then append
var evt = new EventData(
    Uuid.NewUuid(),
    "book-added",
    JsonSerializer.SerializeToUtf8Bytes(new BookAdded("The Pragmatic Programmer", "978-0135957059")));

await client.AppendToStreamAsync("book-123", StreamState.Any, new[] { evt });
```

```csharp
// Cratis Chronicle — a typed event; serialization and type identity are handled
[EventType]
public record BookAdded(string Title, string Isbn);

await eventStore.EventLog.Append(bookId, new BookAdded("The Pragmatic Programmer", "978-0135957059"));
```

**Get current state**

```csharp
// Kurrent / EventStoreDB — read the stream, deserialize, fold into state yourself
var read = client.ReadStreamAsync(Direction.Forwards, "book-123", StreamPosition.Start);
await foreach (var resolved in read)
{
    var data = JsonSerializer.Deserialize<BookAdded>(resolved.Event.Data.Span);
    // ...apply to your in-memory/read model by hand...
}
```

```csharp
// Cratis Chronicle — declare the read model once; the projection keeps it current
[ReadModel]
[FromEvent<BookAdded>]
public record Book([property: Key] BookId Id, string Title, string Isbn)
{
    public static ISubject<IEnumerable<Book>> All(IMongoCollection<Book> c) => c.Observe();
}
// ...then just query Book — no manual read/deserialize/fold.
```

## The mental shift

- **From a log you read to read models you declare.** EventStoreDB gives you an excellent append-only log plus subscriptions, and you own the machinery that turns events into queryable state (catch-up subscriptions, or projections written in JavaScript). Chronicle builds that state for you: declare a [projection](/chronicle/projections/) in C# and query the [read model](/chronicle/read-models/) — no subscription loop, no manual deserialize-and-fold.
- **From bytes to types.** You don't construct `EventData`, pick a type string, or serialize by hand; a `[EventType]` record *is* the event, and Chronicle handles identity, schema, and [evolution](/chronicle/concepts/event-type-migrations/).
- **From multi-language protocol to .NET-first + full-stack.** Kurrent's strength is being a language-neutral database with strong operational tooling. Chronicle is .NET-first and carries through to the UI with generated proxies — a different trade.

## Migration steps

1. **Streams → event sources** — your `entity-{id}` stream naming becomes a strongly-typed [event source id](/chronicle/concepts/event-source/).
2. **EventData → `[EventType]` records** — drop the manual `Uuid`/type-string/`SerializeToUtf8Bytes` boilerplate; the record is the event.
3. **Appends** — `AppendToStreamAsync(...)` becomes `eventStore.EventLog.Append(id, @event)`.
4. **Read-model subscriptions → projections** — catch-up/persistent subscriptions that build state become declarative [projections](/chronicle/projections/) (or [reducers](/chronicle/reducers/)).
5. **JavaScript projections → C# projections** — server-side JS projections move into typed C# read models.
6. **Side-effecting subscriptions → reactors** — subscriptions that *do things* become [reactors](/chronicle/reactors/) (idempotent by design).
7. **Frontend** — consume generated proxies instead of a hand-written client. See [Build a full-stack feature](/build-a-full-app/).

## Feature-by-feature

**Subscriptions → observers**

The biggest day-to-day difference: in Kurrent you *write the subscription* (and the fold or side effect); in Chronicle you *declare an observer* and the kernel runs it.

```csharp
// Kurrent / EventStoreDB — you own the subscription loop
await client.SubscribeToStreamAsync("book-123", FromStream.Start,
    async (subscription, resolved, ct) =>
    {
        var data = JsonSerializer.Deserialize<BookReturned>(resolved.Event.Data.Span);
        // ...update a read model, or perform a side effect...
    });
```

```csharp
// Cratis — a reactor for the side effect (kernel-managed, idempotent)
public class WaitlistNotifier(INotifications n) : IReactor
{
    public Task BookReturned(BookReturned @event, EventContext ctx) =>
        n.NotifyNextInLine(ctx.EventSourceId);
}
```

Map your subscriptions by what they do:

- A subscription that **builds state** → a [projection](/chronicle/projections/) (or [reducer](/chronicle/reducers/)).
- A subscription that **does something** → a [reactor](/chronicle/reactors/) — designed to be idempotent, because it may run more than once.
- A **persistent subscription** (competing consumers, checkpoints, retries) → the kernel handles delivery, ordering per event source, and retry for you; you just write the observer.

## When to stay on Kurrent / EventStoreDB

If you need first-class clients across many languages, depend on Kurrent Cloud or its operational/clustering maturity, or have a large existing EventStoreDB investment, it remains a strong choice. Cratis is the better fit when your stack is .NET + React and you want typed events, read models built for you, and a full-stack, convention-driven experience.
