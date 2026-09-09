---
title: Automation — Cancel Expired Reservations
---

<a id="automation--cancel-expired-reservations"></a>

This tutorial builds the **Cancel Expired Reservations** slice of the Library system. It is an **Automation** — a pattern that runs entirely in the background, with no direct user interaction.

A reserved book should not stay unavailable forever when a member never collects it. A daily clock event prompts a reactor to find overdue reservations and send each through the cancellation command. No user clicks a button; an external scheduler supplies the clock signal.

By the end you will have:

- A queryable to-do list of reservations and their expiry dates
- A passive read model for the cancellation decision
- A `ReservationExpired` event that marks a reservation as no longer valid
- A `CancelExpiredReservation` command that handles the cancellation
- A `ReservationExpiryReactor` that observes events and drives the process

---

## What is Automation?

In Event Modeling terms, an **Automation** slice answers the question: *"What should the system do on its own, without a human initiating it?"*

The shape is:

1. A read model acts as a **to-do list** — it contains items that the system needs to process
2. A **Reactor** watches the event stream
3. When the reactor sees a relevant event, it evaluates the to-do list and fires a **Command** for each item that needs action
4. That command produces another event, which closes the loop

The key insight: Automation uses the same building blocks as State Change and State View. Here, Chronicle supplies event observation and Arc supplies the command pipeline through the optional Arc–Chronicle integration. Time passing is not itself an event: the scheduler must append `DailyTick` for the automation to run.

A daily sweep is appropriate when releasing a reservation on the next sweep is acceptable. If the Library needs cancellation at the exact expiry time, use a more frequent or per-reservation trigger. Observer retries can repeat work, so command execution and any external effects need deliberate retry handling.

---

## Domain Context

The Reservation slice supplies the events that open and close a reservation. Reuse `MemberId` from the [member registration guide](../translator#step-1--the-member-registration-slice); give the reservation and ISBN their own domain types:

```csharp
// Reservations/ReservationId.cs
using Cratis.Chronicle.Events;

namespace Library.Reservations;

public record ReservationId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static readonly ReservationId NotSet = new(Guid.Empty);
    public static ReservationId New() => new(Guid.NewGuid());
    public static implicit operator ReservationId(Guid value) => new(value);
}
```

```csharp
// Reservations/ISBN.cs
using Cratis.Concepts;

namespace Library.Reservations;

public record ISBN(string Value) : ConceptAs<string>(Value)
{
    public static readonly ISBN NotSet = new(string.Empty);
    public static implicit operator ISBN(string value) => new(value);
}
```

The reservation events belong to the same reservation event source, so their own reservation ID comes from event context. `MemberId` identifies a related entity and belongs in the payload.

```csharp
// Reservations/ReservationEvents.cs
using Cratis.Chronicle.Events;
using Library.Members;

namespace Library.Reservations;

/// <summary>Records a book held for a member until the collection deadline.</summary>
[EventType]
public record BookReserved(ISBN Isbn, MemberId MemberId, DateTimeOffset ExpiresAt);

/// <summary>Records that a reservation was canceled without collection.</summary>
[EventType]
public record ReservationCancelled(ISBN Isbn, MemberId MemberId);

/// <summary>Records that the member collected the reserved book.</summary>
[EventType]
public record BookBorrowedFromReservation(ISBN Isbn, MemberId MemberId);
```

A `BookReserved` event starts the clock. If the member collects the book (`BookBorrowedFromReservation`), the reservation is closed. If they do not collect it before `ExpiresAt`, the system should cancel it and release the copy back to inventory.

---

## Folder Structure

```text
Source/
└── Reservations/
    └── ExpiryManagement/
        └── ExpiryManagement.cs   ← Read model + command + event + reactor (ALL backend)
```

There is no `.tsx` file for this slice — Automation has no UI. Everything happens in the background.

---

## Step 1 — The Backend Slice

```csharp
// Reservations/ExpiryManagement/ExpiryManagement.cs
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Projections.ModelBound;
using Cratis.Chronicle.ReadModels;
using Cratis.Chronicle.Reactors;
using MongoDB.Driver;
using Library.Members;
using Library.Reservations;

namespace Library.Reservations.ExpiryManagement;

// ─── Read Model ───────────────────────────────────────────────────────────────

[ReadModel]
[FromEvent<BookReserved>]
[RemovedWith<BookBorrowedFromReservation>]
[RemovedWith<ReservationCancelled>]
[RemovedWith<ReservationExpired>]
public record ReservationDueForExpiry(ReservationId Id, DateTimeOffset ExpiresAt);

[ReadModel]
[Passive]
[FromEvent<BookReserved>]
[RemovedWith<BookBorrowedFromReservation>]
[RemovedWith<ReservationCancelled>]
[RemovedWith<ReservationExpired>]
public record PendingReservation(
    ReservationId Id,
    ISBN Isbn,
    MemberId MemberId,
    DateTimeOffset ExpiresAt);

// ─── Event ────────────────────────────────────────────────────────────────────

/// <summary>Records the expiry of a reservation that was not collected in time.</summary>
[EventType]
public record ReservationExpired(ISBN Isbn, MemberId MemberId);

/// <summary>Records the scheduler's daily opportunity to check overdue reservations.</summary>
[EventType]
public record DailyTick(DateTimeOffset OccurredAt);

// ─── Command ──────────────────────────────────────────────────────────────────

[Command]
public record CancelExpiredReservation(ReservationId ReservationId)
{
    public DateTimeOffset Provide() => DateTimeOffset.UtcNow;

    public ReservationExpired? Handle(PendingReservation? reservation, DateTimeOffset now)
    {
        if (reservation is null || reservation.ExpiresAt > now)
        {
            return null;
        }

        return new ReservationExpired(reservation.Isbn, reservation.MemberId);
    }
}

// ─── Reactor ──────────────────────────────────────────────────────────────────

public class ReservationExpiryReactor(
    IMongoCollection<ReservationDueForExpiry> reservations,
    ICommandPipeline commandPipeline) : IReactor
{
    [OnceOnly]
    public async Task HandleDailyTick(DailyTick @event)
    {
        var expired = await reservations
            .Find(reservation => reservation.ExpiresAt <= @event.OccurredAt)
            .ToListAsync();

        foreach (var reservation in expired)
        {
            var result = await commandPipeline.Execute(
                new CancelExpiredReservation(reservation.Id));
            if (!result.IsSuccess)
            {
                throw new ReservationExpiryFailed(reservation.Id);
            }
        }
    }
}

public class ReservationExpiryFailed(ReservationId reservationId)
    : Exception($"Could not expire reservation '{reservationId}'.");
```

### What is happening here?

**`[Passive]`** on `PendingReservation` is important. This projection exists only to support decisions inside `CancelExpiredReservation.Handle()` — it is not intended to be queried by the frontend. `[Passive]` means [Chronicle](/chronicle/) will not proactively observe and replay the [projection](/chronicle/projections/); it is computed on demand when the command asks for it.

**`ReservationDueForExpiry`** is the active, stored to-do list. The reactor queries this collection, not the passive model. Both projections use `[FromEvent<BookReserved>]` for matching properties and `[RemovedWith<T>]` for every closing event — including `ReservationExpired` itself. This keeps completed reservations off later sweeps.

**`CancelExpiredReservation.Handle`** asks for `PendingReservation?` using the command's `ReservationId`. The Arc–Chronicle integration resolves that projection on demand. `Provide()` supplies the current time, so you can also test the decision directly with a fixed timestamp. A missing, collected, canceled, or already expired reservation produces no new event; a reservation whose deadline has passed produces `ReservationExpired`.

The sweep list can lag behind the event log. That is why it nominates candidates rather than deciding whether they may expire. The command rechecks the reservation instead of trusting the earlier collection query. Read-model injection alone is not a blanket guarantee against a concurrent collection or cancellation; a production lifecycle needs append-time rules or the applicable [consistency controls](/arc/backend/chronicle/commands/transactional-commands/) for competing terminal transitions.

**[`IReactor`](/chronicle/reactors/)** marks an observer whose handlers Chronicle discovers from supported signatures and event parameter types. `HandleDailyTick` runs when Chronicle delivers a `DailyTick`. Configure a scheduler or background service to append that event to the application's event log; the reactor does not create its own timer. If the to-do projection has not caught up at a sweep, a later tick can pick up the remaining reservation.

**[`ICommandPipeline`](/arc/backend/commands/command-pipeline/)** is constructor-injected. Each cancellation goes through Arc's command pipeline. Inspect `IsSuccess`: a failed command returns a result rather than necessarily throwing. The named exception makes a failure visible to Chronicle instead of acknowledging the tick as successfully handled. The reactor has no original HTTP principal; configure a deliberate execution context if these commands require authorization.

---

## Step 2 — Idempotency with `[OnceOnly]`

`[OnceOnly]` on `HandleDailyTick` skips the method during replay. Rebuilding projections should not execute today's cancellation logic for every historical clock tick. The projections still consume the recorded `ReservationExpired` events to rebuild their state.

This is a replay policy, not exactly-once delivery. A failure can cause the handler to run again after earlier commands succeeded. A later command sees the recorded expiry and returns no event, provided the reservation has already reached that terminal state. External effects, such as releasing a copy through another service, need their own stable idempotency key or equivalent duplicate handling.

---

## Step 3 — Error Handling

If `HandleDailyTick` throws, Chronicle's observer failure and recovery policy applies. Earlier successful cancellation commands are not rolled back as a group. Monitor failed partitions and repair or retry the underlying operation rather than swallowing failures.

Design your reactor methods to be safe:

- Treat an already closed reservation as a successful no-op, not an exceptional failure
- Return explicit validation results for actual business rejection and inspect unsuccessful command results in the reactor
- Use `[OnceOnly]` to control replay, and design retries separately
- Test missing reservations, deadlines before/at/after `now`, and all three closing events; then exercise the scheduler, projection catch-up, and retry path together in a hosted test

---

## Summary

| Layer | Artifact | Technology |
| ----- | -------- | ---------- |
| Read model (internal) | Active `ReservationDueForExpiry` and passive `PendingReservation` | [Chronicle](/chronicle/) [projection](/chronicle/projections/) |
| Cancellation event | `ReservationExpired` | [Chronicle](/chronicle/) [`[EventType]`](/chronicle/events/) |
| Cancellation decision | `CancelExpiredReservation` | [Arc](/arc/) [`[Command]`](/arc/backend/commands/model-bound/) + `Handle(ReadModel?)` |
| Automation driver | `ReservationExpiryReactor` | [Chronicle](/chronicle/) [`IReactor`](/chronicle/reactors/) |
| Command execution | `ICommandPipeline.Execute(...)` | [Arc](/arc/) [command pipeline](/arc/backend/commands/command-pipeline/) |

The scheduler supplies the clock; the active projection supplies candidates; the command decides whether to expire each reservation. Every expiry is recorded as an event, so later views and automations can follow the outcome without repeating the deadline logic.

**Next**: [Translation — Import Members from HR](../translator)
