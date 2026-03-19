# Translation — Import Members from HR

This tutorial builds the **Member Import** slice of the Library system. It is a **Translation** — a pattern for integrating with external systems without letting their language leak into your domain.

An HR system delivers staff records. The Library does not own those events, does not control their schema, and does not want to be coupled to how the HR system names things. A translator reactor listens for the external events, translates them into the Library's own vocabulary, and fires commands that produce proper domain events.

By the end you will have:

- A `HRMemberCreated` event type representing what the HR system sends
- A `RegisterMember` command — the Library's own domain command
- A `MemberImportReactor` that bridges the two, doing nothing except translate
- A clear understanding of why this boundary matters

---

## What is Translation?

In Event Modeling terms, a **Translation** slice answers the question: *"How do we accept information from outside our boundary without letting that outside world shape our inside world?"*

The two systems have different needs:

| HR System | Library System |
| --------- | -------------- |
| `PersonnelRecord` with 40 fields | `Member` with `FirstName`, `LastName` |
| Employee ID as string `"EMP-00247"` | `MemberId` as a domain concept |
| `status: "ACTIVE"` / `"INACTIVE"` | `MemberRegistered` / `MemberDeactivated` events |
| Events owned by HR | Events owned by the Library |

If the Library stored `HRMemberCreated` events directly, every part of the codebase would need to know HR's schema. When HR adds a field, renames a value, or changes a status code, every Library projection and reactor breaks.

Translation keeps these concerns completely separate:

1. The Translator observes the external event stream
2. It extracts only the data the Library cares about
3. It fires a standard Library command — `RegisterMember` — using that data
4. The Library's own command pipeline validates and records a `MemberRegistered` event

The Library side never sees the HR event. It only ever sees its own, clean, domain events.

---

## Folder Structure

```
Features/
└── Members/
    ├── MemberId.cs                  ← Concept: strongly-typed member identity
    ├── MemberName.cs                ← Concept: strongly-typed member name
    ├── Registration/
    │   └── Registration.cs          ← RegisterMember command + MemberRegistered event
    └── HRIntegration/
        └── HRIntegration.cs         ← External event type + translator reactor
```

The integration concern lives in its own slice folder. If the HR integration is ever replaced with a different HR system, you delete or replace `HRIntegration/` without touching `Registration/`.

---

## Step 1 — The Member Registration Slice

First, the domain side — the Library's own vocabulary. This follows the same State Change pattern from [Register an Author](./state-change.md).

```csharp
// Features/Members/MemberId.cs
using Cratis.Concepts;

namespace Library.Members;

public record MemberId(Guid Value) : ConceptAs<Guid>(Value)
{
    public static MemberId New() => new(Guid.NewGuid());
    public static MemberId From(string value) => new(Guid.Parse(value));
}
```

```csharp
// Features/Members/MemberName.cs
using Cratis.Concepts;

namespace Library.Members;

public record MemberName(string Value) : ConceptAs<string>(Value);
```

```csharp
// Features/Members/Registration/Registration.cs
using Cratis.Arc.Commands.ModelBound;
using Cratis.Chronicle.Constraints;
using Cratis.Chronicle.Events;
using Library.Members;

namespace Library.Members.Registration;

[EventType]
public record MemberRegistered(MemberName FirstName, MemberName LastName);

public class UniqueMemberName : IConstraint
{
    public void Define(IConstraintBuilder builder) => builder
        .Unique(_ => _
            .On<MemberRegistered>(e => $"{e.FirstName} {e.LastName}")
            .WithMessage("A member with that name is already registered"));
}

[Command]
public record RegisterMember(MemberName FirstName, MemberName LastName)
{
    public (MemberId, MemberRegistered) Handle()
    {
        var memberId = MemberId.New();
        return (memberId, new MemberRegistered(FirstName, LastName));
    }
}
```

Notice that `RegisterMember` is a perfectly ordinary Library command. It knows nothing about HR. It can be called from the UI, from an API, or — as in this tutorial — from a reactor.

---

## Step 2 — The Translator Slice

Now the integration side. This is the only place in the codebase that knows anything about the HR system's shape.

```csharp
// Features/Members/HRIntegration/HRIntegration.cs
using Cratis.Arc.Commands;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Reactors;
using Library.Members;
using Library.Members.Registration;

namespace Library.Members.HRIntegration;

// ─── External Event ───────────────────────────────────────────────────────────
// This represents what the HR system sends. We define it here in our codebase
// because Chronicle needs a strongly-typed record to deserialise the event from
// the external event stream. It is NOT a Library domain event — it is just a
// data transfer type that mirrors the HR system's schema.

[EventType]
public record HRMemberCreated(
    string EmployeeId,
    string GivenName,
    string FamilyName,
    string Status);

// ─── Translator Reactor ───────────────────────────────────────────────────────

public class MemberImportReactor(ICommandPipeline commandPipeline) : IReactor
{
    [OnceOnly]
    public async Task HandleHRMemberCreated(
        HRMemberCreated @event,
        EventContext context)
    {
        // Only import active staff as library members
        if (@event.Status != "ACTIVE") return;

        await commandPipeline.Execute(new RegisterMember(
            FirstName: new MemberName(@event.GivenName),
            LastName: new MemberName(@event.FamilyName)));
    }
}
```

### What is happening here?

**`[EventType]`** on `HRMemberCreated` does not make this a Library event. It is just the C# type that Chronicle uses to deserialise the incoming event from the external stream. Chronicle needs strongly-typed events; this is the representation of the HR system's payload in our codebase. A better name for this concept is an *integration event* — it lives at the boundary and has no standing in the domain.

**`[OnceOnly]`** is essential here. This reactor has an external side effect: it calls `RegisterMember`, which appends a `MemberRegistered` event to the Library's own event log. If the event log were ever replayed, you do not want to fire `RegisterMember` again for every HR event that already produced a successful import — that would create duplicate members. `[OnceOnly]` ensures this method runs exactly once per HR event, even across replays.

**Status filtering** shows how the translator makes decisions. The Library does not care about contract staff, secondees, or inactive records — it only wants active personnel. That filter lives here, at the integration boundary. The `RegisterMember` command never needs to know that the Library has an HR integration; it just registers members.

**`ICommandPipeline.Execute`** routes through the full Arc command pipeline — validation, constraints, Chronicle event append — exactly as if a user had clicked a button on a form. The `UniqueMemberName` constraint from `Registration.cs` will fire here too. If the member was already imported (because, for example, the HR system sent the event twice), the constraint will reject the duplicate `RegisterMember` and nothing bad happens.

---

## Step 3 — Comparing to Automation

At a glance, Automation and Translation look similar — both use `IReactor` and both call `ICommandPipeline`. The difference is in *who owns the events*:

| | Automation | Translation |
| --- | --------- | ----------- |
| What triggers it | Library events (`BookReserved`) | External events (`HRMemberCreated`) |
| Who owns the trigger event | The Library | The HR system |
| What the reactor knows | Library read models | External payload structure |
| Output | Library domain events | Library domain events |

Automation reacts to things the Library itself did. Translation reacts to things another system did and maps them into the Library's language.

---

## Step 4 — Wiring the External Event Stream

Chronicle supports multiple event stream namespaces and external integrations. In your host setup, configure Chronicle to receive events from the HR system's stream:

```csharp
// Program.cs or Startup.cs
builder.Services
    .AddChronicle(chronicle => chronicle
        .AddEventTypes<HRMemberCreated>()
        // Additional configuration for external stream connection
    );
```

The exact configuration depends on how the external system publishes events (Kafka, Azure Service Bus, a Chronicle-to-Chronicle bridge, etc.). The key point is that once events flow in from the HR stream and are typed as `HRMemberCreated`, Chronicle delivers them to `MemberImportReactor.HandleHRMemberCreated` automatically.

---

## Summary

| Layer | Artifact | Technology |
| ----- | -------- | ---------- |
| External event (HR mirror) | `HRMemberCreated` | Chronicle `[EventType]` (integration type) |
| Domain command | `RegisterMember` | Arc `[Command]` |
| Domain event | `MemberRegistered` | Chronicle `[EventType]` |
| Translator | `MemberImportReactor` | Chronicle `IReactor` + `[OnceOnly]` |
| Bridge | `ICommandPipeline.Execute(...)` | Arc command pipeline |

The HR system's vocabulary stops at the edge of `HRIntegration/`. Everything inside `Registration/` is pure Library domain, ignorant of HR entirely. Swap the HR system for a different one and you only touch `HRIntegration.cs`.

---

## What You Have Built

Over the four tutorials in this series you have built:

| Tutorial | Pattern | What you built |
| -------- | ------- | -------------- |
| [State Change](./state-change.md) | State Change | Register an author — command, event, validation, constraint, React form |
| [State View](./state-view.md) | State View | List authors — reactive projection, observable query, live data page |
| [Automation](./automation.md) | Automation | Cancel expired reservations — passive read model, DCB command, reactor |
| Translation | Translation | Import members from HR — external event mirror, domain command, translator reactor |

Four patterns. Three building blocks. One coherent framework that covers every layer — Chronicle for the event log, Arc for the application model, Components for the UI. This is how consistent Information Systems are built on the Cratis stack.
