---
title: State Change — Register an Author
---

<a id="state-change--register-an-author"></a>

This tutorial builds the **Register Author** slice of the Library system. It is a **State Change** — the most fundamental pattern in Event Modeling.

A user fills in a form, Arc validates the command, Chronicle records the registration, and the UI confirms the result. This series uses Arc with its optional Chronicle integration. Arc also supports commands and queries without event sourcing.

Start with an application configured for [Arc and Chronicle](/arc/backend/chronicle/), [proxy generation](/arc/backend/proxy-generation/), and [Components](/components/). The examples below add the Library behavior to that application.

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

Registration does not update an author table directly. It records that `AuthorRegistered` happened for an identity. The [next slice](../state-view) builds a queryable view from those facts, so readers do not have to scan the event log.

---

## Folder Structure

Following the vertical slice convention, everything for this slice lives together:

```text
Source/
└── Authors/
    ├── AuthorId.cs               ← Concept: strongly-typed author identity
    ├── AuthorName.cs             ← Concept: strongly-typed author name
    └── Registration/
        ├── Registration.cs       ← Command + event + constraint (ALL backend)
        └── AddAuthor.tsx         ← React component for the add-author form
```

One folder. One `.cs` file for the slice's backend artifacts. One `.tsx` file for the UI. The shared concepts sit in the parent folder so later author slices use the same vocabulary.

---

## Step 1 — Concepts

Before writing the command, name the domain values. Use [`ConceptAs<T>`](/fundamentals/) for an author name and `EventSourceId<Guid>` for an author's event-source identity. Both keep unrelated values from being swapped accidentally; the identity also tells Chronicle where to append.

```csharp
// Authors/AuthorId.cs
using Cratis.Chronicle.Events;

namespace Library.Authors;

public record AuthorId(Guid Value) : EventSourceId<Guid>(Value)
{
    public static readonly AuthorId NotSet = new(Guid.Empty);
    public static AuthorId New() => new(Guid.NewGuid());
    public static implicit operator AuthorId(Guid value) => new(value);
}
```

```csharp
// Authors/AuthorName.cs
using Cratis.Arc.Validation;
using Cratis.Concepts;
using FluentValidation;

namespace Library.Authors;

public record AuthorName(string Value) : ConceptAs<string>(Value)
{
    public static readonly AuthorName NotSet = new(string.Empty);
    public static implicit operator AuthorName(string value) => new(value);
}

public class AuthorNameValidator : ConceptValidator<AuthorName>
{
    public AuthorNameValidator() => RuleFor(name => name.Value).NotEmpty();
}
```

The declared conversion operators let you construct domain values from their primitives. `AuthorNameValidator` makes the nonempty-name rule travel with the concept wherever Arc validates it. JSON serialization retains a simple string wire value. The generated proxy deserializes the `AuthorId` response as a `Guid` from `@cratis/fundamentals`, not an object with an `authorId` property.

---

## Step 2 — The Backend Slice

The command, event, and registration rules live in a single file: `Registration.cs`.

```csharp
// Authors/Registration/Registration.cs
using Cratis.Arc.Commands;
using Cratis.Arc.Commands.ModelBound;
using Cratis.Chronicle.Events.Constraints;
using Cratis.Chronicle.Events;
using FluentValidation;
using Library.Authors;

namespace Library.Authors.Registration;

// ─── Event ────────────────────────────────────────────────────────────────────

/// <summary>Records an author's registration with their first and last names.</summary>
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
            .On<AuthorRegistered>(e => e.FirstName, e => e.LastName)
            .WithMessage("An author with that name is already registered"));
}

// ─── Command ──────────────────────────────────────────────────────────────────

[Command]
public record RegisterAuthor(AuthorName FirstName, AuthorName LastName)
{
    public AuthorId Provide() => AuthorId.New();

    public (AuthorId, AuthorRegistered) Handle(AuthorId authorId) =>
        (authorId, new AuthorRegistered(FirstName, LastName));
}
```

### What is happening here?

**[`[EventType]`](/chronicle/events/)** marks the record as a [Chronicle](/chronicle/) event. The framework uses the type name as the event identifier — no GUID argument, no string argument. Every property records a fact; there are no nullable fields. The validators enforce the required names before this command constructs the event.

**[`CommandValidator<T>`](/arc/backend/commands/command-validation/)** extends FluentValidation. It runs automatically before `Handle()` is ever called. If any rule fails the [command pipeline](/arc/backend/commands/command-pipeline/) short-circuits and returns validation errors to the caller — no exception throwing required.

**[`IConstraint`](/chronicle/constraints/)** guards the combination of `FirstName` and `LastName` across authors in the event store namespace. `On` selects two properties, rather than computing a concatenated string. This tutorial keeps the Library's rule that an exact name combination may be registered only once; it does not treat names as a universal way to identify people.

Chronicle checks uniqueness **when the returned event is committed, after `Handle()` has run**. A duplicate produces a constraint violation in the command result and the attempted registration is not appended. That is different from input validation, which short-circuits before the handler.

**[`[Command]` with `Handle()`](/arc/backend/commands/model-bound/)** is the [Arc](/arc/) model-bound command pattern. The return value is a tuple: the first element (`AuthorId`) becomes the `CommandResult.Response` value that the frontend receives; the second element (`AuthorRegistered`) is the [Chronicle](/chronicle/) event to append. Because `AuthorId` derives from `EventSourceId<Guid>`, the integration uses the returned identity for the append as well as the response. A `ConceptAs<Guid>` alone would only be an ordinary response. `Provide()` creates the identity before `Handle()`, keeping the event-construction decision deterministic for a supplied ID.

> **Build before writing frontend code.** Run `dotnet build -c Debug` after saving `Registration.cs`. This generates a TypeScript proxy (`RegisterAuthor.ts`) via [Arc's proxy generation](/arc/backend/proxy-generation/) in your frontend project — without it, the React component has nothing to import.

---

## Step 3 — The React Component

With the proxy generated, the frontend component is straightforward.

```tsx
// Authors/Registration/AddAuthor.tsx
import { DialogResult, useDialogContext } from '@cratis/arc.react/dialogs';
import { CommandDialog } from '@cratis/components/CommandDialog';
import { InputTextField } from '@cratis/components/CommandForm';
import { Guid } from '@cratis/fundamentals';
import { RegisterAuthor } from './RegisterAuthor';

export const AddAuthor = () => {
    const { closeDialog } = useDialogContext<object, Guid>();

    return (
        <CommandDialog<RegisterAuthor, Guid>
            command={RegisterAuthor}
            title="Register Author"
            okLabel="Register"
            onSuccess={authorId => closeDialog(DialogResult.Ok, authorId)}
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

The dialog component uses `useDialogContext` from [`@cratis/arc.react/dialogs`](/arc/frontend/react/) to get the `closeDialog` function. It does not receive props for visibility — all dialog lifecycle is managed by the framework. A parent component uses the [`useDialog`](/arc/frontend/react/) hook to show and await this dialog.

[`CommandDialog`](/components/commanddialog/) from `@cratis/components` does the heavy lifting:

- It creates and executes the `RegisterAuthor` proxy
- [`InputTextField`](/components/commandform/) renders typed form fields bound to command properties
- It runs the frontend-side validation defined in the proxy
- It calls the [Arc command pipeline](/arc/backend/commands/command-pipeline/) when the user confirms
- `onSuccess` receives the response payload only after command execution succeeds
- It surfaces any backend validation errors directly in the form
- It gives the user a success or error response without you writing any `fetch` calls

A parent can await the returned identity and display a confirmation:

```tsx
// Authors/Registration/RegisterAuthorButton.tsx
import { useState } from 'react';
import { DialogResult, useDialog } from '@cratis/arc.react/dialogs';
import { Guid } from '@cratis/fundamentals';
import { AddAuthor } from './AddAuthor';

export const RegisterAuthorButton = () => {
    const [AddAuthorDialog, showAddAuthor] = useDialog<Guid>(AddAuthor);
    const [registeredId, setRegisteredId] = useState<Guid>();

    const handleAdd = async () => {
        const [dialogResult, authorId] = await showAddAuthor();
        if (dialogResult === DialogResult.Ok && authorId) {
            setRegisteredId(authorId);
        }
    };

    return (
        <>
            <button type="button" onClick={handleAdd}>Register author</button>
            {registeredId && <p role="status">Registered author {registeredId.toString()}</p>}
            <AddAuthorDialog />
        </>
    );
};
```

`useDialog<Guid>` describes the value supplied to `closeDialog`. In the dialog, that value is the **second** generic parameter of `useDialogContext<object, Guid>`; its first parameter describes the request. The command result envelope stays inside `CommandDialog` — this parent receives the author ID itself.

---

## Step 4 — Integration Specs

Use an in-process command scenario to prove that the response identity and appended event agree. In a separate spec project referencing the Library project, add `Cratis.Specifications.XUnit`, `Cratis.Arc.Chronicle.Testing`, and `Cratis.Arc`, alongside the xUnit test runner. The [event-sourced testing guide](/arc/backend/testing/event-sourced-commands/) explains this setup and how direct decision specs complement it.

```text
Library.Specs/Authors/Registration/when_registering/
├── and_author_does_not_exist.cs
└── and_author_name_already_exists.cs
```

```csharp
// when_registering/and_author_does_not_exist.cs
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Commands;
using Cratis.Arc.Testing.Commands;
using Cratis.Chronicle.Events;
using Cratis.Specifications;
using Xunit;
using Library.Authors;
using Library.Authors.Registration;

namespace when_registering;

public class and_author_does_not_exist : Specification
{
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    CommandResult _result = null!;

    async Task Because() =>
        _result = await _scenario.Execute(new RegisterAuthor("J.R.R.", "Tolkien"));

    [Fact] void should_succeed() => _result.ShouldBeSuccessful();

    [Fact] void should_append_one_event() => _scenario.AppendedEvents.Count.ShouldEqual(1);

    [Fact] async Task should_record_the_names_under_the_returned_identity()
    {
        var authorId = ((CommandResult<AuthorId>)_result).Response!;
        authorId.ShouldNotEqual(AuthorId.NotSet);
        await _scenario.ShouldHaveAppendedEvent<RegisterAuthor, AuthorRegistered>(
            (EventSourceId)authorId,
            @event => @event.FirstName.Value == "J.R.R." && @event.LastName.Value == "Tolkien");
    }

    void Destroy() => _scenario.Dispose();
}
```

Then establish the same name under an existing author and check the precise rejection:

```csharp
// when_registering/and_author_name_already_exists.cs
using Cratis.Arc.Chronicle.Testing.Commands;
using Cratis.Arc.Commands;
using Cratis.Arc.Testing.Commands;
using Cratis.Chronicle.Events;
using Cratis.Chronicle.EventSequences;
using Cratis.Chronicle.Testing.EventSequences;
using Cratis.Specifications;
using Xunit;
using Library.Authors;
using Library.Authors.Registration;

namespace when_registering;

public class and_author_name_already_exists : Specification
{
    readonly CommandScenario<RegisterAuthor> _scenario = new();
    readonly AuthorId _existingAuthor = AuthorId.New();
    CommandResult _result = null!;

    Task Establish() => _scenario.EventScenario.Given
        .ForEventSource((EventSourceId)_existingAuthor)
        .Events(new AuthorRegistered("J.R.R.", "Tolkien"));

    async Task Because() =>
        _result = await _scenario.Execute(new RegisterAuthor("J.R.R.", "Tolkien"));

    [Fact] void should_report_the_name_constraint() =>
        _result.ShouldHaveConstraintViolationFor(nameof(UniqueAuthorName));

    [Fact] Task should_leave_only_the_original_event() =>
        _scenario.EventLog.ShouldHaveTailSequenceNumber(EventSequenceNumber.First);

    void Destroy() => _scenario.Dispose();
}
```

Run `dotnet test Library.Specs`. These scenarios use the in-process Chronicle kernel — no Docker or MongoDB — and check both the rejection reason and the unchanged event log. The normal `Specification` lifecycle runs `Establish`, `Because`, the fact, and `Destroy`; dispose the scenario in `Destroy`. Add provider-backed and HTTP tests to cover the application's actual storage and transport.

---

## Summary

| Layer | Artifact | Technology |
| ----- | -------- | ---------- |
| Domain event | `AuthorRegistered` | [Chronicle](/chronicle/) [`[EventType]`](/chronicle/events/) |
| Command + handler | `RegisterAuthor` with `Handle()` | [Arc](/arc/) [`[Command]`](/arc/backend/commands/model-bound/) model-bound |
| Input validation | `RegisterAuthorValidator` | [Arc](/arc/) [`CommandValidator<T>`](/arc/backend/commands/command-validation/) + FluentValidation |
| Uniqueness constraint | `UniqueAuthorName` | [Chronicle](/chronicle/) [`IConstraint`](/chronicle/constraints/) |
| React form | `AddAuthor.tsx` | [`@cratis/components`](/components/) [`CommandDialog`](/components/commanddialog/) |

The entire write side — event, validator, constraint, command — is in one file. The frontend is one component that imports one generated proxy. With discovery and proxy generation configured, the framework connects the HTTP command, validation, and event append; the slice stays focused on registration.

**Next**: [State View — List Authors](../state-view)
