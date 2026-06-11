# State Change — Register an Author

This tutorial builds the **Register Author** slice of the Library system. It is a **State Change** — the most fundamental pattern in Event Modeling.

A user fills in a form, that maps to a command, the command is validated, an event is recorded in Chronicle, and the UI confirms the result.

By the end you will have:

- A `RegisterAuthor` command with built-in validation
- An `AuthorRegistered` event stored in Chronicle
- A `CommandDialog`-based React form that calls the command and gives the user feedback
- A uniqueness constraint to prevent duplicate author names

---

## What is a State Change?

In Event Modeling terms, a **State Change** slice is the answer to the question: *"What can a user do that will permanently change the system?"*

The shape is always the same:

1. A user provides input
2. That input is turned into a **Command** — an explicit statement of intent
3. The command is validated (is this allowed right now?)
4. If valid, one or more **Events** are appended to the event log
5. The event log is the truth — the state has changed

Nothing in the system reads from a mutable table. There is no `UPDATE authors SET ...`. Instead you ask: did `AuthorRegistered` ever happen for this ID? The answer to that question is in the event log, and it never changes.

---

## Folder Structure

Following the vertical slice convention, everything for this slice lives together:

```
Features/
└── Authors/
    ├── AuthorId.cs               ← Concept: strongly-typed author identity
    ├── AuthorName.cs             ← Concept: strongly-typed author name
    └── Registration/
        ├── Registration.cs       ← Command + event + constraint (ALL backend)
        └── AddAuthor.tsx         ← React component for the add-author form
```

One folder. One `.cs` file for all backend artefacts. One `.tsx` file for the UI.

---

## Step 1 — Concepts

Before writing the command, introduce strongly-typed value objects using [`ConceptAs<T>`](/docs/Fundamentals/). Raw strings and `Guid`s have no domain meaning; `AuthorName` and `AuthorId` do.

```csharp
// Features/Authors/AuthorId.cs
using Cratis.Concepts;

namespace Library.Authors;

public record AuthorId(Guid Value) : ConceptAs<Guid>(Value)
{
    public static AuthorId New() => new(Guid.NewGuid());
}
```

```csharp
// Features/Authors/AuthorName.cs
using Cratis.Concepts;

namespace Library.Authors;

public record AuthorName(string Value) : ConceptAs<string>(Value);
```

`ConceptAs<T>` gives you type safety, implicit conversion to and from the underlying primitive, and meaningful error messages. The framework recognises these types throughout — in Chronicle keys, in JSON serialisation, and in proxy generation.

---

## Step 2 — The Backend Slice

All backend artefacts for this slice live in a single file: `Registration.cs`.

```csharp
// Features/Authors/Registration/Registration.cs
using Cratis.Arc.Commands.ModelBound;
using Cratis.Arc.Validation;
using Cratis.Chronicle.Constraints;
using Cratis.Chronicle.Events;
using FluentValidation;
using Library.Authors;

namespace Library.Authors.Registration;

// ─── Event ────────────────────────────────────────────────────────────────────

[EventType]
public record AuthorRegistered(AuthorName FirstName, AuthorName LastName);

// ─── Validation ───────────────────────────────────────────────────────────────

public class RegisterAuthorValidator : CommandValidator<RegisterAuthor>
{
    public RegisterAuthorValidator()
    {
        RuleFor(c => c.FirstName)
            .NotEmpty().WithMessage("First name is required");

        RuleFor(c => c.LastName)
            .NotEmpty().WithMessage("Last name is required");
    }
}

// ─── Uniqueness Constraint ────────────────────────────────────────────────────

public class UniqueAuthorName : IConstraint
{
    public void Define(IConstraintBuilder builder) => builder
        .Unique(_ => _
            .On<AuthorRegistered>(e => $"{e.FirstName} {e.LastName}")
            .WithMessage("An author with that name is already registered"));
}

// ─── Command ──────────────────────────────────────────────────────────────────

[Command]
public record RegisterAuthor(AuthorName FirstName, AuthorName LastName)
{
    public (AuthorId, AuthorRegistered) Handle()
    {
        var authorId = AuthorId.New();
        return (authorId, new AuthorRegistered(FirstName, LastName));
    }
}
```

### What is happening here?

**[`[EventType]`](/docs/Chronicle/events/)** marks the record as a [Chronicle](/docs/Chronicle/) event. The framework uses the type name as the event identifier — no GUID argument, no string argument. Every property is an immutable fact; there are no nullable fields. If first name and last name are both required, the event proves it.

**[`CommandValidator<T>`](/docs/Arc/backend/commands/command-validation/)** extends FluentValidation. It runs automatically before `Handle()` is ever called. If any rule fails the [command pipeline](/docs/Arc/backend/commands/command-pipeline/) short-circuits and returns validation errors to the caller — no exception throwing required.

**[`IConstraint`](/docs/Chronicle/constraints/)** is a [Chronicle](/docs/Chronicle/)-level uniqueness guard that spans across all event sources (i.e. all authors). It observes every `AuthorRegistered` event and builds an index of `"FirstName LastName"` values. If the combination already exists the command is rejected before `Handle()` runs.

**[`[Command]` with `Handle()`](/docs/Arc/backend/commands/model-bound/)** is the [Arc](/docs/Arc/) model-bound command pattern. The return value is a tuple: the first element (`AuthorId`) becomes the `CommandResult.Response` value that the frontend receives; the second element (`AuthorRegistered`) is the [Chronicle](/docs/Chronicle/) event to append. The framework resolves the event source ID from the `AuthorId` return value automatically.

> **Build before writing frontend code.** Run `dotnet build` after saving `Registration.cs`. This generates a TypeScript proxy (`RegisterAuthor.ts`) via [Arc's proxy generation](/docs/Arc/backend/proxy-generation/) in your frontend project — without it, the React component has nothing to import.

---

## Step 3 — The React Component

With the proxy generated, the frontend component is straightforward.

```tsx
// Features/Authors/Registration/AddAuthor.tsx
import { DialogResult, useDialogContext } from '@cratis/arc.react/dialogs';
import { CommandResult } from '@cratis/arc/commands';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { RegisterAuthor } from './commands/RegisterAuthor';

type RegisterAuthorResponse = {
    authorId: string;
};

export const AddAuthor = () => {
    const { closeDialog } = useDialogContext<CommandResult<RegisterAuthorResponse>>();

    return (
        <CommandDialog<RegisterAuthor>
            command={RegisterAuthor}
            title="Register Author"
            okLabel="Register"
            onConfirm={async () => closeDialog(DialogResult.Ok)}
            onCancel={() => closeDialog(DialogResult.Cancelled)}
        >
            <InputTextField<RegisterAuthor>
                value={instance => instance.firstName}
                title="First name"
            />
            <InputTextField<RegisterAuthor>
                value={instance => instance.lastName}
                title="Last name"
            />
        </CommandDialog>
    );
};
```

The dialog component uses `useDialogContext` from [`@cratis/arc.react/dialogs`](/docs/Arc/frontend/react/) to get the `closeDialog` function. It does not receive props for visibility — all dialog lifecycle is managed by the framework. A parent component uses the [`useDialog`](/docs/Arc/frontend/react/) hook to show and await this dialog.

[`CommandDialog`](/docs/Components/CommandDialog/) from `@cratis/components` does the heavy lifting:

- It reads the `RegisterAuthor` proxy to know what fields exist
- [`InputTextField`](/docs/Components/CommandForm/) renders typed form fields bound to command properties
- It runs the frontend-side validation defined in the proxy
- It calls the [Arc command pipeline](/docs/Arc/backend/commands/command-pipeline/) when the user confirms
- `onConfirm` fires only after command execution succeeds
- It surfaces any backend validation errors directly in the form
- It gives the user a success or error response without you writing any `fetch` calls

The parent awaits the result:

```tsx
const [AddAuthorDialog, showAddAuthor] = useDialog<CommandResult<RegisterAuthorResponse>>(AddAuthor);

const handleAdd = async () => {
    const [dialogResult, commandResult] = await showAddAuthor();
    if (dialogResult === DialogResult.Ok && commandResult?.isSuccess) {
        // The author was registered; commandResult.response.authorId is available
    }
};
```

---

## Step 4 — Integration Specs

For state-change slices, write integration specs that prove the events are correct.

```
Features/Authors/Registration/when_registering/
├── and_author_does_not_exist.cs
└── and_author_name_already_exists.cs
```

```csharp
// when_registering/and_author_does_not_exist.cs
using Cratis.Chronicle.Testing;
using Library.Authors;
using Library.Authors.Registration;

namespace when_registering;

public class and_author_does_not_exist : given.an_event_store
{
    RegisterAuthor command;

    void Establish() =>
        command = new RegisterAuthor(
            new AuthorName("Tolkien"),
            new AuthorName("J.R.R."));

    async Task Because() => await CommandPipeline.Execute(command);

    [Fact] void should_result_in_an_author_registered_event() =>
        Events.ShouldContainSingle<AuthorRegistered>();

    [Fact] void should_have_correct_first_name() =>
        Events.Single<AuthorRegistered>().FirstName.Value.ShouldEqual("Tolkien");

    [Fact] void should_have_correct_last_name() =>
        Events.Single<AuthorRegistered>().LastName.Value.ShouldEqual("J.R.R.");
}
```

These specs run against Chronicle's in-memory test harness — no Docker, no MongoDB, instant feedback.

---

## Summary

| Layer | Artifact | Technology |
| ----- | -------- | ---------- |
| Domain event | `AuthorRegistered` | [Chronicle](/docs/Chronicle/) [`[EventType]`](/docs/Chronicle/events/) |
| Command + handler | `RegisterAuthor` with `Handle()` | [Arc](/docs/Arc/) [`[Command]`](/docs/Arc/backend/commands/model-bound/) model-bound |
| Input validation | `RegisterAuthorValidator` | [Arc](/docs/Arc/) [`CommandValidator<T>`](/docs/Arc/backend/commands/command-validation/) + FluentValidation |
| Uniqueness constraint | `UniqueAuthorName` | [Chronicle](/docs/Chronicle/) [`IConstraint`](/docs/Chronicle/constraints/) |
| React form | `AddAuthor.tsx` | [`@cratis/components`](/docs/Components/) [`CommandDialog`](/docs/Components/CommandDialog/) |

The entire write side — event, validator, constraint, command — is in one file. The frontend is one component that imports one generated proxy. Zero boilerplate. Zero glue code. The framework wires it together.

**Next**: [State View — List Authors](./state-view.md)
