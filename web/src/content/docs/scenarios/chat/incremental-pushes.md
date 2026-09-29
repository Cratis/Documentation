---
title: Real-time chat with incremental pushes
description: Emit the chat history once and then only new messages from a C# backend, keep backend work per message constant, and accumulate the messages in React.
---

The three previous guides all publish the **full message history** on every message. Arc's delta mode reduces that to a `ChangeSet` over the wire, but the backend still copies the growing list into every emission and Arc compares it with the previous one.

This guide changes the model: the backend emits only what is **new** on each push. The first emission is the full history (initial payload); every subsequent emission contains only the newly arrived message. The frontend accumulates them into its own local state.

The result is constant backend work per message once a subscriber has received the history, however long the conversation has been running. It does not make the delta-mode network payload smaller: the previous guides already send only the new message, and this one sends a little more (see [Step 3](#step-3--what-the-frontend-receives)).

The backend is shown in C# only, with System.Reactive's `Observable.Create` building a stream for each subscriber. That keeps the guide short; it is not a limit of the other backends, which have the same building block, such as an RxJS `Observable` built per subscriber in TypeScript and a `Flow` built per subscriber, such as `callbackFlow`, in Kotlin. The [in-memory guide](/scenarios/chat/in-memory/) shows the shared roles for Kotlin, Java and TypeScript, and [how the backends differ](/scenarios/chat/#how-the-backends-differ) summarizes them.

By the end you will have:

- A `ChatRoom` with a plain `Subject`: no history, no accumulated state, only a pub/sub channel
- A `ChatService` that tracks history separately, exposes a `Send()` method, and hands each subscriber the history and the new messages without a gap between them
- A `ForRoom` query that emits history once, then forwards only new messages, through a stream built for each subscriber
- A React component that uses `use()` and a `useEffect` accumulator, **not** `useChangeStream()`

## How this differs from the other guides

| | In-Memory / RabbitMQ | Frontend-Managed State | This guide |
| - | -------------------- | ---------------------- | ---------- |
| Each emission holds | Full history list | Full history list | New message only |
| History lives in | `ChatRoom` | `ChatRoom` | `ChatService` |
| C# relay type | `BehaviorSubject` | `BehaviorSubject` | `Observable.Create`, one stream per subscriber |
| Backend work per message | Grows with history | Grows with history | Constant |
| Delta-mode payload per message | The new message | The new message | The new message plus the previous emission as `removed` |
| Frontend hook | `use()` | `useChangeStream()` | `use()` |
| Component accumulates | No, renders `data` directly | Yes, appends `added` | Yes, appends `data` |

## Folder structure

```text
Chat/
├── ChatRoom.cs           ← ChatRoom (Subject only) + ChatService (history + send)
├── ChatRoomPage.cs       ← ChatMessage read model + SendMessage command
└── ChatRoomPage.tsx      ← React component
```

## Step 1 — ChatRoom and ChatService

`ChatRoom` is now a pure pub/sub channel. It holds no state and tracks no history. A plain `Subject<IEnumerable<ChatMessage>>` emits only when `Deliver()` is called.

History tracking moves to `ChatService`, which also becomes the entry point for sending messages and for subscribing to a room, so that recording a message, delivering it, and handing the history to a new subscriber all happen under one lock.

```csharp
// Chat/ChatRoom.cs
using System.Collections.Concurrent;
using System.Reactive.Subjects;

namespace MyApp.Chat;

/// <summary>
/// A pure pub/sub channel for a single chat room.
/// Holds no history — delivers only the messages passed to <see cref="Deliver"/>.
/// </summary>
public class ChatRoom
{
    readonly Subject<IEnumerable<ChatMessage>> _messages = new();

    /// <summary>
    /// Gets the observable that emits each incoming delivery.
    /// Each emission contains only the message passed to <see cref="Deliver"/> in that call.
    /// </summary>
    public IObservable<IEnumerable<ChatMessage>> Messages => _messages;

    /// <summary>
    /// Delivers a message to all subscribers.
    /// </summary>
    /// <param name="message">The message to deliver.</param>
    internal void Deliver(ChatMessage message) => _messages.OnNext([message]);
}

/// <summary>
/// Singleton that manages chat rooms and owns the per-room message history.
/// </summary>
public class ChatService
{
    readonly ConcurrentDictionary<string, ChatRoom> _rooms = new();
    readonly Dictionary<string, List<ChatMessage>> _history = [];
    readonly object _lock = new();

    /// <summary>
    /// Gets or creates the <see cref="ChatRoom"/> for the given name.
    /// </summary>
    /// <param name="name">The room name.</param>
    /// <returns>The pub/sub channel for the room.</returns>
    public ChatRoom GetChatRoom(string name) =>
        _rooms.GetOrAdd(name, _ => new ChatRoom());

    /// <summary>
    /// Gets a copy of the message history for the given room, oldest first.
    /// </summary>
    /// <param name="name">The room name.</param>
    /// <returns>All messages posted so far.</returns>
    public IEnumerable<ChatMessage> GetHistory(string name)
    {
        lock (_lock)
        {
            return _history.TryGetValue(name, out var messages) ? messages.ToArray() : [];
        }
    }

    /// <summary>
    /// Sends the room's history to an observer, then every message sent after it.
    /// </summary>
    /// <param name="name">The room name.</param>
    /// <param name="observer">The observer that receives the history and the new messages.</param>
    /// <returns>A disposable that ends the observer's subscription to the room.</returns>
    public IDisposable Subscribe(string name, IObserver<IEnumerable<ChatMessage>> observer)
    {
        lock (_lock)
        {
            observer.OnNext(GetHistory(name));
            return GetChatRoom(name).Messages.Subscribe(observer);
        }
    }

    /// <summary>
    /// Records a new message in the history and delivers it to the room's subscribers.
    /// </summary>
    /// <param name="name">The room name.</param>
    /// <param name="user">The display name of the sender.</param>
    /// <param name="message">The message text.</param>
    public void Send(string name, string user, string message)
    {
        var msg = new ChatMessage(ChatMessageId.New(), user, DateTimeOffset.UtcNow, message);
        lock (_lock)
        {
            if (!_history.TryGetValue(name, out var messages))
            {
                messages = [];
                _history[name] = messages;
            }
            messages.Add(msg);
            GetChatRoom(name).Deliver(msg);
        }
    }
}
```

### What is happening here?

**Plain `Subject<IEnumerable<ChatMessage>>`** only delivers values to subscribers that are currently active. Unlike a `BehaviorSubject`, it holds no current value and emits nothing to late subscribers. That is deliberate: history is the responsibility of `ChatService`, not the room. The room exposes the subject as an `IObservable`, so nothing outside `ChatService` can publish a message that skips the history.

**`ChatService.Send()`** records the message in `_history` and delivers it to the room inside the same lock. The lock protects the per-room `List<ChatMessage>` from concurrent appends, and it is held only while a message is appended and handed to each subscriber, which in a chat room is rarely contested. Delivering inside the lock also means each subscriber receives messages one at a time, in the order they were recorded.

**`ChatService.Subscribe()`** takes the same lock, sends the observer a copy of the history, and subscribes it to the room before releasing the lock. A `Send()` therefore happens either before the subscription, so the message is in that subscriber's history, or after it, so the message arrives live. A joining subscriber never misses a message sent while it joins and never receives one twice.

**`ChatService.GetHistory()`** returns a copy made under the lock, not a view of the list. Arc serializes the history after the query has returned, and a later `Send()` appending to the list it enumerates would make that enumeration throw.

Because every delivery runs while the lock is held, a slow observer delays every sender. Arc's own observers start the write asynchronously and return, so keep any other observer of a room equally quick.

## Step 2 — The read model and command

```csharp
// Chat/ChatRoomPage.cs
using System.Reactive.Disposables;
using System.Reactive.Linq;
using System.Reactive.Subjects;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Concepts;

namespace MyApp.Chat;

// ─── Read Model ───────────────────────────────────────────────────────────────

/// <summary>
/// Represents the unique identifier of a chat message.
/// </summary>
/// <param name="Value">The underlying value.</param>
public record ChatMessageId(Guid Value) : ConceptAs<Guid>(Value)
{
    /// <summary>
    /// Creates a new, unique <see cref="ChatMessageId"/>.
    /// </summary>
    /// <returns>A new identifier.</returns>
    public static ChatMessageId New() => new(Guid.NewGuid());
}

/// <summary>
/// Represents a single chat message.
/// </summary>
/// <param name="Id">The unique identifier of the message.</param>
/// <param name="User">The display name of the sender.</param>
/// <param name="SentAt">The UTC time the message was sent.</param>
/// <param name="Message">The message text.</param>
[ReadModel]
public record ChatMessage(ChatMessageId Id, string User, DateTimeOffset SentAt, string Message)
{
    /// <summary>
    /// Observes the message feed for the given room.
    /// The first emission contains the room's complete history.
    /// Each subsequent emission contains only the new message(s) that just arrived.
    /// </summary>
    /// <param name="roomName">The name of the room to observe.</param>
    /// <param name="chatService">The chat service, injected by the framework.</param>
    /// <returns>An observable that emits history once, then individual new messages.</returns>
    public static ISubject<IEnumerable<ChatMessage>> ForRoom(
        string roomName,
        ChatService chatService)
    {
        // Carries anything Arc sends back into the subject, such as OnError
        // when it fails to deliver to this subscriber.
        var relay = new Subject<IEnumerable<ChatMessage>>();

        // Runs once per subscription, when Arc subscribes after this method returns:
        // the subscriber gets the history, then every message sent after it.
        var messages = Observable.Create<IEnumerable<ChatMessage>>(observer =>
            new CompositeDisposable(
                relay.Subscribe(observer),
                chatService.Subscribe(roomName, observer)));

        return Subject.Create<IEnumerable<ChatMessage>>(relay, messages);
    }
}

// ─── Command ──────────────────────────────────────────────────────────────────

/// <summary>
/// Sends a chat message to a room.
/// </summary>
/// <param name="RoomName">The name of the room to post to.</param>
/// <param name="User">The display name of the sender.</param>
/// <param name="Message">The message text.</param>
[Command]
public record SendMessage(string RoomName, string User, string Message)
{
    /// <summary>
    /// Records the message and delivers it to all subscribers.
    /// </summary>
    /// <param name="chatService">The chat service, injected by the framework.</param>
    public void Handle(ChatService chatService) =>
        chatService.Send(RoomName, User, Message);
}
```

### What is happening here?

**`Observable.Create`** builds a separate stream for each subscription, and nothing in it runs when `ForRoom` returns. Arc subscribes to the returned subject *after* the method returns; only then does `chatService.Subscribe` send that subscriber the history and subscribe it to the room, in one step under the `ChatService` lock. The history is therefore always the subscriber's first emission, whatever was sent in the meantime. A relay filled with the history before Arc subscribes would have to replay it, and a message delivered before Arc subscribed could take the history's place in the replay.

**Returning an `ISubject`:** Arc for C# recognizes an observable query by its `ISubject<T>` return type, not by `IObservable<T>`. `Subject.Create` pairs the per-subscriber stream with `relay`, a `Subject` that acts as the observer side. With direct mode (`queryDirectMode` on `<Arc>`), when Arc for C# fails to deliver to a subscriber, it calls `OnError` on the subject the query returned; the relay passes that error to the subscriber's stream, which ends it. The default multiplexed connection reports a failed subscription to the client instead.

**Unsubscribing:** the `CompositeDisposable` returned from `Observable.Create` holds the relay subscription and the room subscription. Arc disposes its subscription when the client unsubscribes or disconnects, which disposes both, so a subscriber that leaves stops receiving the room's messages instead of staying attached to the room for the life of the process.

**Two emissions, two sources:**

| Emission | Source | Content |
| -------- | ------ | ------- |
| First | `chatService.Subscribe` → `observer.OnNext(GetHistory(name))` | A copy of all history so far |
| Subsequent | `chatService.GetChatRoom(roomName).Messages` → the same observer | One new `ChatMessage` per send |

The `Subject` in `ChatRoom` fires once per `Deliver()` call with a single-element collection, and each one reaches Arc as a separate push.

Register `ChatService` as a singleton in your `Program.cs`:

```csharp
builder.Services.AddSingleton<ChatService>();
```

Run `dotnet build` after saving. The proxy generator produces `ForRoom.ts`, `SendMessage.ts`, and `ChatMessage.ts`, identical in shape to the other chat guides.

`ChatMessage` keeps the `Id` from the other guides, so the generated proxies match and the frontend can key messages by `id`.

## Step 3 — What the frontend receives

With the backend emitting incremental payloads, this is what the frontend sees in Arc's delta mode:

| Push | Backend emits | Arc ChangeSet sent | `messagesResult.data` |
| ---- | ------------- | ------------------ | --------------------- |
| 1st: history | `[msg1, msg2, msg3]` | none; full data | `[msg1, msg2, msg3]` |
| 2nd: new message | `[msg4]` | `removed: [msg1, msg2, msg3]`, `added: [msg4]` | `[msg4]` |
| 3rd: new message | `[msg5]` | `removed: [msg4]`, `added: [msg5]` | `[msg5]` |

Arc's ChangeSet computation compares each emission with the previous one, matching items by `Id`. Every item of the previous emission that is missing from the new one is `removed`, and `removed` carries the whole items, not only their ids. So the first message after joining sends the entire history back as `removed` along with the new message, and every later message sends the previous message as `removed` along with the new one. That is more than the other guides send: when the backend publishes the full history, the only difference between two emissions is the new message, so their `ChangeSet` is one item in `added`.

The payload is one message per push only in full transfer mode (`observableQueryTransferMode={ObservableQueryTransferMode.Full}` on `<Arc>`), where Arc sends each emission as it is — here, the new message alone. Choose this backend when the work of copying and comparing a long history on every message matters, or when you use full mode; with delta mode and a small history, the [in-memory](/scenarios/chat/in-memory/) backend is simpler and sends less.

`messagesResult.data` from `use()` accurately reflects what the backend emitted: the history on the first push, and only the new message on every subsequent push.

This is why the frontend must **not** use `useChangeStream()` here. `useChangeStream()` would expose the `removed` side of the ChangeSet, making it appear that history was deleted on every new message. `use()` abstracts that away and gives the component the clean per-emission `data`.

## Step 4 — The React component

```tsx
// Chat/ChatRoomPage.tsx
import { useState, useEffect } from 'react';
import { ForRoom } from './ForRoom';
import { SendMessage } from './SendMessage';
import type { ChatMessage } from './ChatMessage';

export const ChatRoomPage = () => {
    const [roomName, setRoomName] = useState('');
    const [joinedRoom, setJoinedRoom] = useState('');
    const [user, setUser] = useState('');
    const [messageText, setMessageText] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);

    const [messagesResult] = ForRoom
        .when(joinedRoom.length > 0)
        .use({ roomName: joinedRoom });

    const [sendCommand, setSendValues] = SendMessage.use();

    // Each push from the server contains either the full history (first push)
    // or a single new message. Append it to local state in both cases.
    useEffect(() => {
        if (!messagesResult.data?.length) return;
        setMessages(prev => [...prev, ...messagesResult.data!]);
    }, [messagesResult.data]);

    const handleJoin = () => {
        if (!roomName.trim() || !user.trim()) return;
        setMessages([]);
        setJoinedRoom(roomName.trim());
    };

    const handleSend = async () => {
        if (!messageText.trim()) return;
        setSendValues({ roomName: joinedRoom, user, message: messageText });
        await sendCommand.execute();
        setMessageText('');
    };

    if (!joinedRoom) {
        return (
            <div style={{ maxWidth: 400, margin: '80px auto', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <h2>Join a Chat Room</h2>
                <input
                    placeholder="Room name"
                    value={roomName}
                    onChange={e => setRoomName(e.target.value)}
                />
                <input
                    placeholder="Your name"
                    value={user}
                    onChange={e => setUser(e.target.value)}
                />
                <button
                    onClick={handleJoin}
                    disabled={!roomName.trim() || !user.trim()}
                >
                    Join
                </button>
            </div>
        );
    }

    return (
        <div style={{ maxWidth: 600, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2>{joinedRoom}</h2>
            <p style={{ color: '#888', margin: 0 }}>Chatting as <strong>{user}</strong></p>

            <div style={{
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                height: 400,
                overflowY: 'auto',
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
            }}>
                {messages.length === 0 && (
                    <p style={{ color: '#aaa', alignSelf: 'center', marginTop: 'auto', marginBottom: 'auto' }}>
                        No messages yet. Say hello!
                    </p>
                )}
                {messages.map(msg => (
                    <div
                        key={String(msg.id)}
                        style={{
                            background: msg.user === user ? '#e8f4fd' : '#f5f5f5',
                            borderRadius: 8,
                            padding: '8px 12px',
                            alignSelf: msg.user === user ? 'flex-end' : 'flex-start',
                            maxWidth: '75%',
                        }}
                    >
                        <div style={{ fontSize: 12, color: '#888', marginBottom: 2 }}>
                            <strong>{msg.user}</strong>
                            {' · '}
                            {new Date(msg.sentAt).toLocaleTimeString()}
                        </div>
                        <div>{msg.message}</div>
                    </div>
                ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    style={{ flex: 1 }}
                    placeholder="Type a message…"
                    value={messageText}
                    onChange={e => setMessageText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSend(); }}
                />
                <button
                    onClick={handleSend}
                    disabled={!messageText.trim()}
                >
                    Send
                </button>
            </div>
        </div>
    );
};
```

### What is happening here?

**`useEffect` on `messagesResult.data`:** each time the server pushes a new value, `messagesResult.data` is a new array reference, triggering the effect. On the first push it contains the full history; on each subsequent push it contains one new message. Appending via `setMessages(prev => [...prev, ...data])` works correctly in both cases.

**`setMessages([])` on join** clears local state before changing rooms. Without this, the previous room's messages would remain visible for a moment after joining.

**`use()`, not `useChangeStream()`:** as explained in [Step 3](#step-3--what-the-frontend-receives), `useChangeStream()` would expose the Arc-internal ChangeSet where previous messages appear as `removed` on each new push, which is the wrong mental model for this pattern.

## Summary

| Piece | What it does |
| ----- | ------------ |
| `ChatRoom` | Pure pub/sub channel: a `Subject<IEnumerable<ChatMessage>>` exposed as `IObservable`, no state |
| `ChatService` | Owns history per room; `Send()` records and delivers under one lock; `Subscribe()` sends a copy of the history and subscribes under the same lock |
| `ChatMessage.ForRoom()` | `Observable.Create` per subscriber: emits history once, then forwards single-message deliveries; Arc's unsubscribe ends the room subscription |
| `SendMessage.Handle()` | Delegates to `chatService.Send()` |
| Backend work per message | Constant: one `ChatMessage` per emission after the initial history |
| Delta-mode payload per message | The new message plus the previous emission as `removed`; one message in full mode |
| Frontend hook | `use()`: `data` reflects each backend emission directly |
| Component state | Accumulated via `useEffect`; never replaced, only appended |
