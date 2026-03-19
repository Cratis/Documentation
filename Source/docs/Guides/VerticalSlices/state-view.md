# State View — List Authors

This tutorial builds the **List Authors** slice of the Library system. It is a **State View** — the read side of Event Modeling.

Events recorded by the [Register Author](./state-change.md) slice are projected into a purpose-built read model, exposed through an observable query, and rendered in a live-updating page.

By the end you will have:

- An `Author` read model automatically projected from `AuthorRegistered` events
- An `AllAuthors` observable query that pushes updates to the frontend in real time
- An `Authors` listing page using `DataPage` from `@cratis/components`

---

## What is a State View?

In Event Modeling terms, a **State View** slice answers the question: *"What does the user need to see right now?"*

The shape is:

1. Events that have been recorded are **projected** into a **Read Model**
2. The read model is a purpose-built view — not a generic table, but exactly the shape a specific UI needs
3. The frontend queries the read model and renders it

This is the read side of CQRS. The read model never writes to the event log — it only reads from it. You can have as many projections as you like from the same events, each optimised for a different query. If you change what data the UI needs, you change the projection and replay; the event log is untouched.

One of Chronicle's most powerful features is that projections are **rewindable**: drop the read model collection, replay the events, and the read model is reconstructed perfectly. Your data is always recoverable.

---

## Folder Structure

```
Features/
└── Authors/
    ├── AuthorId.cs          ← Shared concept (from the State Change slice)
    ├── AuthorName.cs        ← Shared concept (from the State Change slice)
    └── Listing/
        ├── Listing.cs       ← Read model + projection + query (ALL backend)
        └── Listing.tsx      ← React component for the listing page
```

---

## Step 1 — The Backend Slice

All backend artefacts for this slice live in `Listing.cs`.

```csharp
// Features/Authors/Listing/Listing.cs
using Cratis.Chronicle.Events.Projections;
using Cratis.Chronicle.Projections;
using Cratis.Chronicle.Read;
using MongoDB.Driver;
using Cratis.Extensions.MongoDB;
using Library.Authors.Registration;
using Library.Authors;

namespace Library.Authors.Listing;

// ─── Read Model ───────────────────────────────────────────────────────────────

[ReadModel]
[FromEvent<AuthorRegistered>]
public record Author(
    [Key] AuthorId Id,
    AuthorName FirstName,
    AuthorName LastName)
{
    public static ISubject<IEnumerable<Author>> AllAuthors(
        IMongoCollection<Author> collection) =>
            collection.Observe();
}
```

### What is happening here?

**[`[ReadModel]`](/docs/Chronicle/read-models/)** registers the record with [Chronicle](/docs/Chronicle/) as a MongoDB-backed projection target. Chronicle automatically creates and maintains the collection. You never write a MongoDB query to update it — Chronicle does that from the event stream.

**[`[FromEvent<AuthorRegistered>]`](/docs/Chronicle/projections/)** is a projection shorthand: *“when an `AuthorRegistered` event is appended, map its properties to this read model using convention.”* Chronicle matches properties by name. `FirstName` on the event maps to `FirstName` on the read model, `LastName` to `LastName`. No explicit mapping code needed.

**`[Key]`** on `AuthorId` tells Chronicle which property is the read model's primary key, and how to correlate events to read model instances. Because `RegisterAuthor.Handle()` returns an `AuthorId` as the event source identity, Chronicle stores the `AuthorRegistered` event under that ID — and the projection updates the `Author` document with the same ID.

**`AllAuthors`** is a static query method. Method parameters are automatically resolved from DI — `IMongoCollection<Author>` is provided because the type is a `[ReadModel]`. The return type `ISubject<IEnumerable<Author>>` is a reactive [observable query](/docs/Arc/backend/queries/): the frontend receives the current list immediately, and then receives a new emission whenever any document in the collection changes. No polling. No WebSockets to configure manually.

> **Run `dotnet build`** after saving `Listing.cs`. This generates the `AllAuthors.ts` query proxy and the `Author.ts` model type via [Arc's proxy generation](/docs/Arc/backend/proxy-generation/) used by the frontend component.

---

## Step 2 — Projection Mapping Options

The example above uses attribute-based convention mapping, which works when event and read model property names match. For cases where they differ, or where you need arithmetic operations, use the full attribute vocabulary:

| Attribute | What it does |
| --------- | ------------ |
| `[FromEvent<T>]` on the record | Auto-map all matching properties from event `T` |
| `[FromEvent<T>(key: nameof(...))]` | Map from a specific event property as the key |
| `[SetFrom<T>]` | Explicit property mapping from a named event |
| `[AddFrom<T>]` / `[SubtractFrom<T>]` | Accumulate values from an event |
| `[Increment<T>]` / `[Decrement<T>]` | Increment or decrement a counter |
| `[Count<T>]` | Count occurrences of an event type |
| `[RemovedWith<T>]` | Remove the read model document when this event occurs |
| `[Join<T>]` | Join properties from a second event stream |

For the most complex cases — conditional updates, aggregations, computed properties — use the fluent `IProjectionFor<T>` interface instead:

```csharp
public class AuthorProjection : IProjectionFor<Author>
{
    public void Define(IProjectionBuilderFor<Author> builder) => builder
        .From<AuthorRegistered>();
}
```

AutoMap is on by default. `.From<AuthorRegistered>()` alone is enough when names match.

---

## Step 3 — The React Component

```tsx
// Features/Authors/Listing/Listing.tsx
import { useState } from 'react';
import { useDialog } from '@cratis/arc.react/dialogs';
import { Column } from 'primereact/column';
import { DataPage, MenuItem, MenuItems, Columns } from '@cratis/components';
import { AllAuthors } from './queries/AllAuthors';
import { AddAuthor } from '../Registration/AddAuthor';
import type { Author } from './queries/Author';

export const Listing = () => {
    const [AddAuthorDialog, showAddAuthor] = useDialog(AddAuthor);
    const [selected, setSelected] = useState<Author | undefined>(undefined);

    return (
        <>
            <DataPage
                title="Authors"
                query={AllAuthors}
                emptyMessage="No authors registered yet"
                dataKey="id"
                onSelectionChange={setSelected}
            >
                <MenuItems>
                    <MenuItem
                        label="Add Author"
                        icon="pi pi-plus"
                        command={() => showAddAuthor()}
                    />
                </MenuItems>

                <Columns>
                    <Column field="firstName" header="First Name" sortable />
                    <Column field="lastName" header="Last Name" sortable />
                </Columns>
            </DataPage>

            <AddAuthorDialog />
        </>
    );
};
```

### What is happening here?

**`AllAuthors`** is the generated query proxy — an `IObservableQueryFor<Author[]>` implementation. [`DataPage`](/docs/Components/DataPage/) calls it once, subscribes to its observable, and re-renders whenever the backend pushes a new list. If another user registers an author in another browser tab, this list updates without any manual refresh.

**[`DataPage`](/docs/Components/DataPage/)** from `@cratis/components` provides the complete page chrome: title, action menu bar, a data table with sorting and filtering, and pagination. You declare columns as children using PrimeReact's `Column` and the component does everything else.

**`useDialog(AddAuthor)`** from [`@cratis/arc.react/dialogs`](/docs/Arc/frontend/react/) returns a tuple: `AddAuthorDialog` is a wrapper component that you render in JSX, and `showAddAuthor` is a function that opens the dialog. The dialog manages its own visibility internally — no `useState` for `visible`/`setVisible`. When the user confirms, the [`CommandDialog`](/docs/Components/CommandDialog/) inside `AddAuthor` executes the command automatically.

**`MenuItem`** in the `MenuItems` slot adds an action to the toolbar. Using `disableOnUnselected={true}` would grey the item out until the user selects a row — useful for edit and delete actions.

The `AddAuthor` component is imported from the Registration slice — slices within the same feature compose naturally because they share the `AuthorId` and `AuthorName` concepts from the parent folder.

---

## Step 4 — Wiring to the Feature Page

Each feature has a composition page that assembles its slices.

```tsx
// Features/Authors/Authors.tsx
import { Listing } from './Listing/Listing';

export const Authors = () => <Listing />;
```

In larger features this page will host a navigation menu that switches between slices. For now, the listing is the whole feature.

---

## Step 5 — Registering the Route

Register `Authors` in your application's router:

```tsx
// App.tsx  (ASP.NET Core Vite integration)
import { Route } from 'react-router-dom';
import { Authors } from './Features/Authors/Authors';

// ...inside your <Routes>
<Route path="/authors" element={<Authors />} />
```

---

## Summary

| Layer | Artifact | Technology |
| ----- | -------- | ---------- |
| Read model | `Author` record | [Chronicle](/docs/Chronicle/) [`[ReadModel]`](/docs/Chronicle/read-models/) + [`[FromEvent<T>]`](/docs/Chronicle/projections/) |
| Query | `AllAuthors` static method | [Chronicle](/docs/Chronicle/) `ISubject<IEnumerable<T>>` |
| Generated proxy | `AllAuthors.ts` | [Arc proxy generation](/docs/Arc/backend/proxy-generation/) |
| Listing page | `Listing.tsx` | [`@cratis/components`](/docs/Components/) [`DataPage`](/docs/Components/DataPage/) |

The read model and its query fit in one record. The projection is zero-configuration convention mapping. The frontend subscribes to a live stream, not a static snapshot. The UI automatically reflects every state change appended anywhere in the system — including changes from the [Register Author](./state-change.md) slice.

**Next**: [Automation — Cancel Expired Reservations](./automation.md)
