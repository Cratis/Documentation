---
name: chronicle-client-docs
description: Use this skill whenever adding, changing, reviewing, or validating Chronicle documentation that shows client SDK code across C#, Java, Kotlin, Elixir, TypeScript, or future Chronicle clients. Trigger on Chronicle client snippets, language tabs, <ChronicleClientTabs>, multi-client examples, client-specific docs ownership, or adding another Chronicle client to the shared docs.
---

# Chronicle Client Documentation

Chronicle docs use one language-neutral explanation with synchronized language tabs for client-specific code. The Chronicle repo owns the shared narrative page; each client repo owns its own snippet text and compiles it against that client.

Use this workflow when editing any Chronicle page that shows client SDK code.

## Ownership Model

- Shared, language-neutral page prose lives in `Chronicle/Documentation/**`.
- C# snippets live in `Chronicle/Documentation/client-snippets/**`.
- Kotlin snippets live in `Chronicle.Kotlin/Documentation/client-snippets/**`.
- Java snippets live in `Chronicle.Kotlin/Documentation/client-snippets-java/**`; the JVM client repo owns both Java and Kotlin examples.
- Elixir snippets live in `Chronicle.Elixir/Documentation/client-snippets/**`.
- TypeScript snippets live in `Chronicle.TypeScript/Documentation/client-snippets/**`.
- .NET-specific public client pages live in `Chronicle/Documentation/clients/dotnet/**` and render under `/chronicle/clients/dotnet/**`.
- Kotlin-specific public client pages live in `Chronicle.Kotlin/Documentation/**` and render under `/chronicle/clients/kotlin/**`.
- Elixir-specific public client pages live in `Chronicle.Elixir/Documentation/**` and render under `/chronicle/clients/elixir/**`.
- TypeScript-specific public client pages live in `Chronicle.TypeScript/Documentation/**` and render under `/chronicle/clients/typescript/**`.
- Generated site files under `Documentation/web/src/content/docs/chronicle/**` are not source files. Do not edit them.

The shared Chronicle page decides where an example appears. The client repo decides what code appears for that language.

The Documentation repo owns the coordination contract in `web/chronicle-client-docs.yml`. That manifest is the source of truth for:

- participating client keys and labels
- client-owned snippet roots
- client-specific public docs roots
- shared topic links shown from the generated Client SDKs landing page
- public client-doc overlap baselines for shared-topic migration debt
- local validator commands
- the current `legacy/` snippet count baseline

Do not add a new Chronicle client by hardcoding it into individual scripts. Update the manifest and let the sync, audit, and aggregate check scripts read it.

## Core Rule

Shared Chronicle docs are language agnostic. Do not paste a raw `csharp`, `java`, `kotlin`, `elixir`, `typescript`, `ts`, or `cs` fenced code block into a shared Chronicle page for client SDK behavior.

Use one of these shapes instead:

- Shared concept with equivalent client API examples: `<ChronicleClientTabs snippet="..." />`.
- Genuine client-specific behavior: put the page under that client's public docs.
- Language-neutral examples: use prose, diagrams, JSON, YAML, shell commands, Mermaid, or projection declaration language directly.

If a shared page still has direct C# fences, treat it as migration debt. Do not add more.

## Add Or Change A Multi-Client Example

1. Edit the shared page in `Chronicle/Documentation/**`.
2. Add a placeholder where the example should appear:

   ```mdx
   <ChronicleClientTabs snippet="events/appending/example" />
   ```

3. Add matching snippet files in every participating client repo using the same extensionless snippet ID:

   ```text
   Chronicle/Documentation/client-snippets/events/appending/example.md
   Chronicle.Kotlin/Documentation/client-snippets-java/events/appending/example.md
   Chronicle.Kotlin/Documentation/client-snippets/events/appending/example.md
   Chronicle.Elixir/Documentation/client-snippets/events/appending/example.md
   Chronicle.TypeScript/Documentation/client-snippets/events/appending/example.md
   ```

4. Put exactly the code the reader should see in each snippet file, usually as one fenced code block.
5. Prefer `.md` for snippet files. Use `.mdx` only if the snippet file itself needs MDX syntax.
6. Keep the snippet ID extensionless in the shared page. The sync supports both `.md` and `.mdx`.

Use `clients="csharp,elixir"` only when a concept genuinely exists for only some clients:

```mdx
<ChronicleClientTabs snippet="events/appending/occurred" clients="csharp,elixir" />
```

Prefer keeping every generally supported client visible in shared pages. If a shared workflow is not implemented for one client yet, add a real snippet file for that client that says the feature is not supported yet instead of omitting the tab. This keeps the docs honest and makes the gap visible:

````md
```text
This Chronicle client does not support this workflow yet.
Track the client SDK issue before using this API from this language.
```
````

Use a custom `syncKey` only when tab groups on the same page should not follow each other. The default is `chronicle-client`, and that is usually correct.

## Do Not Split Equivalent Examples Into Client Sections

Do not create public client-specific pages just to hold equivalent snippets. The shared docs should stay unified; snippet folders are source-only and are skipped by the site.

Client-specific pages are only for content that is genuinely different for that client.

## Client-Specific Pages

Use client-specific pages only when the content is genuinely different for that client: installation details, runtime integration, language-specific APIs, idioms, decorators/annotations, framework integration, generated package behavior, or troubleshooting that does not apply to the other clients.

Those pages still belong to the client repo:

- `Chronicle/Documentation/clients/dotnet/**` renders under `/chronicle/clients/dotnet/**`.
- `Chronicle.Kotlin/Documentation/**` renders under `/chronicle/clients/kotlin/**`.
- `Chronicle.Elixir/Documentation/**` renders under `/chronicle/clients/elixir/**`.
- `Chronicle.TypeScript/Documentation/**` renders under `/chronicle/clients/typescript/**`.

The sync skips `Documentation/client-snippets/**`, so snippet files never become public pages.

When editing a client-specific page:

1. Edit the owning client repo's `Documentation/**` source.
2. Keep links relative inside that client docs tree; the site rewrites them to the `/chronicle/clients/<client>/` route.
3. Update the client repo's `Documentation/toc.yml` when the client has one. If there is no `toc.yml`, the site autogenerates that client's sidebar from the folder.
4. Run that repo's documentation/snippet validation when available.
5. Run `npm run build` in `Documentation/web` to verify the aggregate site.

If a page starts as client-specific but later applies to every client, move the explanation into the shared Chronicle page and replace duplicated code with `<ChronicleClientTabs />`.

## Validate Snippets

Each client repo has a validator:

```bash
python3 Documentation/validate-client-snippets.py
```

Run the validators for every client whose snippets changed. The validator should compile snippets against the owning client source, not just parse Markdown.

When local toolchains are missing, report that explicitly and rely on the client repo's `Client Snippet Verification` workflow:

- Kotlin requires Gradle / JDK.
- Java requires Gradle / JDK.
- Elixir requires Mix / Erlang / Elixir.
- TypeScript requires Node/Yarn dependencies.
- C# requires the Chronicle .NET SDK project to build.

Then run the site build from `Documentation/web`:

```bash
npm run chronicle-client-docs:check
npm run audit:chronicle-client-docs
npm run build
```

`npm run chronicle-client-docs:check` is the preferred aggregate gate. It runs the strict shared-doc audit, checks that `legacy/` snippet counts have not increased, and runs every configured client validator whose local toolchain is available. It reports missing Java, Mix, or similar local toolchains as blocked in local runs. CI should use:

```bash
npm run chronicle-client-docs:check:ci
```

The CI variant treats blocked validators as failures.

Use strict mode to see whether shared Chronicle docs are fully migrated:

```bash
npm run audit:chronicle-client-docs:strict
```

`audit:chronicle-client-docs` is a ratchet: it fails on missing client docs roots, missing snippets, or any increase in direct client-language fences in shared Chronicle docs. `audit:chronicle-client-docs:strict` fails while any shared direct client-language fences remain.

For visual changes, start or restart the dev server and inspect the page:

```bash
npm run dev -- --host 127.0.0.1
```

## Keep CI In Sync

Every client repo that owns snippets must have a `Client Snippet Verification` workflow that runs when either client source or snippet files change:

- `Documentation/client-snippets/**`
- `Documentation/validate-client-snippets.py`
- `Source/**`
- `.github/workflows/client-snippets.yml`

Every external client repo must also dispatch or otherwise trigger the Documentation repo docs build after snippet changes land on `main`, so the published site updates.

The Documentation repo docs workflow must checkout every client repo listed in `web/chronicle-client-docs.yml`.

## Add A New Chronicle Client

1. Add the client repository to the Documentation repo checkout/submodule setup.
2. Add the client to `Documentation/web/chronicle-client-docs.yml`.
3. Use a stable key such as `swift` or `go`, and choose the reader-facing tab/sidebar label.
4. Add `Documentation/client-snippets/**` to the client repo when it participates in shared tabs.
5. Add `Documentation/validate-client-snippets.py` that compiles snippets against that client source.
6. Add the client's `Client Snippet Verification` workflow.
7. Add the client's documentation dispatch workflow so `Documentation/**` changes rebuild the site.
8. Add or update snippet files for the shared Chronicle pages that should include the new client.
9. Run the affected client validators, `npm run chronicle-client-docs:check`, and `npm run build` in `Documentation/web`.

Do not split the public docs into one section per client just because the registry grows.

## Client Public Docs Stay Narrow

Client-specific public docs are for language/runtime details: installation, connection setup, framework integration, annotations/decorators, package behavior, generated APIs, and troubleshooting.

Chronicle concepts and feature workflows belong in the shared Chronicle docs. If a client page explains events, reactors, reducers, read models, projections, constraints, seeding, transactions, migrations, or compliance in a way that would help multiple clients, move that explanation into the shared page and leave only client-specific API notes behind.

`npm run chronicle-client-docs:check` audits client public docs for shared-topic overlap using the manifest's `publicDocsAudit` section. The count is a migration debt baseline: it may go down as pages are consolidated, but it must not increase.

When preserving an old client URL only to point readers to the shared docs, make it a bridge page with frontmatter:

```yaml
---
sharedTopicBridge: true
---
```

Bridge pages should not contain full client-specific examples. They should briefly state that the topic is shared, link to the canonical shared page, and link to client-specific setup/reference only when needed.

## Review Checklist

- The shared page owns prose, not client-specific API details.
- Shared Chronicle pages do not add new direct client-language fences.
- Shared pages include an explicit "not supported yet" snippet tab when a client lacks a workflow but readers need to see the gap.
- Client public docs do not add new concept/guide pages for shared Chronicle topics.
- .NET-specific pages live under `/chronicle/clients/dotnet/**`, not mixed into shared Chronicle docs.
- Each language's code lives in its client repo.
- Snippet files use the same extensionless ID across clients.
- `.md` is used unless `.mdx` is needed.
- Code examples are complete enough to compile under the owning validator.
- The synchronized tabs render on the shared page.
- No snippet folder becomes a public docs page.
- `npm run chronicle-client-docs:check` passes, or reports only missing local toolchains that CI covers.
- Local validation results and any missing toolchains are reported clearly.
