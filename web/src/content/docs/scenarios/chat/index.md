---
title: Real-Time Chat
description: These guides build a real-time multi-room chat application using Arc's observable queries.
---

# Real-Time Chat

These guides build a real-time multi-room chat application using Arc's [observable queries](/arc/backend/queries/). They share a common shape — a `ChatMessage` read model with a `ForRoom` observable query, a `SendMessage` command, and a React page component — but each one explores a different dimension of the pattern.

---

## The Four Guides

### [In-Memory](./in-memory)

The simplest starting point. Message history is held in a `BehaviorSubject` inside a singleton `ChatService`. No external dependencies required.

Covers:
- `BehaviorSubject` as the backing store for live chat state
- The relay pattern for per-client observable subscriptions
- How Arc's **delta mode** works: the first emission delivers the full history; subsequent emissions deliver only the `ChangeSet` of new messages

### [With RabbitMQ](./rabbitmq)

Replaces the in-process state with two external systems: a persistence layer that loads message history on startup, and a RabbitMQ fanout exchange that delivers new messages to every server instance. The observable query and the React component are identical to the in-memory version.

Covers:
- Loading initial history from a persistence layer
- A `BackgroundService` that consumes from RabbitMQ and routes messages to the correct `ChatRoom`
- Publishing from `SendMessage` rather than writing directly to the room
- Scaling across multiple server instances

### [Frontend-Managed State](./change-stream)

The backend is unchanged from the in-memory guide. The React component switches from `ForRoom.use()` to `ForRoom.useChangeStream()` to receive the raw `ChangeSet` — `{ added, replaced, removed }` — and manages its own `useState` accumulator.

Covers:
- When to use `useChangeStream()` instead of `use()`
- Appending `ChangeSet.added` items to local state
- Deriving secondary state from the delta: scroll-to-bottom logic and an unread message counter

### [Incremental Pushes](./incremental-pushes)

The backend changes fundamentally. `ChatRoom` becomes a pure pub/sub channel with no history — a plain `Subject` that fires only new messages. `ChatService` owns the history. The `ForRoom` query uses a `ReplaySubject(1)` to emit the full history once as the initial payload, then forwards each new message individually. The network payload per message stays constant regardless of conversation length.

Covers:
- Separating pub/sub (`ChatRoom`) from history (`ChatService`)
- Why `ReplaySubject(1)` is needed when the first payload is emitted before Arc subscribes
- Why `use()` — not `useChangeStream()` — is correct when the backend sends incremental payloads
- A `useEffect` accumulator that appends both the initial history and each new arrival

---

## What All Four Share

The `ISubject<IEnumerable<ChatMessage>>` return type on `ForRoom` is the contract between the query method and the Arc framework. It does not change regardless of how the backend sources or stages its data. The generated TypeScript proxy is identical across all four guides.

| | In-Memory | RabbitMQ | Frontend State | Incremental Pushes |
| - | --------- | -------- | -------------- | ------------------ |
| Backend emits | Full history | Full history | Full history | History once, then single messages |
| History lives in | `ChatRoom` | `ChatRoom` | `ChatRoom` | `ChatService` |
| Relay type | `BehaviorSubject` | `BehaviorSubject` | `BehaviorSubject` | `ReplaySubject(1)` |
| Network per message | Grows | Grows | Grows | Constant |
| React hook | `use()` | `use()` | `useChangeStream()` | `use()` |
| Component accumulates | No | No | Yes — via `added` | Yes — via `data` |
