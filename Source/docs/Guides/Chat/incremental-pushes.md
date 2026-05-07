# Real-Time Chat — Incremental Pushes

The three previous guides all emit the **full message history** on every `OnNext()` call. Arc's delta mode compresses this down to a `ChangeSet` over the wire, but the backend still accumulates and sends a growing list.

This guide flips the model. The backend emits only what is **new** on each push. The first emission is the full history (initial payload); every subsequent emission contains only the messages that just arrived. The frontend accumulates them into its own local state.

The result is a constant-size network payload per message regardless of how long the conversation has been running.

By the end you will have:

- A `ChatRoom` with a plain `Subject` — no history, no accumulated state, just a pub/sub channel
- A `ChatService` that tracks history separately and exposes a `Send()` method
- A `ForRoom` query that emits history once, then forwards only new messages via a `ReplaySubject`
- A React component that uses `use()` and a `useEffect` accumulator — **not** `useChangeStream()`

---

## How This Differs from the Other Guides

| | In-Memory / RabbitMQ | Frontend-Managed State | This guide |
| - | -------------------- | ---------------------- | ---------- |
| Each `OnNext()` emits | Full history list | Full history list | New message(s) only |
| History lives in | `ChatRoom` (`BehaviorSubject`) | `ChatRoom` (`BehaviorSubject`) | `ChatService` |
| Relay type | `BehaviorSubject` | `BehaviorSubject` | `ReplaySubject(1)` |
| Network per message | Grows with history | Grows with history | Constant |
| Frontend hook | `use()` | `useChangeStream()` | `use()` |
| Component accumulates | No — renders `data` directly | Yes — appends `added` | Yes — appends `data` |

---

## Folder Structure

```
Features/
└── Chat/
    ├── ChatRoom.cs           ← ChatRoom (Subject only) + ChatService (history + send)
    ├── ChatRoomPage.cs       ← ChatMessage [ReadModel] + SendMessage [Command]
    └── ChatRoomPage.tsx      ← React component
```

---

## Step 1 — ChatRoom and ChatService

`ChatRoom` is now a pure pub/sub channel. It holds no state and tracks no history. A plain `Subject<IEnumerable<ChatMessage>>` emits only when `Deliver()` is called.

History tracking moves to `ChatService`, which also becomes the entry point for sending messages so that it can record each message before firing the room's subject.

```csharp
// Features/Chat/ChatRoom.cs
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
    /// Gets the subject that emits each incoming delivery.
    /// Each emission contains only the messages passed to <see cref="Deliver"/> in that call.
    /// </summary>
    public ISubject<IEnumerable<ChatMessage>> Messages => _messages;

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
    readonly ConcurrentDictionary<string, List<ChatMessage>> _history = new();
    readonly object _lock = new();

    /// <summary>
    /// Gets or creates the <see cref="ChatRoom"/> for the given name.
    /// </summary>
    /// <param name="name">The room name.</param>
    /// <returns>The pub/sub channel for the room.</returns>
    public ChatRoom GetChatRoom(string name) =>
        _rooms.GetOrAdd(name, _ => new ChatRoom());

    /// <summary>
    /// Gets the full message history for the given room, oldest first.
    /// </summary>
    /// <param name="name">The room name.</param>
    /// <returns>All messages posted so far.</returns>
    public IEnumerable<ChatMessage> GetHistory(string name) =>
        _history.TryGetValue(name, out var msgs) ? msgs.AsReadOnly() : [];

    /// <summary>
    /// Records a new message in the history and delivers it to the room's subscribers.
    /// </summary>
    /// <param name="name">The room name.</param>
    /// <param name="user">The display name of the sender.</param>
    /// <param name="message">The message text.</param>
    public void Send(string name, string user, string message)
    {
        var msg = new ChatMessage(user, DateTimeOffset.UtcNow, message);
        lock (_lock)
        {
            _history.GetOrAdd(name, _ => new List<ChatMessage>()).Add(msg);
        }
        GetChatRoom(name).Deliver(msg);
    }
}
```

### What is happening here?

**Plain `Subject<IEnumerable<ChatMessage>>`** only delivers values to subscribers that are currently active. Unlike a `BehaviorSubject`, it holds no current value and emits nothing to late subscribers. This is deliberate — history is the responsibility of `ChatService`, not the room.

**`ChatService.Send()`** records the message in `_history` under a lock before delivering it to the room. The lock protects the per-room `List<ChatMessage>` from concurrent appends while remaining uncontested in typical usage. The message is added to history before the pub/sub delivery so that any concurrent `GetHistory()` call (e.g. a second client joining the room at the same moment) sees the new message in the initial payload.

---

## Step 2 — The Read Model and Command

```csharp
// Features/Chat/ChatRoomPage.cs
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Queries.ModelBound;
using System.Reactive.Subjects;

namespace MyApp.Chat;

// ─── Read Model ───────────────────────────────────────────────────────────────

/// <summary>
/// Represents a single chat message.
/// </summary>
/// <param name="User">The display name of the sender.</param>
/// <param name="SentAt">The UTC time the message was sent.</param>
/// <param name="Message">The message text.</param>
[ReadModel]
public record ChatMessage(string User, DateTimeOffset SentAt, string Message)
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
        // ReplaySubject(1) stores the last emitted value and replays it to
        // any new subscriber — including Arc's subscription which occurs after
        // this method returns.
        var relay = new ReplaySubject<IEnumerable<ChatMessage>>(1);

        // First payload: the full history.
        relay.OnNext(chatService.GetHistory(roomName));

        // Subsequent payloads: whatever ChatRoom.Deliver() fires — one message at a time.
        chatService.GetChatRoom(roomName).Messages.Subscribe(relay);

        return relay;
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

**`ReplaySubject<IEnumerable<ChatMessage>>(1)`** is the right relay here for a specific reason. The method calls `OnNext(history)` and then subscribes to the room — but Arc subscribes to the returned relay *after* the method returns. A plain `Subject` would have already fired and lost the history emission by the time Arc subscribes. `ReplaySubject(1)` stores the last emitted value and replays it to each new subscriber immediately upon subscription, so Arc always receives the history as its first message.

**Two emissions, two sources:**

| Emission | Source | Content |
| -------- | ------ | ------- |
| First | `relay.OnNext(chatService.GetHistory(roomName))` | All persisted history |
| Subsequent | `chatService.GetChatRoom(roomName).Messages` → relay | One new `ChatMessage` per send |

The `Subject` in `ChatRoom` fires once per `Deliver()` call with a single-element collection. The relay forwards each of these to Arc as a separate push.

> **Register `ChatService` as a singleton** in your `Program.cs`:
>
> ```csharp
> builder.Services.AddSingleton<ChatService>();
> ```
>
> **Run `dotnet build`** after saving. The proxy generator produces `ForRoom.ts`, `SendMessage.ts`, and `ChatMessage.ts` — identical in shape to the other chat guides.

---

## Step 3 — What the Frontend Receives

With the backend emitting incremental payloads, this is what the frontend sees in Arc's delta mode:

| Push | Backend emits | Arc ChangeSet sent | `messagesResult.data` |
| ---- | ------------- | ------------------ | --------------------- |
| 1st — history | `[msg1, msg2, msg3]` | `added: [msg1, msg2, msg3]` | `[msg1, msg2, msg3]` |
| 2nd — new msg | `[msg4]` | `removed: [msg1,msg2,msg3]`, `added: [msg4]` | `[msg4]` |
| 3rd — new msg | `[msg5]` | `removed: [msg4]`, `added: [msg5]` | `[msg5]` |

Arc's ChangeSet computation compares successive emissions — it sees the previous full history disappear and a single new message appear. This looks odd internally, but `messagesResult.data` from `use()` accurately reflects what the backend emitted: the history on the first push, and only the new message on every subsequent push.

This is why the frontend must **not** use `useChangeStream()` here. `useChangeStream()` would expose the `removed` side of the ChangeSet, making it appear that history was deleted on every new message. `use()` abstracts that away and gives the component the clean per-emission `data`.

---

## Step 4 — The React Component

```tsx
// Features/Chat/ChatRoomPage.tsx
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
                {messages.map((msg, index) => (
                    <div
                        key={index}
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

**`useEffect` on `messagesResult.data`** — each time the server pushes a new value, `messagesResult.data` is a new array reference, triggering the effect. On the first push it contains the full history; on each subsequent push it contains one new message. Appending via `setMessages(prev => [...prev, ...data])` works correctly in both cases.

**`setMessages([])` on join** — clears local state before changing rooms. Without this, the previous room's messages would remain visible for a moment after joining.

**`use()` not `useChangeStream()`** — as explained in [Step 3](#step-3--what-the-frontend-receives), `useChangeStream()` would expose the Arc-internal ChangeSet where previous messages appear as `removed` on each new push, which is the wrong mental model for this pattern.

---

## Summary

| Piece | What it does |
| ----- | ------------ |
| `ChatRoom` | Pure pub/sub channel — `Subject<IEnumerable<ChatMessage>>`, no state |
| `ChatService` | Owns history per room; `Send()` records then delivers |
| `ChatMessage.ForRoom()` | `ReplaySubject(1)` — emits history once, then forwards single-message deliveries |
| `SendMessage.Handle()` | Delegates to `chatService.Send()` |
| Network per message | Constant — one `ChatMessage` per push after the initial history |
| Frontend hook | `use()` — `data` reflects each backend emission directly |
| Component state | Accumulated via `useEffect` — never replaced, only appended |
