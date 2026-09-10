# Documentation — project context

The source of https://cratis.io — the Cratis documentation website (Astro +
Starlight), covering the whole stack: Chronicle, Arc, Components, Fundamentals,
the model-first layer, the AI offering, Chronicle MCP, and Prompter.

## Layout

- `web/` — the Astro/Starlight site (`web/src/content/docs/` holds the pages)
- Documentation pages follow Diátaxis: classify every page as tutorial,
  how-to, reference, or explanation, and write it in that style (the
  `cratis/documentation` profile carries the guidance).

## Chronicle client documentation

Chronicle docs use one language-neutral explanation with synchronized
language tabs for client-specific code. The shared narrative pages live in
`Chronicle/Documentation/**`; each client repository owns its own snippet
text and compiles it against that client. The repository-local
`chronicle-client-docs` skill (under `.agents/skills/`) carries the full
workflow for editing client-tabbed pages.

## Commands

```bash
cd web
yarn install
yarn dev      # local dev server
yarn build    # production build (CI builds and deploys on merge)
```

The site deploys through `docs-site.yml`; a documentation change merges to
`main` and publishes.

## AI-assisted development

This repository uses the Cratis AI contract:

- **`.cratis/ai.json`** records the subscription — `cratis/documentation` for docs-writing guidance plus the `cratis/engineering/typescript` maintainer cell for the site code.
- **`.cratis/PROJECT.md`** (this file) is the canonical project context; the root `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` are minimal bootstraps that point here and do nothing else.
- There is **no local AI corpus and no generated tool adapters** in this repository. Shared skills arrive through the Cratis AI marketplace plugins (Claude Code, Codex, GitHub Copilot, Cursor, and Pi are installable today — see the [harness guide](https://www.cratis.io/ai/harnesses/)).

For contributors:

1. Install the Cratis plugin for your harness once (per the harness guide); the subscribed profiles' skills then load automatically when tasks match.
2. General, reusable improvements are proposed in [`Cratis/AI`](https://github.com/Cratis/AI) — never copied into, or synchronized from, this repository.
3. Repository-specific facts and conventions belong in this file; repository-local skills live under `.agents/skills/`.
4. AI session work records (plans, handovers, session notes, scratch analyses) stay in the untracked `.ai-work/` folder and never enter git; a durable follow-up becomes a GitHub issue.
