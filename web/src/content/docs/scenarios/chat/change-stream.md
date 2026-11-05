---
title: Real-time chat with frontend-managed state
description: Use Arc's useChangeStream() hook to react to new chat messages, maintain the list in React state, and control scrolling and unread counts.
---

Use Arc's `useChangeStream()` hook when a new chat message should trigger more than a list update: scroll to the bottom if the reader is already there, or show an unread count if they have scrolled up. The hook exposes a `ChangeSet` containing `added`, `replaced`, and `removed` items, while your component owns the displayed message list.

Start from the [in-memory guide](/scenarios/chat/in-memory/) and replace only its React component. Keep its backend in your chosen language. Arc for TypeScript is published on npm at 1.0.0 and does not have full .NET parity.

## When to use this pattern

Keep `use()` when the component only needs to render the current history. Arc applies the deltas and gives you `messagesResult.data`; there is no second list to maintain.

Choose `useChangeStream()` when the component needs to distinguish new arrivals from messages already on screen. Here, `added` tells the component what to append and how much to increment `unreadCount`. The scroll position decides whether to follow the conversation or leave the reader in place.

## Backend: unchanged

Use the same room, singleton chat service, `ChatMessage.ForRoom` query, and `SendMessage` command as the in-memory guide. The room still publishes complete histories. In delta mode, Arc compares those histories on the server and sends the changes; this page changes how React consumes them, not how the backend produces them.

## How the ChangeSet reaches the frontend

Keep the default delta transfer mode for this sample. `useChangeStream()` uses the server's `ChangeSet` when one is present. The initial payload is a full history rather than a server delta, so the hook exposes that history as `added`:

| Emission | `ChangeSet` content |
| -------- | ------------------- |
| First connection | All existing messages appear in `added`; `replaced` and `removed` are empty |
| Later history update | New messages appear in `added`; `replaced` and `removed` are empty |

This sample only appends immutable messages, so it handles `added` alone. If you add editing or deletion, apply `replaced` and `removed` too. In full transfer mode, the hook treats each full snapshot as `added`; appending those snapshots would duplicate history, so do not switch this component to full mode unchanged.

## The React component

```tsx
// Chat/ChatRoomPage.tsx
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

`ForRoom.when(...)` keeps the query disabled until the user joins. `useChangeStream({ roomName: joinedRoom })` then exposes changes through the same underlying subscription lifecycle as `use()`; it does not open an extra connection. Unmounting releases the hook's subscription.

The first effect appends `changes.added`. The initial history fills the list, and later additions extend it. When the reader is scrolled up, the effect also increments `unreadCount`. Scrolling to the bottom, either manually or with the button, clears that count.

`isAtBottomRef` holds the scroll position decision without causing a render for each scroll event. The second effect uses it to scroll only when the reader is already following the latest messages.

`setMessages([])` clears local state before the initial join. The rendered component has no room-switch control. If you add one, or need reconnection recovery, handle subscription resets and reconcile messages by `id` rather than blindly appending a fresh history. This example does not implement that recovery. React effects can also observe the latest change after several updates have been batched; use the full list from `use()` when you need the current history without maintaining your own change accumulator.

## Key difference from `use()`

| | `use()` | `useChangeStream()` |
| - | ------- | ------------------- |
| Component receives | Current query result | `{ added, replaced, removed }` |
| Delta application | Automatic, inside the hook | Manual, in `useEffect` |
| Knowing what changed | Not directly visible | Explicit: `added`, `replaced`, `removed` |
| Typical use case | Render a list | React to specific additions or removals |
| Backend requirement | None; the same observable query | None; the same observable query |

Both hooks use the same generated query proxy, but switching hooks also changes who owns the displayed list. With `useChangeStream()`, your component must apply the changes it needs.

To check the behavior, open the same room in another browser, scroll up in this one, and send messages from the other. The count should rise without moving your reading position. Next, [push only new messages from the backend](/scenarios/chat/incremental-pushes/) and see why that guide keeps `use()`.
