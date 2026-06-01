# Fundamentals docs — migration plan

**Scope:** the shared .NET/TS utilities (concepts, types, serialization, DI, metrics). Source lives in `Fundamentals/Documentation/`; published under `/fundamentals/**`. Fundamentals underpins everything — keep it approachable, not a dumping ground of API lists.

## Status

- ✅ **C# concept walkthrough** — `csharp/index` (define-your-first-concept) + `csharp/concepts` (the `ConceptAs<T>` pattern; the interchangeability snippet was dedented).
- 🟡 Reference (`csharp/types`, `csharp/serialization`, `csharp/metrics`, …) — migrated; flat reference voice.

## Remaining tasks (prioritized)

- [ ] 🟡 **TypeScript parity** — concepts/types/serialization on the TS side (Fundamentals is dual-stack; the docs lean C#). Show both stacks where a feature spans them.
- [ ] 🟡 **DI / type discovery** — `ITypes`, `IImplementationsOf<T>`, binding-by-convention — tour-voice intro + reference polish.
- [ ] 🟡 **Serialization** — the converters story (concepts, date/time-only) — keep it concrete with verified snippets.
- [ ] 🔁 **Snippet audit** vs `Fundamentals/Source`.

## Definition of done

- [ ] C# and TS each have a concept/types/serialization on-ramp.
- [ ] DI + type discovery have a tour-voice intro.
- [ ] `npm run check` green; reviewed light + dark.
