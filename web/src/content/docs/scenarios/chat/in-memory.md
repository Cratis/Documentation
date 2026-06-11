---
title: Real-Time Chat — In-Memory
---

# Real-Time Chat — In-Memory

This guide builds a real-time chat room backed entirely by an in-memory service. It demonstrates the core observable query pattern: the frontend subscribes once and receives updates as they arrive — no polling, no manual WebSocket setup.

By the end you will have:

- A `ChatRoom` class that holds per-room message history in a `BehaviorSubject`
- A `ChatService` singleton that manages named rooms in a `ConcurrentDictionary`
- A `ChatMessage` observable query that delivers the room's current history as the initial payload, then pushes updates in real time
- A `SendMessage` command that posts to a room and triggers a push to all subscribers
- A React page component that joins a room and renders a live chat thread

---

## Folder Structure

```
Features/
└── Chat/
    ├── ChatRoom.cs           ← ChatRoom state holder + ChatService singleton
    ├── ChatRoomPage.cs       ← ChatMessage [ReadModel] + SendMessage [Command]
    └── ChatRoomPage.tsx      ← React component
```

---

## Step 1 — ChatRoom and ChatService

`ChatRoom` owns the per-room state. A `BehaviorSubject` is the right tool here: it always holds the most recently emitted value and emits that value immediately to any new subscriber, which is exactly how each connecting client receives the room's current history.

`ChatService` is a singleton that creates and tracks rooms by name.

```csharp
// Features/Chat/ChatRoom.cs
using System.Collections.Concurrent;
using System.Reactive.Subjects;

namespace MyApp.Chat;

/// <summary>
/// Holds the message history and live subject for a single chat room.
/// </summary>
public class ChatRoom
{
    readonly List<ChatMessage> _history = [];
    readonly BehaviorSubject<IEnumerable<ChatMessage>> _messages;

    /// <summary>
    /// Initializes a new instance of the <see cref="ChatRoom"/> class.
    /// </summary>
    public ChatRoom()
    {
        // To pre-populate with persisted history, load it here before constructing
        // the subject — see the RabbitMQ guide for a persistence-backed variant.
        _messages = new BehaviorSubject<IEnumerable<ChatMessage>>([]);
    }

    /// <summary>
    /// Gets the reactive subject that always holds the full current message list.
    /// New subscribers receive the current history immediately via BehaviorSubject semantics.
    /// </summary>
    public BehaviorSubject<IEnumerable<ChatMessage>> Messages => _messages;

    /// <summary>
    /// Appends a message and pushes the updated history to all subscribers.
    /// </summary>
    /// <param name="user">The display name of the sender.</param>
    /// <param name="message">The message text.</param>
    public void Send(string user, string message)
    {
        var msg = new ChatMessage(user, DateTimeOffset.UtcNow, message);
        _history.Add(msg);
        _messages.OnNext([.._history]);
    }
}

/// <summary>
/// Singleton that creates and tracks chat rooms by name.
/// </summary>
public class ChatService
{
    readonly ConcurrentDictionary<string, ChatRoom> _rooms = new();

    /// <summary>
    /// Gets or creates the <see cref="ChatRoom"/> with the given name.
    /// </summary>
    /// <param name="name">The room name.</param>
    /// <returns>The existing or newly created room.</returns>
    public ChatRoom GetChatRoom(string name) =>
        _rooms.GetOrAdd(name, _ => new ChatRoom());
}
```

### What is happening here?

**`BehaviorSubject<IEnumerable<ChatMessage>>`** is a reactive subject with two properties that make it ideal for this use case:
- It always holds the most recently emitted value — the full accumulated history — so it acts as both the live stream and the current-state store.
- It immediately emits that value to any new subscriber. A client joining mid-conversation receives all past messages in the first push, with no separate history call.

**`Send()`** appends the message to `_history`, then calls `OnNext()` with a snapshot of the complete list. Sending the full list on each update keeps backend code straightforward. Arc handles network efficiency automatically via delta mode (see [Step 3](#step-3--delta-mode)).

**`ConcurrentDictionary`** makes `GetChatRoom()` safe under concurrent access. If two clients join the same room simultaneously, only one `ChatRoom` is created.

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
    /// Observes the live message feed for the given room.
    /// The initial emission contains the room's complete current history.
    /// Every call to <see cref="SendMessage.Handle"/> triggers a new emission.
    /// </summary>
    /// <param name="roomName">The name of the room to observe.</param>
    /// <param name="chatService">The chat service, injected by the framework.</param>
    /// <returns>An observable that emits the full message list on each change.</returns>
    public static ISubject<IEnumerable<ChatMessage>> ForRoom(
        string roomName,
        ChatService chatService)
    {
        var room = chatService.GetChatRoom(roomName);
        // BehaviorSubject emits its current value to each new subscriber,
        // so subscribing here immediately seeds the relay with the room's history.
        var relay = new BehaviorSubject<IEnumerable<ChatMessage>>(room.Messages.Value);
        room.Messages.Subscribe(relay);
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
    /// Posts the message to the room, which pushes the updated history
    /// to all subscribers of <see cref="ChatMessage.ForRoom"/>.
    /// </summary>
    /// <param name="chatService">The chat service, injected by the framework.</param>
    public void Handle(ChatService chatService) =>
        chatService.GetChatRoom(RoomName).Send(User, Message);
}
```

### What is happening here?

**`ForRoom(string roomName, ChatService chatService)`** — the framework distinguishes the two parameters automatically: `roomName` is a query parameter from the HTTP request; `ChatService` is resolved from the DI container.

The method creates a **relay** `BehaviorSubject` initialised with `room.Messages.Value` — the `BehaviorSubject`'s current value, which is the room's full history at the moment of connection. Subscribing to `room.Messages` then forwards every future `OnNext()` call to the relay. Each client gets its own relay instance — independent subscriptions that all start with the same snapshot.

**`Handle()`** on `SendMessage` delegates to `ChatRoom.Send()`. Because `Send()` calls `_messages.OnNext()`, every active relay fires, pushing the updated list to every client subscribed to `ForRoom` for that room.

> **Register `ChatService` as a singleton** in your `Program.cs`:
>
> ```csharp
> builder.Services.AddSingleton<ChatService>();
> ```
>
> **Run `dotnet build`** after saving these files. The [Arc proxy generator](/docs/Arc/backend/proxy-generation/) produces:
> - `ChatMessage.ts` — the TypeScript model type
> - `ForRoom.ts` — the observable query proxy with `use()` and `when()` hooks
> - `SendMessage.ts` — the command proxy with a `use()` hook

---

## Step 3 — Delta Mode

Arc observable queries use **delta mode by default**. Understanding this helps you reason about what crosses the network and how to get the most from it.

**What happens on each emission:**

| Emission | What is sent |
| -------- | ------------ |
| First | The complete collection — the room's full history as the initial payload |
| Subsequent | A [`ChangeSet`](/docs/Arc/backend/queries/change-stream/) with only the `added`, `replaced`, and `removed` arrays |

The `use()` hook applies each `ChangeSet` transparently. `messagesResult.data` always holds the full current collection — the React component never sees raw deltas.

**How Arc computes the ChangeSet.** The server compares successive `OnNext()` emissions. If the item type has an `id` property (case-insensitive), Arc uses identity-based comparison and can detect additions, replacements, and removals independently. Without an `id` property, Arc falls back to JSON-hash comparison, which can only detect additions and removals.

`ChatMessage` has no `id` property, so Arc uses JSON-hash. Since chat messages are immutable — never edited after being sent — only `added` events occur, which JSON-hash handles correctly. For large histories, adding a `ChatMessageId` concept improves efficiency by letting Arc skip the full JSON comparison on unchanged items.

> **Full mode.** To send the complete collection on every emission (useful during debugging), set `observableQueryTransferMode={ObservableQueryTransferMode.Full}` on the `<Arc>` provider. Delta mode is the default and is recommended for production.

---

## Step 4 — The React Component

```tsx
// Features/Chat/ChatRoomPage.tsx
import { useState } from 'react';
import { ForRoom } from './ForRoom';
import { SendMessage } from './SendMessage';
import type { ChatMessage } from './ChatMessage';

export const ChatRoomPage = () => {
    const [roomName, setRoomName] = useState('');
    const [joinedRoom, setJoinedRoom] = useState('');
    const [user, setUser] = useState('');
    const [messageText, setMessageText] = useState('');

    const [messagesResult] = ForRoom
        .when(joinedRoom.length > 0)
        .use({ roomName: joinedRoom });

    const [sendCommand, setSendValues] = SendMessage.use();

    const handleJoin = () => {
        if (roomName.trim() && user.trim()) {
            setJoinedRoom(roomName.trim());
        }
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

    const messages: ChatMessage[] = messagesResult.data ?? [];

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

**`ForRoom.when(joinedRoom.length > 0).use({ roomName: joinedRoom })`** — `.when(condition)` prevents the subscription from opening until the user has joined a room. Once `joinedRoom` is set, Arc opens an SSE connection. The component immediately receives the room's full history as the first push. Every subsequent `SendMessage` command — from any user in that room — triggers a new push, and `messagesResult.data` updates automatically.

**`setSendValues` then `execute()`** — `setSendValues` updates the command object with the room name, user name, and message text. `sendCommand.execute()` sends the HTTP POST. On the server, `Handle()` calls `ChatRoom.Send()`, which calls `_messages.OnNext()`, which fires every relay subscription, which pushes the updated list to every subscriber — including this browser.

**Messages are keyed by array index** because `ChatMessage` has no unique identifier. In production, add a `ChatMessageId` concept to enable stable keys and identity-based delta computation.

---

## Summary

| Piece | What it does |
| ----- | ------------ |
| `ChatRoom` | Holds history in `_history`; `BehaviorSubject` emits the full list on every `Send()` |
| `ChatService` | Singleton — owns the `ConcurrentDictionary<string, ChatRoom>` |
| `ChatMessage.ForRoom()` | Creates a per-client relay seeded from `room.Messages.Value`; forwards all future emissions |
| `SendMessage.Handle()` | Calls `ChatRoom.Send()`, which triggers `OnNext()` to all active relays |
| Delta mode | First push = full history; subsequent pushes = `ChangeSet` (only new messages over the wire) |
| `ForRoom.ts` (generated) | TypeScript observable query proxy with `use()` and `when()` hooks |
| `SendMessage.ts` (generated) | TypeScript command proxy with a `use()` hook |
| `ChatRoomPage.tsx` | React component — subscribes on join, renders `messagesResult.data` |
