---
title: Real-Time Chat — Frontend-Managed State
---

# Real-Time Chat — Frontend-Managed State

The two previous guides use `ForRoom.use()`, which applies Arc's delta `ChangeSet` transparently and always gives the component a complete `messagesResult.data` array. That is the right default for most UIs.

This guide uses `ForRoom.useChangeStream()` instead. The component receives the raw `ChangeSet` — `{ added, replaced, removed }` — and maintains its own `useState` accumulator. **The backend is unchanged from the [in-memory guide](../in-memory).** Only the frontend differs.

By the end you will have:

- The same backend as the in-memory guide
- A React component that manages its own message list using `useState`
- A `useEffect` that appends incoming `ChangeSet.added` items to the local list
- A clear picture of when this pattern is preferable to the transparent `use()` hook

---

## When to Use This Pattern

**`use()` (transparent)** — the right choice for most list UIs. The component renders `messagesResult.data` directly. Arc handles the delta under the hood.

**`useChangeStream()` (explicit)** — reach for this when you need to react to *what changed*, not just *what the current state is*:

- Scroll to the bottom only when new messages arrive, not on every render
- Show a "new message" badge when the user is scrolled up
- Animate newly added items with an entry transition
- Track a separate `unreadCount` derived from `added.length`

All of these require knowing *which* items just appeared. `useChangeStream()` gives you exactly that.

---

## Backend — Unchanged

The backend is identical to the [in-memory guide](../in-memory). No changes to `ChatRoom.cs` or `ChatRoomPage.cs`.

```csharp
// Features/Chat/ChatRoomPage.cs — unchanged
[ReadModel]
public record ChatMessage(string User, DateTimeOffset SentAt, string Message)
{
    public static ISubject<IEnumerable<ChatMessage>> ForRoom(
        string roomName,
        ChatService chatService)
    {
        var room = chatService.GetChatRoom(roomName);
        var relay = new BehaviorSubject<IEnumerable<ChatMessage>>(room.Messages.Value);
        room.Messages.Subscribe(relay);
        return relay;
    }
}
```

The server still emits the full message list on each `OnNext()`. Arc still computes a `ChangeSet` server-side and sends only the diff. The difference is how the frontend consumes it.

---

## How the ChangeSet Reaches the Frontend

Arc's delta mode is always on by default. Here is what the frontend receives:

| Emission | `ChangeSet` content |
| -------- | ------------------- |
| First connection | All existing messages appear in `added`; `replaced` and `removed` are empty |
| Each new message sent | The one new message appears in `added`; `replaced` and `removed` are empty |

For chat, `replaced` and `removed` are always empty — messages are immutable and are never deleted. The component only ever needs to handle `added`.

---

## The React Component

```tsx
// Features/Chat/ChatRoomPage.tsx
import { useState, useEffect, useRef } from 'react';
import { ForRoom } from './ForRoom';
import { SendMessage } from './SendMessage';
import type { ChatMessage } from './ChatMessage';

export const ChatRoomPage = () => {
    const [roomName, setRoomName] = useState('');
    const [joinedRoom, setJoinedRoom] = useState('');
    const [user, setUser] = useState('');
    const [messageText, setMessageText] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const listRef = useRef<HTMLDivElement>(null);
    const isAtBottomRef = useRef(true);

    const changes = ForRoom
        .when(joinedRoom.length > 0)
        .useChangeStream({ roomName: joinedRoom });

    const [sendCommand, setSendValues] = SendMessage.use();

    // Append incoming messages to local state.
    // On first subscription, all existing messages arrive as changes.added.
    // On each subsequent send, the single new message arrives as changes.added.
    useEffect(() => {
        if (!changes.added.length) return;
        setMessages(prev => [...prev, ...changes.added]);

        if (!isAtBottomRef.current) {
            setUnreadCount(prev => prev + changes.added.length);
        }
    }, [changes]);

    // Scroll to bottom when new messages arrive and the user is already at the bottom.
    useEffect(() => {
        if (!listRef.current || !isAtBottomRef.current) return;
        listRef.current.scrollTop = listRef.current.scrollHeight;
    }, [messages]);

    const handleScroll = () => {
        const el = listRef.current;
        if (!el) return;
        const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 8;
        isAtBottomRef.current = atBottom;
        if (atBottom) setUnreadCount(0);
    };

    const handleScrollToBottom = () => {
        if (!listRef.current) return;
        listRef.current.scrollTop = listRef.current.scrollHeight;
        isAtBottomRef.current = true;
        setUnreadCount(0);
    };

    const handleJoin = () => {
        if (roomName.trim() && user.trim()) {
            setMessages([]);
            setUnreadCount(0);
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

    return (
        <div style={{ maxWidth: 600, margin: '40px auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <h2>{joinedRoom}</h2>
            <p style={{ color: '#888', margin: 0 }}>Chatting as <strong>{user}</strong></p>

            <div style={{ position: 'relative' }}>
                <div
                    ref={listRef}
                    onScroll={handleScroll}
                    style={{
                        border: '1px solid #e0e0e0',
                        borderRadius: 8,
                        height: 400,
                        overflowY: 'auto',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                    }}
                >
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

                {unreadCount > 0 && (
                    <button
                        onClick={handleScrollToBottom}
                        style={{
                            position: 'absolute',
                            bottom: 12,
                            left: '50%',
                            transform: 'translateX(-50%)',
                            background: '#0078d4',
                            color: '#fff',
                            border: 'none',
                            borderRadius: 16,
                            padding: '6px 16px',
                            cursor: 'pointer',
                            fontSize: 13,
                        }}
                    >
                        {unreadCount} new {unreadCount === 1 ? 'message' : 'messages'} ↓
                    </button>
                )}
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

**`ForRoom.when(...).useChangeStream({ roomName: joinedRoom })`** — returns the raw `ChangeSet<ChatMessage>` on each push rather than the reconstructed full collection. The component receives `{ added, replaced, removed }` directly.

**The first `useEffect`** appends `changes.added` to the local `messages` state. On the first subscription the entire room history arrives in `added`, populating the initial list. Every subsequent message arrives as a single item in `added`. The `replaced` and `removed` arrays are always empty for chat messages.

**`unreadCount`** is incremented when new messages arrive while `isAtBottomRef.current` is `false` — meaning the user has scrolled up. The "new messages" button appears and resets the count when the user scrolls back to the bottom. This behaviour is only possible because `useChangeStream` exposes `added` explicitly.

**`isAtBottomRef`** uses a `ref` rather than `useState` so that the scroll handler does not trigger re-renders on every scroll event.

**`setMessages([])`** when joining resets local state. Without this, switching rooms would briefly show the previous room's messages before the new history arrives.

---

## Key Difference from `use()`

| | `use()` | `useChangeStream()` |
| - | ------- | ------------------- |
| Component receives | Full collection snapshot | `{ added, replaced, removed }` |
| Delta application | Automatic, inside the hook | Manual, in `useEffect` |
| Knowing what changed | Not directly visible | Explicit — `added`, `replaced`, `removed` |
| Typical use case | Render a list | React to specific additions or removals |
| Backend requirement | None — same `ISubject<IEnumerable<T>>` | None — same `ISubject<IEnumerable<T>>` |

Both hooks subscribe to the same generated query proxy. Switching between them is a one-line change in the component. The backend and the generated proxy are identical in both cases.
