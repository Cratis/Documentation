# Documentation Migration — ship it in a week 🚀

We're migrating the entire Cratis documentation to the new **Astro Starlight** site (in `Documentation/web/`) and getting it **launch-ready**. The content is split across repos, so this folder splits the work the same way: **one folder per content source**, each with its own plan and task list, so we can work in parallel without stepping on each other.

> **Goal:** the whole migrated documentation site is **out the door in a week**. Pick a folder, own it end-to-end, keep the build green.

## How the work is split

| Folder | Owns | Source of content |
|---|---|---|
| [`Chronicle/`](./Chronicle/README.md) | Event-sourcing engine docs | `Chronicle/Documentation/` |
| [`Arc/`](./Arc/README.md) | Full-stack CQRS framework docs | `Arc/Documentation/` (the `ApplicationModel` repo) |
| [`Components/`](./Components/README.md) | React component library docs | `Components/Documentation/` |
| [`CLI/`](./CLI/README.md) | CLI docs | `cli/Documentation/` |
| [`Fundamentals/`](./Fundamentals/README.md) | Shared .NET/TS utilities docs | `Fundamentals/Documentation/` |
| [`Contributing/`](./Contributing/README.md) | Contributing guide | `.github/` (the `Cratis/.github` repo) |
| [`Cratis-Stack/`](./Cratis-Stack/README.md) | The front door + everything the **Documentation repo owns** | `Documentation/web/src/content/docs/*.{md,mdx}` |

Each plan is self-contained: scope, what's already done, a prioritized task checklist, known gotchas, and a definition of done.

## How to work on a slice (the shared workflow)

The operating knowledge is codified as **AI rules and skills** in `Documentation/.ai/` (surfaced to Copilot and Claude Code) — use them:

1. **Edit the source** in the owning product repo (NOT the generated `web/src/content/docs/<product>/`). See the **`editing-cratis-docs`** rule/skill for the URL→file map.
2. **Preview:** `cd Documentation/web && npm run dev` → http://localhost:4321.
3. **Verify:** `npm run check` — must end **0 errors · 0 broken links** (≈187 advisory style warnings are fine). Restart `npm run dev` afterwards (the gate's re-sync degrades a live dev server).
4. **Visual QA:** `node web/scripts/screenshot.mjs <url> /tmp/x.png dark` (and `light`) — see the **`qa-cratis-docs`** skill.
5. **Write to the bar:** tour voice (teach, don't dump), correct Diátaxis type, diagrams for concepts, and **every code example verified against real source** (the `writing-correct-examples` rule).

## Status legend

✅ done · 🟡 in progress / needs polish · ⬜ todo · 🔧 needs build env / external (deploy, API gen, Storybook)

## Cross-cutting (owned by whoever picks them up — track here)

- ⬜ **Rewrite the comparison pages** (`comparisons/{marten,wolverine,kurrent}`) against how those tools work *today*. → owned in [`Cratis-Stack/`](./Cratis-Stack/README.md).
- 🔁 **Snippet-correctness audit** — recurring; every code example verified vs real Studio/Arc/Components source. Each product plan carries its share.
- 🔧 **Deploy** — GitHub Pages workflow (`Documentation/.github/workflows/docs-site.yml`) is ready; needs Pages enabled + a `DOCS_CHECKOUT_TOKEN` secret. → [`Cratis-Stack/`](./Cratis-Stack/README.md).
- 🔧 **API reference generation** (.NET DocFX + TS TypeDoc) and **Storybook embed** — need a build environment; tracked per product.

## Launch definition of done

- [ ] Every product folder's plan is at ✅ (or its remaining items are explicitly post-launch).
- [ ] `npm run check` green: **0 errors · 0 broken links**.
- [ ] Site reviewed visually in light **and** dark (front door + one page per product).
- [ ] Comparison pages are accurate.
- [ ] Deploy works (Pages enabled, secret set, the workflow runs green).
- [ ] `llms.txt` / `llms-full.txt` build and list the docs.

Let's GO. 🟢
