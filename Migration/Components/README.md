# Components docs — migration plan

**Scope:** the React component library (PrimeReact-based, wired to Arc proxies). Source lives in `Components/Documentation/`; published under `/components/**`. Components sits **on top of Arc** — its tutorial builds the UI for the Arc tutorial's backend (consumes `AllAuthors`/`AllAuthorsWithBooks`).

## Status

- ✅ **Tutorial** (3 chapters + index) — `list-it`, `act-on-it`, `list-and-detail`.
- ✅ **Getting started**, **why-components**, **coming-from-primereact** (raw-PrimeReact-vs-Components bridge), **choosing-a-component** (decision guide).
- ✅ **Recipes** (displaying-data, list-screen-with-actions, multi-step-form, …) — fixed the wrong `@cratis/components` imports → `@cratis/components/DataTables`; added required `emptyMessage`/`title`/children.
- ✅ **DataPage** reference enriched (compound `DataPage.Columns`/`DataPage.MenuItems` + details panel); fixed the tutorial bug (`detailsComponent` is lowercase; `detailsTitle`/`initialSizes` aren't real props).
- 🟡 Reference (component pages) — migrated; needs the both-voices + accuracy pass.

## Remaining tasks (prioritized)

- [ ] 🟡 **CommandDialog / CommandForm** — field-type reference polish; validation timing; the **`initialValues` vs `onBeforeExecute`** footgun (values needed for `isValid` must come from `initialValues`, or the submit button stays disabled).
- [ ] 🟡 **Specialized components** — StepperCommandDialog, Toolbar, Dialogs, Dropdown, PivotViewer, SchemaEditor, TimeMachine — reference + one recipe each where evaluator-facing. (Skills exist: `stepper-command-dialog`, `toolbar`.)
- [ ] 🟡 **DataPage / DataTables deep-dive** — finish the compound-API coverage + a details-panel recipe.
- [ ] 🔁 **Snippet audit** — verify prop names against the compiled type defs (`Components/Source/dist/esm/**/*.d.ts`) and real usage in Studio `*.tsx` (`Users.tsx`, `Authentication.tsx`). Import rule: `DataTableForObservableQuery` from `@cratis/components/DataTables`; `DataPage`/`MenuItem` from `@cratis/components/DataPage` (the root barrel only re-exports namespaces).
- [ ] 🔧 **Storybook embed** — needs a deployed Storybook URL to iframe.

## Gotchas

- Never import `Dialog` from `primereact/dialog` — use `CommandDialog` from `@cratis/components/CommandDialog` (executes a command) or `Dialog` from `@cratis/components/Dialogs` (data collection). Colors must come from PrimeReact tokens (`var(--surface-*)`, etc.).

## Definition of done

- [ ] CommandDialog/CommandForm + the specialized components each have reference + (where evaluator-facing) a recipe.
- [ ] Every prop verified against the type defs.
- [ ] Storybook embed live (or explicitly post-launch).
- [ ] `npm run check` green; reviewed light + dark.
