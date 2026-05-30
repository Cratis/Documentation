---
title: Coming from Marten
description: How Marten's event sourcing maps onto Cratis — events, aggregates, projections, and queries side by side, plus migration steps.
---

[Marten](https://martendb.io/) and Cratis both do event sourcing in .NET, so most of what you know carries over. The big shifts: Cratis stores on **MongoDB** (not PostgreSQL), leans on **declarative read models** instead of the aggregate/decider pattern, and continues through to a **type-safe React frontend**.

## Concept map

| Marten | Cratis |
|---|---|
| Event = a plain `record`/class | A `record` marked `[EventType]` |
| `session.Events.StartStream` / `Append` + `SaveChangesAsync()` | `eventStore.EventLog.Append(id, @event)` |
| Aggregate with `Apply()`/`Create()` + `FetchForWriting` (decider pattern) | A `[ReadModel]` built by a **declarative projection**, or a **reducer** for imperative folding |
| `SingleStreamProjection<TDoc, TId>` | A model-bound projection (`[FromEvent<T>]`) or `IProjectionFor<T>` |
| `session.Query<T>()` over a projected document | A query method on the `[ReadModel]` (e.g. `collection.Observe()`) |
| `AddMarten(...)` on PostgreSQL | The Chronicle client / `AddCratisChronicle`, on MongoDB by default |
| Hand-written API + frontend client | Generated, type-safe proxies ([Arc](/arc/) + [Components](/components/)) |

## Side by side

**Define an event**

```csharp
// Marten — a plain record
public record MemberJoined(string Name);

// Cratis — marked as an event type
[EventType]
public record MemberJoined(string Name);
```

**Append**

```csharp
// Marten
session.Events.Append(partyId, new MemberJoined("Frodo"));
await session.SaveChangesAsync();

// Cratis
await eventStore.EventLog.Append(partyId, new MemberJoined("Frodo"));
```

**Build the read side**

```csharp
// Marten — aggregate via the decider pattern (Apply methods on the type)
public class Party
{
    public List<string> Members { get; set; } = [];
    public void Apply(MemberJoined e) => Members.Add(e.Name);
}

// Cratis — declare the read model; the projection maps events onto it (no Apply loop)
[ReadModel]
[FromEvent<MemberJoined>]
public record Party([property: Key] PartyId Id, [ChildrenFrom<MemberJoined>] IEnumerable<string> Members);
```

**Query**

```csharp
// Marten
var party = await session.Events.AggregateStreamAsync<Party>(partyId);

// Cratis — query the read model (here, live/observable)
public static ISubject<Party> ById(IMongoCollection<Party> c, PartyId id) => c.Observe(id);
```

## The mental shift

- **From aggregate-centric to event-and-read-model-centric.** Marten's natural unit is the aggregate you `FetchForWriting`, mutate via the decider, and persist. Cratis pushes you to model *events* well and *declare* the read models you need — often several specialized ones from the same events. When you need a consistency boundary for a decision, Cratis offers the [Dynamic Consistency Boundary](/chronicle/dynamic-consistency-boundary/) rather than always loading a whole aggregate.
- **From "write your projection" to "declare your mapping."** Marten projections are classes you implement; Cratis read models are records with attributes, and AutoMap fills in the obvious parts. Drop to a [reducer](/chronicle/reducers/) only when a projection can't express the logic.
- **From backend-only to full-stack.** This is the part Marten leaves to you: once your command and query exist, Cratis generates the typed client and you render it with Components — no hand-written DTOs or fetch layer.

## Migration steps

1. **Events** — add `[EventType]` to your Marten event records. Largely mechanical.
2. **Appends** — replace `session.Events.Append(...) + SaveChangesAsync()` with `eventStore.EventLog.Append(id, @event)`.
3. **Aggregates → read models** — if your aggregate just folds events into state to read, re-express it as a declarative [`[ReadModel]` + projection](/chronicle/projections/); if it does real imperative folding, use a [reducer](/chronicle/reducers/).
4. **Invariants** — decider-pattern guards on `FetchForWriting` become [constraints](/chronicle/constraints/) or a [DCB](/chronicle/dynamic-consistency-boundary/).
5. **Queries** — `session.Query<T>()` / `AggregateStreamAsync` become queries on the read model.
6. **Frontend** — delete the hand-written client; consume the generated proxies. See [Build a full-stack feature](/build-a-full-app/).

## Feature-by-feature

**Single-stream aggregate (decider + `FetchForWriting`)**

```csharp
// Marten — load the aggregate, decide, append (the decider pattern)
var stream = await session.Events.FetchForWriting<Order>(orderId);
var events = OrderDecider.Handle(command, stream.Aggregate);
stream.AppendMany(events);
await session.SaveChangesAsync();
```

```csharp
// Cratis — the command's Handle() decides and returns the event(s); no aggregate load
[Command]
public record ShipOrder(OrderId Id)
{
    public OrderShipped Handle() => new();
}
```

When the decision needs to see existing state (an invariant), you don't reload a whole aggregate — you scope it with a [Dynamic Consistency Boundary](/chronicle/dynamic-consistency-boundary/) or enforce it with a [constraint](/chronicle/constraints/).

**Multi-stream projection**

Marten's `MultiStreamProjection<TView, TId>` groups events from many streams into one view with `Identity<TEvent>(e => e.GroupId)`:

```csharp
// Marten
public class GroupMembership : MultiStreamProjection<GroupView, Guid>
{
    public GroupMembership() => Identity<MemberJoinedGroup>(e => e.GroupId);
    // Apply(...) methods build the view
}
```

In Chronicle this is a [projection](/chronicle/projections/) whose read model is keyed on that grouping value, with each contributing event mapped in by `[FromEvent<T>]`. Projections join **events** (never read models), so cross-stream views are first-class — `Identity<TEvent>(e => e.GroupId)` becomes "key this read model on `GroupId`, and fold in the events that carry it."

## When to stay on Marten

If you're deeply invested in PostgreSQL, rely on Marten's document-database features, or are committed to the JasperFx "Critter Stack," Marten remains an excellent choice. Cratis is the better fit when you want the full-stack, convention-driven, .NET + React experience as one stack.
