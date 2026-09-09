---
title: Translation — Import Members from HR
---

<a id="translation--import-members-from-hr"></a>

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

If Library projections consumed HR payloads directly, they would depend on HR's schema and status codes. A rename or a change in meaning would spread through the Library code. Keep the integration event at the boundary and translate it once, so the rest of the application depends on Library facts.

Translation keeps these concerns completely separate:

1. The Translator observes the external event stream
2. It extracts only the data the Library cares about
3. It fires a standard Library command — `RegisterMember` — using that data
4. The Library's own command pipeline validates and records a `MemberRegistered` event

Library domain projections consume `MemberRegistered`, not `HRMemberCreated`. The integration event can still be stored in Chronicle for the translator to observe; storing it does not make it part of the Library's domain vocabulary.

---

## Folder Structure

```text
Source/
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

First, the domain side — the Library's own vocabulary. This follows the same State Change pattern from [Register an Author](../state-change).

```csharp
// Members/MemberId.cs
using Cratis.Chronicle.Events;

namespace Library.Members;

public record MemberId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static readonly MemberId NotSet = new(Guid.Empty);
    public static MemberId New() => new(Guid.NewGuid());
    public static implicit operator MemberId(Guid value) => new(value);
}
```

```csharp
// Members/MemberName.cs
using Cratis.Arc.Validation;
using Cratis.Concepts;
using FluentValidation;

namespace Library.Members;

public record MemberName(string Value) : ConceptAs<string>(Value)
{
    public static readonly MemberName NotSet = new(string.Empty);
    public static implicit operator MemberName(string value) => new(value);
}

public class MemberNameValidator : ConceptValidator<MemberName>
{
    public MemberNameValidator() => RuleFor(name => name.Value).NotEmpty();
}
```

```csharp
// Members/Registration/Registration.cs
using Cratis.Arc.Commands.ModelBound;
using Cratis.Chronicle.Events.Constraints;
using Cratis.Chronicle.Events;
using Library.Members;

namespace Library.Members.Registration;

/// <summary>Records a member's registration in the Library.</summary>
[EventType]
public record MemberRegistered(MemberName FirstName, MemberName LastName);

public class UniqueMemberName : IConstraint
{
    public void Define(IConstraintBuilder builder) => builder
        .Unique(_ => _
            .On<MemberRegistered>(e => e.FirstName, e => e.LastName)
            .WithMessage("A member with that name is already registered"));
}

[Command]
public record RegisterMember(MemberName FirstName, MemberName LastName)
{
    public MemberId Provide() => MemberId.New();

    public (MemberId, MemberRegistered) Handle(MemberId memberId) =>
        (memberId, new MemberRegistered(FirstName, LastName));
}
```

`RegisterMember` knows nothing about HR. It can be called from the UI, from an API, or — as here — from a reactor. `MemberNameValidator` applies the same nonempty-name invariant to each entry point.

`MemberId` derives from `EventSourceId<Guid>`, so the optional Arc–Chronicle integration uses the returned identity both for the append and for the command response. An ordinary `ConceptAs<Guid>` response would not select the event source. `Provide()` creates the ID and `Handle()` constructs the fact.

The tutorial retains the Library's exact first-name/last-name uniqueness rule. That rule is checked at append time, after `Handle()`. It is a registration policy, **not an HR deduplication key**: two different employees can share a name.

---

## Step 2 — The Translator Slice

Now the integration side. This is the only place in the codebase that knows anything about the HR system's shape.

```csharp
// Members/HRIntegration/HRIntegration.cs
using Cratis.Arc.Commands;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Reactors;
using Library.Members;
using Library.Members.Registration;

namespace Library.Members.HRIntegration;

// ─── External Event ───────────────────────────────────────────────────────────
// The inbound adapter records this integration event in Chronicle.
// Its string fields mirror the HR payload, not Library domain concepts.

/// <summary>Records the staff-creation payload received from HR.</summary>
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
    public async Task HandleHRMemberCreated(HRMemberCreated @event)
    {
        // Only import active staff as library members
        if (@event.Status != "ACTIVE")
        {
            return;
        }

        var result = await commandPipeline.Execute(new RegisterMember(
            FirstName: new MemberName(@event.GivenName),
            LastName: new MemberName(@event.FamilyName)));
        if (!result.IsSuccess)
        {
            throw new MemberImportFailed();
        }
    }
}

public class MemberImportFailed() : Exception("Library member registration failed.");
```

### What is happening here?

**[`[EventType]`](/chronicle/events/)** identifies the integration event recorded by your inbound adapter. It does not connect Chronicle to HR by itself. The reactor runs after that adapter has received, validated, and appended the payload to the configured event log.

**`[OnceOnly]`** skips the handler during replay. Rebuilding Library views should consume existing `MemberRegistered` facts, not issue fresh registrations from historical HR events. It does **not** prevent retries after failure or deduplicate separate incoming messages.

**Status filtering** shows how the translator makes decisions. This import accepts only records whose status is `"ACTIVE"`; it makes no further distinction between employment categories. That filter lives here, at the integration boundary. The `RegisterMember` command never needs to know that the Library has an HR integration; it just registers members.

**[`ICommandPipeline.Execute`](/arc/backend/commands/command-pipeline/)** runs the Library command's validation and Chronicle append, including `UniqueMemberName`. An unsuccessful result throws the named `MemberImportFailed` exception so Chronicle records an observer failure instead of acknowledging an import that did not happen. These background calls do not inherit a user's HTTP principal; configure an execution context if registration requires authorization.

A repeated name causes a visible rejection, not a successful deduplication. If registration succeeds but the reactor fails before acknowledging the HR event, retrying can encounter that rejection. A production import needs a durable mapping from HR's employee identity to `MemberId`, and a policy for repeated messages and name conflicts. `EmployeeId` is available at this boundary for that work; do not parse values such as `"EMP-00247"` as GUIDs or substitute name equality for employee identity.

---

## Step 3 — Comparing to Automation

At a glance, Automation and Translation look similar — both use `IReactor` and both call `ICommandPipeline`. The difference is in *who owns the events*:

| | Automation | Translation |
| --- | --------- | ----------- |
| What triggers it | A clock signal (`DailyTick`) checking Library reservations | An imported HR payload (`HRMemberCreated`) |
| Who owns the trigger event | The Library's scheduler contract | The adapter mirrors HR's contract |
| What the reactor knows | Library read models | External payload structure |
| Output | Library domain events | Library domain events |

Automation carries out Library work that is due. Translation reacts to information from another system and maps it into the Library's language. Both examples use Arc's optional Chronicle integration; neither changes how standalone Arc commands work.

---

## Step 4 — Wiring the External Event Stream

The transport adapter and translator have separate jobs. The adapter receives HR messages; Chronicle delivers the recorded integration event to `MemberImportReactor`.

Wire the boundary in this order:

1. Configure Arc's [Chronicle integration](/arc/backend/chronicle/) and include the integration event and reactor assemblies in application discovery.
2. Implement the inbound adapter for HR's actual transport — for example, an authenticated webhook or a broker consumer. Validate the sender and payload before accepting it.
3. Use the configured Chronicle [event log](/chronicle/events/) to append `HRMemberCreated` under a stable integration-event source identity. Check the append result before acknowledging the upstream message.
4. Keep transport message deduplication and the employee-to-member mapping durable. Test redelivery and a failure after registration succeeds, not just the first successful message.

A Chronicle namespace isolates event-store data; it is not a Kafka or Service Bus connection. The concrete adapter depends on HR's delivery contract, so it belongs in the host integration rather than in `RegisterMember`.

To check the translator itself, substitute `ICommandPipeline` in a direct handler spec: inactive staff should issue no command; active staff should pass `GivenName` and `FamilyName` as `MemberName` values; an unsuccessful command should fail the handler. Then run a hosted test through the real adapter and observer to verify ingestion, discovery, authorization, and recovery together.

---

## Summary

| Layer | Artifact | Technology |
| ----- | -------- | ---------- |
| External event (HR mirror) | `HRMemberCreated` | [Chronicle](/chronicle/) [`[EventType]`](/chronicle/events/) (integration type) |
| Domain command | `RegisterMember` | [Arc](/arc/) [`[Command]`](/arc/backend/commands/model-bound/) |
| Domain event | `MemberRegistered` | [Chronicle](/chronicle/) [`[EventType]`](/chronicle/events/) |
| Translator | `MemberImportReactor` | [Chronicle](/chronicle/) [`IReactor`](/chronicle/reactors/) + `[OnceOnly]` |
| Bridge | `ICommandPipeline.Execute(...)` | [Arc](/arc/) [command pipeline](/arc/backend/commands/command-pipeline/) |

The HR system's vocabulary stops at the edge of `HRIntegration/`. Everything inside `Registration/` is pure Library domain, ignorant of HR entirely. Swap the HR system for a different one and you only touch `HRIntegration.cs`.

---

## What You Have Built

Over the four tutorials in this series you have built:

| Tutorial | Pattern | What you built |
| -------- | ------- | -------------- |
| [State Change](../state-change) | State Change | Register an author — command, event, validation, constraint, React form |
| [State View](../state-view) | State View | List authors — reactive projection, observable query, live data page |
| [Automation](../automation) | Automation | Cancel expired reservations — active to-do list, passive decision model, command, reactor |
| Translation | Translation | Import members from HR — external event mirror, domain command, translator reactor |

Four patterns. Three building blocks. One coherent framework that covers every layer — [Chronicle](/chronicle/) for the event log, [Arc](/arc/) for the application model, [Components](/components/) for the UI. Together, they keep user intent, query needs, background work, and external vocabulary in focused slices.
