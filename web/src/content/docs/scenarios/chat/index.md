---
title: Real-Time Chat
description: These guides build a real-time multi-room chat application using Arc's observable queries.
---

# Real-Time Chat

These guides build a real-time multi-room chat application using Arc's [observable queries](/arc/backend/csharp/queries/). They share a common shape — a `ChatMessage` read model with a `ForRoom` observable query, a `SendMessage` command, and a React page component — but each one explores a different dimension of the pattern.

The backends are shown in C#, Kotlin, Java and TypeScript where Arc's APIs differ; pieces that are plain application code, such as the RabbitMQ consumer, are shown in C#. The React frontend is the same for every backend.

---

## The Four Guides

### [In-Memory](./in-memory)

The simplest starting point. Each room holds its message history in an observable source with a current value, inside a single, application-wide `ChatService`. No external dependencies required.

Covers:

- A source with a current value as the backing store for live chat state (`BehaviorSubject` in C# and TypeScript, `MutableStateFlow` in Kotlin, `ObservableState` in Java)
- Returning that source from an observable query, and the per-subscriber relay C# uses
- How Arc's **delta mode** works: the first emission delivers the full history; subsequent emissions deliver only the `ChangeSet` of new messages

### [With RabbitMQ](./rabbitmq)

Replaces the in-process state with two external systems: a persistence layer that loads message history on startup, and a RabbitMQ fanout exchange that delivers new messages to every server instance. The observable query and the React component are identical to the in-memory version.

Covers:

- Loading initial history from a persistence layer
- A broker consumer that routes messages to the correct `ChatRoom` (a `BackgroundService` in C#)
- Publishing from `SendMessage` through a publishing contract rather than writing directly to the room
- Scaling across multiple server instances

### [Frontend-Managed State](./change-stream)

The backend is unchanged from the in-memory guide. The React component switches from `ForRoom.use()` to `ForRoom.useChangeStream()` to receive the raw `ChangeSet` — `{ added, replaced, removed }` — and manages its own `useState` accumulator.

Covers:

- When to use `useChangeStream()` instead of `use()`
- Appending `ChangeSet.added` items to local state
- Deriving secondary state from the delta: scroll-to-bottom logic and an unread message counter

### [Incremental Pushes](./incremental-pushes)

The backend changes fundamentally. `ChatRoom` becomes a pure pub/sub channel with no history that fires only new messages. `ChatService` owns the history. The `ForRoom` query emits the full history once as the initial payload, then forwards each new message individually, so the backend's work per message stays constant regardless of conversation length. It does not shrink the delta-mode payload; the guide explains what Arc sends. The backend is shown in C#, with a System.Reactive `Subject` and `ReplaySubject(1)`.

Covers:

- Separating pub/sub (`ChatRoom`) from history (`ChatService`)
- Why `ReplaySubject(1)` is needed when the first payload is emitted before Arc subscribes
- Why `use()` — not `useChangeStream()` — is correct when the backend sends incremental payloads
- A `useEffect` accumulator that appends both the initial history and each new arrival

---

## What All Four Share

`ForRoom` returns an observable source of the room's messages — `ISubject<IEnumerable<ChatMessage>>` in C#, `Flow<List<ChatMessage>>` in Kotlin, `Flow.Publisher<List<ChatMessage>>` in Java, and an RxJS subject in TypeScript. That return type is the contract between the query and Arc. It does not change regardless of how the backend sources or stages its data, and the generated TypeScript proxy is identical across all four guides.

| | In-Memory | RabbitMQ | Frontend State | Incremental Pushes |
| - | --------- | -------- | -------------- | ------------------ |
| Backend emits | Full history | Full history | Full history | History once, then single messages |
| History lives in | `ChatRoom` | `ChatRoom` | `ChatRoom` | `ChatService` |
| C# relay type | `BehaviorSubject` | `BehaviorSubject` | `BehaviorSubject` | `ReplaySubject(1)` |
| Backend work per message | Grows | Grows | Grows | Constant |
| Delta-mode payload per message | New message | New message | New message | New message + previous emission as `removed` |
| React hook | `use()` | `use()` | `useChangeStream()` | `use()` |
| Component accumulates | No | No | Yes — via `added` | Yes — via `data` |
