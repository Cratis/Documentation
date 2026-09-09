---
title: State View — List Authors
---

<a id="state-view--list-authors"></a>

This tutorial builds the **List Authors** slice of the Library system. It is a **State View** — the read side of Event Modeling.

Events recorded by the [Register Author](../state-change) slice are projected into a purpose-built read model, exposed through an observable query, and rendered in a live-updating page.

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

This is the read side of CQRS. The read model never writes to the event log — it only reads from it. You can have as many projections as you like from the same events, each optimized for a different query. If you change what data the UI needs, you change the projection and replay; the event log is untouched.

Chronicle projections are **rewindable**: use Chronicle's replay tooling to rebuild a view from its event history. That lets you change how authors are presented without changing the registration facts. Rebuilding depends on retaining the required history and keeping the projection compatible with it; it is not a substitute for event-store backups.

---

## Folder Structure

```text
Source/
└── Authors/
    ├── AuthorId.cs          ← Shared concept (from the State Change slice)
    ├── AuthorName.cs        ← Shared concept (from the State Change slice)
    └── Listing/
        ├── Listing.cs       ← Read model + projection + query (ALL backend)
        └── Listing.tsx      ← React component for the listing page
```

---

## Step 1 — The Backend Slice

All backend artifacts for this slice live in `Listing.cs`. Reuse `AuthorId`, `AuthorName`, and `AuthorRegistered` from the registration slice, and reference `Cratis.Arc.MongoDB` for collection observation.

```csharp
// Authors/Listing/Listing.cs
using System.Reactive.Subjects;
using Cratis.Arc.Queries.ModelBound;
using Cratis.Chronicle.Projections.ModelBound;
using MongoDB.Driver;
using Library.Authors.Registration;
using Library.Authors;

namespace Library.Authors.Listing;

// ─── Read Model ───────────────────────────────────────────────────────────────

[ReadModel]
[FromEvent<AuthorRegistered>]
public record Author(
    AuthorId Id,
    AuthorName FirstName,
    AuthorName LastName)
{
    public static ISubject<IEnumerable<Author>> AllAuthors(
        IMongoCollection<Author> collection) =>
            collection.Observe();
}
```

### What is happening here?

**[`[ReadModel]`](/arc/backend/queries/model-bound/)** marks the record for Arc's model-bound query discovery. The Chronicle projection annotations define how to build it. With the application's MongoDB read-model storage configured, Chronicle maintains the collection from the event stream — this slice never writes MongoDB updates itself.

**[`[FromEvent<AuthorRegistered>]`](/chronicle/projections/)** is a projection shorthand: *“when an `AuthorRegistered` event is appended, map its properties to this read model using convention.”* Chronicle matches properties by name. `FirstName` on the event maps to `FirstName` on the read model, `LastName` to `LastName`. No explicit mapping code needed.

**`AuthorId Id`** is the read-model identity. `FromEvent` uses the event-source ID as its key by default, and Chronicle supplies the model's `Id` from that key. Registration returns an `AuthorId : EventSourceId<Guid>`, so its response and the event's source agree. No `[Key]` annotation or duplicated ID in `AuthorRegistered` is needed.

**`AllAuthors`** is a static query method. Method parameters are automatically resolved from DI — `IMongoCollection<Author>` is provided because the type is a `[ReadModel]`. The return type `ISubject<IEnumerable<Author>>` is a reactive [observable query](/arc/backend/queries/): after the initial query, collection changes trigger updated results. Configure MongoDB change streams in the host; Arc handles the client subscription. The page updates as the projection processes registrations, rather than making a separate refresh request after every command.

> **Run `dotnet build -c Debug`** after saving `Listing.cs`. This generates the `AllAuthors.ts` query proxy and the `Author.ts` model type via [Arc's proxy generation](/arc/backend/proxy-generation/) used by the frontend component.

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

Use the fluent `IProjectionFor<T>` interface when explicit mapping is easier to read. This is an **alternative** to `[FromEvent<AuthorRegistered>]`: remove that attribute from `Author` when using this projection, rather than defining it twice.

```csharp
// Authors/Listing/AuthorProjection.cs
using Cratis.Chronicle.Projections;
using Library.Authors.Registration;

namespace Library.Authors.Listing;

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
// Authors/Listing/Listing.tsx
import { useDialog } from '@cratis/arc.react/dialogs';
import { Column } from '@cratis/components/DataTables';
import { DataPage, MenuItem } from '@cratis/components/DataPage';
import { Guid } from '@cratis/fundamentals';
import { AllAuthors } from './AllAuthors';
import { AddAuthor } from '../Registration/AddAuthor';

export const Listing = () => {
    const [AddAuthorDialog, showAddAuthor] = useDialog<Guid>(AddAuthor);

    return (
        <>
            <DataPage
                title="Authors"
                query={AllAuthors}
                emptyMessage="No authors registered yet"
                dataKey="id"
            >
                <DataPage.MenuItems>
                    <MenuItem
                        label="Add Author"
                        command={async () => {
                            await showAddAuthor();
                            // DataPage auto-refreshes via the observable query
                        }}
                    />
                </DataPage.MenuItems>

                <DataPage.Columns>
                    <Column field="firstName" header="First Name" sortable />
                    <Column field="lastName" header="Last Name" sortable />
                </DataPage.Columns>
            </DataPage>

            <AddAuthorDialog />
        </>
    );
};
```

### What is happening here?

**`AllAuthors`** is the generated observable-query proxy for the author list. [`DataPage`](/components/datapage/) calls it once, subscribes to its observable, and re-renders whenever the backend pushes a new list. If another user registers an author in another browser tab, this list updates without any manual refresh.

**[`DataPage`](/components/datapage/)** from `@cratis/components` provides the complete page chrome: title, action menu bar, a data table with sorting and filtering, and pagination. Declare columns with the Cratis-owned `Column` marker inside `DataPage.Columns`, and actions inside `DataPage.MenuItems`. This example queries the whole author list; for a large catalog, add [server-side paging](/arc/backend/queries/) rather than treating table pagination as a limit on backend work.

**`useDialog<Guid>(AddAuthor)`** from [`@cratis/arc.react/dialogs`](/arc/frontend/react/) supplies the wrapper component rendered in JSX and an async function that opens it. `showAddAuthor` resolves to `[dialogResult, authorId]` because `AddAuthor` closes with the `Guid` identity passed to its `onSuccess` callback. The listing does not need that ID to refresh: it already observes the author collection.

**`MenuItem`** in the `MenuItems` slot adds an action to the toolbar. The `command` handler `await`s the dialog — you can inspect the result if needed, but since `DataPage` subscribes to the observable query, the list updates automatically after a successful registration.

The `AddAuthor` component is imported from the Registration slice — slices within the same feature compose naturally because they share the `AuthorId` and `AuthorName` concepts from the parent folder.

---

## Step 4 — Wiring to the Feature Page

Each feature has a composition page that assembles its slices.

```tsx
// Authors/Authors.tsx
import { Listing } from './Listing/Listing';

export const Authors = () => <Listing />;
```

In larger features this page will host a navigation menu that switches between slices. For now, the listing is the whole feature.

---

## Step 5 — Registering the Route

Register `Authors` in your application's router. This minimal route composition assumes the application's Arc and Components providers are already mounted above `App`; if it already has a router, add only the route to its existing `Routes`.

```tsx
// App.tsx
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Authors } from './Authors/Authors';

export const App = () => (
    <BrowserRouter>
        <Routes>
            <Route path="/authors" element={<Authors />} />
        </Routes>
    </BrowserRouter>
);
```

---

## Summary

| Layer | Artifact | Technology |
| ----- | -------- | ---------- |
| Read model | `Author` record | [Chronicle](/chronicle/) [`[ReadModel]`](/chronicle/read-models/) + [`[FromEvent<T>]`](/chronicle/projections/) |
| Query | `AllAuthors` static method | [Chronicle](/chronicle/) `ISubject<IEnumerable<T>>` |
| Generated proxy | `AllAuthors.ts` | [Arc proxy generation](/arc/backend/proxy-generation/) |
| Listing page | `Listing.tsx` | [`@cratis/components`](/components/) [`DataPage`](/components/datapage/) |

The read model and its query fit in one record. The projection is zero-configuration convention mapping. The frontend subscribes to a live stream, not a static snapshot. The UI follows the events this projection handles — including `AuthorRegistered` from the [Register Author](../state-change) slice.

**Next**: [Automation — Cancel Expired Reservations](../automation)
