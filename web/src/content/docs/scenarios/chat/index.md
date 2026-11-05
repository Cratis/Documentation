---
title: Real-time chat with Arc observable queries
description: Build real-time chat with Arc observable queries, then add RabbitMQ delivery, react to message changes, or send history once with incremental pushes.
---

Build a multi-room chat with Arc's [observable queries](/arc/backend/csharp/queries/): the browser subscribes to a room's messages and receives updates without polling. Start with in-memory history, then choose the next guide for the problem you need to solve: delivery across servers, reacting to individual changes, or avoiding a full-history copy on every send.

Each guide keeps a `ChatMessage` read model, a `ForRoom` query, a `SendMessage` command, and a React component. The first two show backends in C#, Kotlin, Java, and TypeScript; their React code works with each backend. RabbitMQ integration code and the incremental-push backend are shown in C# only.

:::caution[Arc for TypeScript distribution and parity]
Arc for TypeScript is published on npm at 1.0.0 and does not have full parity with Arc on .NET. Its Chronicle integration (`@cratis/arc.chronicle`) remains bounded and experimental.
:::

## The four guides

### [In memory](/scenarios/chat/in-memory/)

Start here to join a room and see messages arrive in another browser. Each room keeps its history in the server process, so there is no database or broker to configure. Restarting the server loses that history.

You will return the room's current history from an observable query and render it with `use()`. The guide explains delta mode: Arc sends the initial history, then a `ChangeSet` describing additions, replacements, and removals. The hook applies those changes for you.

### [With RabbitMQ](/scenarios/chat/rabbitmq/)

Take this path when browsers connect to different server instances. A RabbitMQ fanout exchange delivers messages to each instance's bound queue, and its consumer updates the local room. Each room still holds history in memory, loaded from your storage when the room is first requested.

The query and React component stay the same. You supply the persistence implementation; the sample loads history but does not save new messages or recover messages missed while an instance is disconnected.

### [Frontend-managed state](/scenarios/chat/change-stream/)

Use this when rendering the current list is not enough: you want to scroll for new messages or count unread arrivals. Keep the in-memory backend and switch to `ForRoom.useChangeStream()` to receive `{ added, replaced, removed }`.

The component appends `added` items to local state and uses them to update scrolling and an unread counter. The guide also explains the limits of this append-only approach.

### [Incremental pushes](/scenarios/chat/incremental-pushes/)

Read this when copying the growing history on every send is the work you want to avoid. `ChatService` owns the history, and `ChatRoom` only forwards new messages. Each subscriber receives history once, then one message per delivery; React accumulates those payloads locally.

This changes what each query result means. Arc still compares consecutive results in delta mode, so the first live message can send the previous history as `removed`. The guide explains that trade-off, subscription cleanup, and why its component uses `use()` rather than applying removals to the conversation.

## How the backends differ

Choose the tab for your backend rather than translating the C# code directly. These are the contracts used by the examples.

| | C# | Kotlin | Java | TypeScript |
| - | -- | ------ | ---- | -------------------- |
| Source with a current value | System.Reactive `BehaviorSubject<IEnumerable<ChatMessage>>` | `MutableStateFlow<List<ChatMessage>>` | Arc's `ObservableState<List<ChatMessage>>` | RxJS `BehaviorSubject<ChatMessage[]>` |
| `ForRoom` returns | `ISubject<IEnumerable<ChatMessage>>`, a relay per subscriber | `Flow<List<ChatMessage>>`, the room's source | `Flow.Publisher<List<ChatMessage>>`, the room's source | The room's RxJS subject |
| `ChatService` as a service parameter | Resolved from dependency injection because its type is registered | Marked `@FromServices` | Marked `@FromServices` | Listed as `service(ChatService)` in `@query` |
| One `ChatService` instance | `builder.Services.AddSingleton<ChatService>()` | `@Component` | `@Component` | `@singleton()` |
| Authorization on the query and command | None | `@AllowAnonymous`, because Arc on the JVM requires an authenticated caller by default | `@AllowAnonymous`, for the same reason | None |
| RabbitMQ publisher and consumer | Shown; the consumer is a `BackgroundService` | Use your platform's AMQP client | Use your platform's AMQP client | Use your platform's AMQP client |
| Incremental Pushes backend | Shown, with a System.Reactive `Subject` and `Observable.Create` | Not shown | Not shown | Not shown |

## What all four share

The query exposes a stream of message collections to Arc, independently of storage or broker choice. The frontend must still understand what each collection means: a complete history in the first three guides, but a delivery to append in the fourth.

| | In memory | RabbitMQ | Frontend state | Incremental pushes |
| - | --------- | -------- | -------------- | ------------------ |
| Backend emits | Full history | Full history | Full history | History once, then single messages |
| History lives in | `ChatRoom` | `ChatRoom` | `ChatRoom` | `ChatService` |
| C# relay type | `BehaviorSubject` | `BehaviorSubject` | `BehaviorSubject` | `Observable.Create`, one stream per subscriber |
| History copied on each send | Yes | Yes | Yes | No; copied when a subscriber joins |
| Delta-mode payload per message | New message | New message | New message | New message + previous emission as `removed` |
| React hook | `use()` | `use()` | `useChangeStream()` | `use()` |
| Component accumulates | No | No | Yes, via `added` | Yes, via `data` |
