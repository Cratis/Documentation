# Automation — Cancel Expired Reservations

This tutorial builds the **Cancel Expired Reservations** slice of the Library system. It is an **Automation** — a pattern that runs entirely in the background, with no direct user interaction.

A reactor watches the event log and automatically fires a command when a reservation has not been collected within the allowed window. No user clicks a button. No cron job. The system observes and acts.

By the end you will have:

- A `Reservation` read model that tracks pending reservations and their expiry dates
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

The key insight: Automation uses exactly the same building blocks as State Change and State View. There is no special scheduler, no background thread management, no cron expression. The event log drives everything. If Chronicle replays the event log (e.g. after a bug fix), the reactor runs again from where it left off — and only handles each event once.

This is fundamentally different from a job queue. A job queue can lose items, process them twice, or fail silently. Chronicle's reactor guarantee: **at-least-once delivery, with idempotency controls**.

---

## Domain Context

The Reservation slice (not built in this tutorial, but required as a foundation) introduces:

```csharp
[EventType]
public record BookReserved(ISBN Isbn, MemberId MemberId, DateTimeOffset ExpiresAt);

[EventType]
public record ReservationCancelled(ISBN Isbn, MemberId MemberId);

[EventType]
public record BookBorrowedFromReservation(ISBN Isbn, MemberId MemberId);
```

A `BookReserved` event starts the clock. If the member collects the book (`BookBorrowedFromReservation`), the reservation is closed. If they do not collect it before `ExpiresAt`, the system should cancel it and release the copy back to inventory.

---

## Folder Structure

```
Features/
└── Reservations/
    └── ExpiryManagement/
        └── ExpiryManagement.cs   ← Read model + command + event + reactor (ALL backend)
```

There is no `.tsx` file for this slice — Automation has no UI. Everything happens in the background.

---

## Step 1 — The Backend Slice

```csharp
// Features/Reservations/ExpiryManagement/ExpiryManagement.cs
using Cratis.Arc.Commands.ModelBound;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.Events.Projections;
using Cratis.Chronicle.Projections;
using Cratis.Chronicle.Read;
using Cratis.Chronicle.Reactors;
using MongoDB.Driver;
using Cratis.Extensions.MongoDB;
using Library.Reservations;

namespace Library.Reservations.ExpiryManagement;

// ─── Read Model ───────────────────────────────────────────────────────────────

[ReadModel]
[Passive]
public record PendingReservation(
    [Key] ReservationId Id,
    ISBN Isbn,
    MemberId MemberId,
    DateTimeOffset ExpiresAt);

public class PendingReservationProjection : IProjectionFor<PendingReservation>
{
    public void Define(IProjectionBuilderFor<PendingReservation> builder) => builder
        .From<BookReserved>(from => from
            .Set(m => m.Isbn).To(e => e.Isbn)
            .Set(m => m.MemberId).To(e => e.MemberId)
            .Set(m => m.ExpiresAt).To(e => e.ExpiresAt))
        .RemovedWith<BookBorrowedFromReservation>()
        .RemovedWith<ReservationCancelled>();
}

// ─── Event ────────────────────────────────────────────────────────────────────

[EventType]
public record ReservationExpired(ISBN Isbn, MemberId MemberId);

// ─── Command ──────────────────────────────────────────────────────────────────

[Command]
public record CancelExpiredReservation(ReservationId ReservationId)
{
    public ReservationExpired? Handle(PendingReservation? reservation)
    {
        if (reservation is null) return null;
        if (reservation.ExpiresAt > DateTimeOffset.UtcNow) return null;

        return new ReservationExpired(reservation.Isbn, reservation.MemberId);
    }
}

// ─── Reactor ──────────────────────────────────────────────────────────────────

public class ReservationExpiryReactor(
    IMongoCollection<PendingReservation> reservations,
    ICommandPipeline commandPipeline) : IReactor
{
    public async Task HandleBookReserved(
        BookReserved @event,
        EventContext context)
    {
        // A reservation was just created. We cannot cancel it immediately,
        // but we record that we saw this event. A scheduler or a delayed
        // trigger (e.g. Chronicle's scheduled reactors) would call back
        // here at expiry time. For this walkthrough we fire a check
        // eagerly — in production use a time-based trigger or an
        // external scheduling mechanism that fires CancelExpiredReservation
        // at the right moment.

        var reservationId = ReservationId.From(context.EventSourceId);
        await commandPipeline.Execute(new CancelExpiredReservation(reservationId));
    }

    public async Task HandleDailyTick(DailyTick @event)
    {
        // In a real system you might fire a DailyTick event from a
        // background service and sweep all pending reservations here.
        var expired = await reservations
            .Find(r => r.ExpiresAt <= DateTimeOffset.UtcNow)
            .ToListAsync();

        foreach (var reservation in expired)
        {
            await commandPipeline.Execute(
                new CancelExpiredReservation(reservation.Id));
        }
    }
}
```

### What is happening here?

**`[Passive]`** on `PendingReservation` is important. This projection exists only to support decisions inside `CancelExpiredReservation.Handle()` — it is not intended to be queried by the frontend. `[Passive]` means [Chronicle](/docs/Chronicle/) will not proactively observe and replay the [projection](/docs/Chronicle/projections/); it is computed on demand when the command asks for it.

**`PendingReservationProjection`** uses the fluent [`IProjectionFor<T>`](/docs/Chronicle/projections/) interface here instead of attribute convention, because the projection has a `.RemovedWith<T>()` rule: when the book is borrowed or the reservation is already cancelled, the document is removed from the collection. Attribute-based mapping can express `[RemovedWith<T>]` too — the fluent form is shown here to illustrate the alternative.

**`CancelExpiredReservation.Handle(PendingReservation? reservation)`** demonstrates the **[Dynamic Consistency Boundary (DCB)](/docs/Chronicle/dynamic-consistency-boundary/)** pattern. When the [command pipeline](/docs/Arc/backend/commands/command-pipeline/) receives this command, it first resolves the `PendingReservation` for the given `ReservationId` — the `[Passive]` projection is computed from the event log at that moment — and injects it as a parameter into `Handle()`. If the reservation does not exist or has not yet expired, `Handle()` returns `null` (no event). Otherwise it returns `ReservationExpired`.

This is a critical design: the command is the consistency boundary. It reads the current state **at the moment of execution**, decides whether to act, and either produces an event or does nothing. No stale state, no race conditions from separate read/check/write steps.

**[`IReactor`](/docs/Chronicle/reactors/)** is a marker interface. [Chronicle](/docs/Chronicle/) discovers reactor methods by their first parameter type. `HandleBookReserved` is called every time a `BookReserved` event is appended to any event source. `EventContext` provides metadata like the event source ID, the sequence number, and the timestamp.

**[`ICommandPipeline`](/docs/Arc/backend/commands/command-pipeline/)** is constructor-injected. The reactor calls `commandPipeline.Execute(new CancelExpiredReservation(...))` to trigger the cancellation command — going back through the full [Arc](/docs/Arc/) command pipeline, including validation.

---

## Step 2 — Idempotency with `[OnceOnly]`

If you only ever want a reactor method to fire the first time an event is seen (never during replays), annotate it with `[OnceOnly]`:

```csharp
[OnceOnly]
public async Task HandleBookReserved(BookReserved @event, EventContext context)
{
    // Only executes on first processing — skipped during event log replay
}
```

Use `[OnceOnly]` for side effects that must happen exactly once regardless of how many times the event log is replayed — sending a notification, calling an external API, or registering a task in an external scheduler.

For the cancellation check, you do *not* want `[OnceOnly]` — if you replay the log after fixing a bug, you want the check to run again so the read model reflects the correct final state.

---

## Step 3 — Error Handling

Chronicle guarantees delivery. If `HandleBookReserved` throws an unhandled exception, Chronicle pauses processing for that event source partition and retries. The partition will remain paused until the error is resolved.

Design your reactor methods to be safe:

- Catch exceptions from external dependencies and handle them gracefully
- Let business rule violations (e.g. reservation already cancelled) produce a `null` return from `Handle()`, not an exception
- Use `[OnceOnly]` when idempotency is not naturally guaranteed by read model state

---

## Summary

| Layer | Artifact | Technology |
| ----- | -------- | ---------- |
| Read model (internal) | `PendingReservation` with `[Passive]` | [Chronicle](/docs/Chronicle/) [projection](/docs/Chronicle/projections/) |
| Cancellation event | `ReservationExpired` | [Chronicle](/docs/Chronicle/) [`[EventType]`](/docs/Chronicle/events/) |
| Command + DCB rule | `CancelExpiredReservation` | [Arc](/docs/Arc/) [`[Command]`](/docs/Arc/backend/commands/model-bound/) + `Handle(ReadModel?)` |
| Automation driver | `ReservationExpiryReactor` | [Chronicle](/docs/Chronicle/) [`IReactor`](/docs/Chronicle/reactors/) |
| Command execution | `ICommandPipeline.Execute(...)` | [Arc](/docs/Arc/) [command pipeline](/docs/Arc/backend/commands/command-pipeline/) |

No scheduled tasks. No database polling. No message queue workers. The event log is the engine; the reactor is the wiring. Every cancellation is an event — auditable, replayable, and traceable.

**Next**: [Translation — Import Members from HR](./translator.md)
