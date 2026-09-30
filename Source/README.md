# Source: the retired DocFX site

> [!WARNING]
> **Historical. The active documentation workflow does not build, check or publish anything in this folder.** Do not edit it expecting a change on <https://www.cratis.io>. The old toolchain can still be run by hand (see the end of this page), but its output is not the published site.

This folder held the first Cratis documentation site, built with [DocFX](https://dotnet.github.io/docfx/). The [Astro Starlight site in `web/`](../web/README.md) replaced it. The workflow that built this folder, `.github/workflows/pages.yml`, was first limited to manual runs and then removed on 2026-06-07 (commit `e534ea3`). The current workflow, `.github/workflows/docs-site.yml`, never reads `Source/`.

The files stay in the repository as a record. Their scripts, snippet placeholders and Storybook front matter are not processed by the current site, and their code examples have not been kept up to date.

## Where the content went

| Here | Maintained version |
| --- | --- |
| `docs/Guides/index.md` | [Scenarios](https://www.cratis.io/scenarios/), authored in `web/src/content/docs/scenarios/index.md` |
| `docs/Guides/CamelCasing/` | [Camel casing](https://www.cratis.io/scenarios/camel-casing/), in `web/src/content/docs/scenarios/camel-casing/` |
| `docs/Guides/Chat/` | [Real-time chat](https://www.cratis.io/scenarios/chat/), in `web/src/content/docs/scenarios/chat/` |
| `docs/Guides/VerticalSlices/` | [Vertical slices](https://www.cratis.io/scenarios/vertical-slices/), in `web/src/content/docs/scenarios/vertical-slices/` |
| `docs/Documentation/` (building and contributing to the docs) | [`web/README.md`](../web/README.md) and the documentation skills in [`.cratis/ai/skills/`](../.cratis/ai/skills/) |
| `docs/Documentation/code-snippets.md` (`{{snippet:name}}` placeholders) | Client-owned snippet files rendered as language tabs, configured in [`web/variant-docs.yml`](../web/variant-docs.yml); the site's sample catalog comes from the `Samples` repository's `samples.json` and is shown at [Samples](https://www.cratis.io/samples/) |
| `docs/storybook-integration.md`, `docs/storybook-quick-start.md`, `docs/test-storybook/`, `docs/Documentation/test-storybook/` (`storybook:` front matter) | The `StorybookEmbed` component in `web/src/components/`, the `npm run build:storybook` scripts described in [`web/README.md`](../web/README.md#api-reference-and-storybook), and the [Components Storybook page](https://www.cratis.io/components/storybook/) |
| `api/`, `docfx.json`, `site.csproj` (API reference) | `npm run build:api` and `web/api-build/`, published at [API reference](https://www.cratis.io/api-reference/) |
| `docs/Arc`, `docs/Chronicle`, `docs/CLI`, `docs/Components`, `docs/Contributing`, `docs/Fundamentals` | Symbolic links into the submodules. Product documentation is authored in each product's own repository. |

The scenario pages started as copies of these guides and have been revised since. Use the maintained scenario pages for current guidance.

## If you need the old site

The last workflow definition is in Git history (`git show e534ea3^:.github/workflows/pages.yml`). It ran `yarn install` in this folder, whose `postinstall` script built the whole DocFX site, and it committed and pushed submodule updates as part of the run. The active workflow no longer exercises this toolchain, and it may no longer work.
