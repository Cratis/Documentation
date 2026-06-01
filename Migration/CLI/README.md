# CLI docs — migration plan

**Scope:** the Cratis CLI. Source lives in `cli/Documentation/`; published under `/cli/**`. The CLI is an **operate/explore** tool for a *running* Chronicle store — **not** a scaffolder. Don't invent `cratis new`/`run`. Real commands: `cratis get-started`, contexts, event/observer/read-model inspection, `cratis init` (AI tooling). Scaffolding is `dotnet new` templates (the `Templates` repo).

## Status

- ✅ **Getting started** — guided tour (`.mdx`, OS-aware install `<Tabs>`, connection-resolution diagram, recap, cross-links).
- ✅ **Scenarios** (3) — fix-a-stuck-observer, replay-a-projection, verify-events-were-appended.
- 🟡 Per-command reference — migrated; flat.

## Remaining tasks (prioritized)

- [ ] 🟡 **Per-command reference organized by workflow** (not alphabetically) — group around what you're trying to *do* (inspect events, manage observers, replay/diagnose, set up AI tooling).
- [ ] 🟡 **More scenarios** — common operate-time tasks (diagnose a lagging projection, inspect an event source's history, switch contexts).
- [ ] 🟡 **`cratis init`** — document what it writes (CHRONICLE.md + instruction files for Claude Code/Copilot/Cursor/Windsurf + a `chronicle-diagnose` slash command). Cross-link the AI-native-development page. Verify against the real `AI/` repo + `Chronicle.Mcp`.
- [ ] 🔁 **Snippet/command audit** — verify every command + flag against the real CLI source.

## Definition of done

- [ ] Reference is workflow-organized and complete.
- [ ] `cratis init` + the MCP story documented and cross-linked.
- [ ] `npm run check` green; reviewed light + dark.
