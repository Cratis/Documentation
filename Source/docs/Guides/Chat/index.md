# Real-Time Chat

These guides build a real-time multi-room chat application using Arc's [observable queries](/docs/Arc/backend/queries/). They share a common shape — a `ChatMessage` read model with a `ForRoom` observable query, a `SendMessage` command, and a React page component — but each one explores a different dimension of the pattern.

---

## The Three Guides

### [In-Memory](./in-memory.md)

The simplest starting point. Message history is held in a `BehaviorSubject` inside a singleton `ChatService`. No external dependencies required.

Covers:
- `BehaviorSubject` as the backing store for live chat state
- The relay pattern for per-client observable subscriptions
- How Arc's **delta mode** works: the first emission delivers the full history; subsequent emissions deliver only the `ChangeSet` of new messages

### [With RabbitMQ](./rabbitmq.md)

Replaces the in-process state with two external systems: a persistence layer that loads message history on startup, and a RabbitMQ fanout exchange that delivers new messages to every server instance. The observable query and the React component are identical to the in-memory version.

Covers:
- Loading initial history from a persistence layer
- A `BackgroundService` that consumes from RabbitMQ and routes messages to the correct `ChatRoom`
- Publishing from `SendMessage` rather than writing directly to the room
- Scaling across multiple server instances

### [Frontend-Managed State](./change-stream.md)

The backend is unchanged from the in-memory guide. The React component switches from `ForRoom.use()` to `ForRoom.useChangeStream()` to receive the raw `ChangeSet` — `{ added, replaced, removed }` — and manages its own `useState` accumulator.

Covers:
- When to use `useChangeStream()` instead of `use()`
- Appending `ChangeSet.added` items to local state
- Deriving secondary state from the delta: scroll-to-bottom logic and an unread message counter

---

## What All Three Share

The `ISubject<IEnumerable<ChatMessage>>` return type on `ForRoom` is the contract between the query method and the Arc framework. It does not change regardless of whether the data comes from an in-memory service, a RabbitMQ consumer, or any other source. The generated TypeScript proxy and the React component are identical across all three backends.

| | In-Memory | RabbitMQ | Frontend State |
| - | --------- | -------- | -------------- |
| Backend data source | `BehaviorSubject` | RabbitMQ + persistence | Same as in-memory |
| Observable query | Identical | Identical | Identical |
| Generated proxy | Identical | Identical | Identical |
| React hook | `use()` | `use()` | `useChangeStream()` |
| Component manages local state | No | No | Yes |
