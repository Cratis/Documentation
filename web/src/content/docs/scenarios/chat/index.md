---
title: Real-time chat
description: Four guides that build a live multi-room chat with Arc's observable queries, from an in-memory backend to RabbitMQ, frontend-managed state, and incremental pushes.
---

These guides build a real-time multi-room chat application using Arc's [observable queries](/arc/backend/csharp/queries/). They share a common shape, a `ChatMessage` read model with a `ForRoom` observable query, a `SendMessage` command, and a React page component, but each one explores a different dimension of the pattern.

The backends are shown in C#, Kotlin, Java, and TypeScript where Arc's APIs differ. Pieces that are plain application code, such as the RabbitMQ consumer, are shown in C#, and the Incremental Pushes backend is shown in C# only, to keep that guide short. The React frontend is the same for every backend.

:::caution[Arc for TypeScript is a source preview]
No Arc for TypeScript package is published to npm, it does not have full parity with Arc on .NET, and its package names and APIs can still change.
:::

## The four guides

### [In memory](/scenarios/chat/in-memory/)

The simplest starting point. Each room holds its message history in an observable source with a current value, inside a single, application-wide `ChatService`. No external dependencies required.

Covers:

- A source with a current value as the backing store for live chat state
- Returning that source from an observable query, and the per-subscriber relay C# uses
- How Arc's **delta mode** works: the first emission delivers the full history; subsequent emissions deliver only the `ChangeSet` of new messages

### [With RabbitMQ](/scenarios/chat/rabbitmq/)

Replaces the in-process state with two external systems: a persistence layer that loads message history on startup, and a RabbitMQ fanout exchange that delivers new messages to every server instance. The observable query and the React component are identical to the in-memory version.

Covers:

- Loading initial history from a persistence layer
- A broker consumer that routes messages to the correct `ChatRoom`
- Publishing from `SendMessage` through a publishing contract rather than writing directly to the room
- Scaling across multiple server instances

### [Frontend-managed state](/scenarios/chat/change-stream/)

The backend is unchanged from the in-memory guide. The React component switches from `ForRoom.use()` to `ForRoom.useChangeStream()` to receive the raw `ChangeSet` (`{ added, replaced, removed }`) and manages its own `useState` accumulator.

Covers:

- When to use `useChangeStream()` instead of `use()`
- Appending `ChangeSet.added` items to local state
- Deriving secondary state from the delta: scroll-to-bottom logic and an unread message counter

### [Incremental pushes](/scenarios/chat/incremental-pushes/)

The backend changes fundamentally. `ChatRoom` becomes a pure pub/sub channel with no history that fires only new messages. `ChatService` owns the history. The `ForRoom` query emits the full history once as the initial payload, then forwards each new message individually, so the backend's work per message stays constant regardless of conversation length. It does not shrink the delta-mode payload; the guide explains what Arc sends.

Covers:

- Separating pub/sub (`ChatRoom`) from history (`ChatService`)
- Why `ReplaySubject(1)` is needed when the first payload is emitted before Arc subscribes
- Why `use()`, not `useChangeStream()`, is correct when the backend sends incremental payloads
- A `useEffect` accumulator that appends both the initial history and each new arrival

## How the backends differ

The pattern is the same in every backend. These are the places where the code differs; the guides explain each one where it first appears.

| | C# | Kotlin | Java | TypeScript (source preview) |
| - | -- | ------ | ---- | --------------------------- |
| Source with a current value | System.Reactive `BehaviorSubject<IEnumerable<ChatMessage>>` | `MutableStateFlow<List<ChatMessage>>` | Arc's `ObservableState<List<ChatMessage>>` | RxJS `BehaviorSubject<ChatMessage[]>` |
| `ForRoom` returns | `ISubject<IEnumerable<ChatMessage>>`, a relay per subscriber | `Flow<List<ChatMessage>>`, the room's source | `Flow.Publisher<List<ChatMessage>>`, the room's source | The room's RxJS subject |
| `ChatService` as a service parameter | Resolved from dependency injection because its type is registered | Marked `@FromServices` | Marked `@FromServices` | Listed as `service(ChatService)` in `@query` |
| One `ChatService` instance | `builder.Services.AddSingleton<ChatService>()` | `@Component` | `@Component` | `@singleton()` |
| Authorization on the query and command | None | `@AllowAnonymous`, because Arc on the JVM requires an authenticated caller by default | `@AllowAnonymous`, for the same reason | None |
| RabbitMQ publisher and consumer | Shown; the consumer is a `BackgroundService` | Use your platform's AMQP client | Use your platform's AMQP client | Use your platform's AMQP client |
| Incremental Pushes backend | Shown, with a System.Reactive `Subject` and `ReplaySubject(1)` | Same building block: `MutableSharedFlow(replay = 1)` | Not shown | Same building block: RxJS `ReplaySubject` |

Choosing C# for the Incremental Pushes backend is a scope choice, not a limit of the other backends.

## What all four share

`ForRoom` returns an observable source of the room's messages. That return type is the contract between the query and Arc. It does not change regardless of how the backend sources or stages its data, and the generated TypeScript proxy is identical across all four guides.

| | In memory | RabbitMQ | Frontend state | Incremental pushes |
| - | --------- | -------- | -------------- | ------------------ |
| Backend emits | Full history | Full history | Full history | History once, then single messages |
| History lives in | `ChatRoom` | `ChatRoom` | `ChatRoom` | `ChatService` |
| C# relay type | `BehaviorSubject` | `BehaviorSubject` | `BehaviorSubject` | `ReplaySubject(1)` |
| Backend work per message | Grows | Grows | Grows | Constant |
| Delta-mode payload per message | New message | New message | New message | New message + previous emission as `removed` |
| React hook | `use()` | `use()` | `useChangeStream()` | `use()` |
| Component accumulates | No | No | Yes, via `added` | Yes, via `data` |
