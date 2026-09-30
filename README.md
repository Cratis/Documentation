# Cratis Documentation

This repository builds <https://www.cratis.io>, the documentation site for the Cratis stack. It is an [Astro Starlight](https://starlight.astro.build/) site in [`web/`](./web/).

Most of what the site publishes is written somewhere else. Each product keeps its documentation next to its code, in its own repository's `Documentation/` folder, and the site's build copies those folders in. Before you change a page, find out which repository owns it.

## Where a page is authored

| To change | Edit |
| --- | --- |
| A product page, such as `/chronicle/**`, `/arc/**`, `/components/**`, `/cli/**` or `/fundamentals/**` | The `Documentation/` folder of that product's repository. `PRODUCTS` in [`web/scripts/sync-content.mjs`](./web/scripts/sync-content.mjs) maps every product route to its source. |
| Code in a Chronicle or Arc language tab | The snippet folder in the owning client repository. [`web/variant-docs.yml`](./web/variant-docs.yml) lists them; for Chronicle, follow the `chronicle-client-docs` skill in [`.cratis/ai/skills/`](./.cratis/ai/skills/). |
| `/contributing/**` | The organization's `Cratis/.github` repository. |
| A site-level page, such as `/`, `/why-cratis/`, `/scenarios/**` or `/ai/**` | [`web/src/content/docs/`](./web/src/content/docs/) in this repository. |
| Site navigation, components, styling, redirects or build scripts | [`web/`](./web/) in this repository. |

Every product page on the live site has an edit link to its authored file. The product folders under `web/src/content/docs/` are regenerated on every build and ignored by Git, so edits there are lost.

## Preview the site

You need a supported Node.js release that satisfies the site's `engines` requirements, such as Node 24 LTS or newer (CI currently pins Node 23), and clones of at least `Chronicle`, `Arc`, `Components` and `Samples` next to this repository:

```shell
cd web
npm install
npm run dev        # syncs product content, then serves http://localhost:4321
```

The preview uses whichever branch each sibling clone has checked out. Nothing here switches those branches, and you should not switch them just to preview. Check what they are on first. [`web/README.md`](./web/README.md) has the full list of sibling repositories, what happens when one is missing, the checks to run for each kind of change, what CI runs, and which optional tools can skip.

The site builds and deploys through [`.github/workflows/docs-site.yml`](./.github/workflows/docs-site.yml). Pull requests to `main` get a build without a deploy. Merges to `main`, and documentation changes on `main` in the product repositories, publish the site.

## What else is in this repository

| Path | Purpose |
| --- | --- |
| `web/` | The documentation site. Start with [`web/README.md`](./web/README.md). |
| `.cratis/ai/` | The installed Cratis AI rules and skills, including the documentation-writing skills. [`web/README.md`](./web/README.md#use-the-installed-documentation-skills) explains how to use them. `AGENTS.md` holds the project context. |
| `Chronicle/`, `Arc/`, `Components/`, `Samples/` and the other folders listed in `.gitmodules` | Git submodules the site falls back to when a sibling clone is missing. They are empty until you initialize them and pinned to older commits when you do. |
| `Source/`, `Documentation.slnx` | The retired DocFX site. The active documentation workflow neither builds nor publishes it. Its guides now live on the site under [`/scenarios/`](https://www.cratis.io/scenarios/). [`Source/README.md`](./Source/README.md) has the details. |
| `global.json` | The .NET SDK version used by `npm run build:api`. |
| `discard-submodule-changes.sh` | Runs `git checkout -- .` and `git clean -fd` in every initialized submodule. It deletes uncommitted and untracked work there without asking. |
