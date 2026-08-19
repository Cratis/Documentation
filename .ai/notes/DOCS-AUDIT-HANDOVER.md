> [!NOTE]
> **Historical record — written 2026-07-16. Not a live plan. Do not paste this as a prompt.**
>
> This handover was written to be pasted into a fresh session as a working brief. **It is no
> longer safe to use that way** and is preserved only as a record of the plan that existed on
> 2026-07-16. It was never tracked in git until this commit.
>
> **The backlog it carries is largely unexecuted.** A follow-up sweep found roughly **12 of
> 49** of the companion audit's checks now passing, with close to **0% attributable to this
> plan** — the passing ones were fixed by unrelated work. A spot-check on 2026-08-19
> confirmed five of the P0 items are still open on the relevant repositories' `main`
> branches.
>
> **The mechanics described in section 2 are the most perishable part.** Paths, the sync
> script's behaviour, the routing table, and the verify loop were accurate on 2026-07-16 and
> may have changed. Verify against the current repository before relying on any of it.
>
> The companion audit is at `.ai/notes/DOCS-AUDIT-2026-07.md`.

# Handover — Cratis documentation improvement (from the 2026-07-16 audit)

> **How to use this file.** Paste it as your first message in a fresh session opened at
> `/Volumes/sourcecode/repos/cratis`. It carries everything you need: the mission, the
> non-obvious mechanics of this docs system, which repo each fix lives in, the verify loop,
> and a prioritized backlog. The exhaustive, file-cited findings live in
> **`Documentation/DOCS-AUDIT-2026-07.md`** — read it before starting. Do the P0 items first.

---

## 1. Mission

Raise the Cratis documentation from "good" to "excellent" by executing the audit backlog.
The site is already strong (great front door, strong flagship pages, well-crafted brand
theme, clean internal links). The work is: fix a handful of correctness bugs, close one
systemic metadata gap, repair structural collisions, and lift the machine-converted
reference tree toward the tour-voice bar. **Do not restyle the site or rewrite the good
pages** — this is a punch-list, not a redesign.

Work in **small, reviewable PRs, grouped by theme** (e.g. "fix broken code examples",
"add descriptions to Chronicle", "un-orphan CLI scenarios"). Verify every change.

---

## 2. How this docs system works (read this — it is not obvious)

- The site is **Astro Starlight** in `Documentation/web/`. It **aggregates** docs from each
  product repo. Run everything from `Documentation/web`.
- **Source of truth = each product repo's `Documentation/` folder.** A build step
  (`web/scripts/sync-content.mjs`) converts that DocFX-style Markdown into Starlight content
  under `web/src/content/docs/<product>/`.
- **`web/src/content/docs/<product>/` is GENERATED and git-ignored. NEVER edit it.**
  Edit the product source, then re-sync. (The audit's `src/content/docs/...` citations are
  where a page *renders*; fix it at its *source* path — see the routing table below.)
- **Exception — site-level pages are authored directly in `web/` and tracked in git:**
  `web/src/content/docs/*.mdx|*.md` (index, why-cratis, cratis-stack, adopting-cratis,
  compatibility, whats-new, studio, faq, learning-paths, glossary.md, …) plus the
  `scenarios/`, `authproxy/`, and `tools/` subtrees, and the navigation in
  `web/astro.config.mjs`. These you edit in the Documentation repo itself.
- **Product source resolves sibling-first, submodule-fallback.** The sync prefers a sibling
  clone at `/Volumes/sourcecode/repos/cratis/<Repo>/Documentation` (so the branch you have
  checked out wins); if absent it falls back to the git submodule inside `Documentation/`.
- **The converter copies `description` frontmatter only if the source already has it — it
  never synthesizes one.** So every "missing description" fix must be made in source.

### Routing table — where each area's source lives

| Area (renders at) | Edit the source in | Notes |
|---|---|---|
| `chronicle/**` | `Chronicle/Documentation/` | Client SDK pages (`clients/kotlin|elixir|typescript`) come from the **Chronicle.Kotlin / .Elixir / .TypeScript** repos via `web/scripts/chronicle-client-docs-config.mjs`. |
| `arc/**` | `Arc/Documentation/` | The "Arc" repo is the ApplicationModel repo cloned as `Arc`. |
| `components/**` | `Components/Documentation/` | Component source for verifying APIs: `Components/Source/<Component>/`. |
| `cli/**` | `cli/Documentation/` | |
| `fundamentals/**` | `Fundamentals/Documentation/` | |
| `architecture/**` | `Architecture/Documentation/` | |
| `screenplay/**` | `Screenplay/Documentation/screenplay/` | |
| `prompter/**` | `Prompter/Documentation/` | |
| `contributing/**` | the **Cratis/.github** repo (submodule `GitHubLanding`) | `release-digests/` are machine-generated. |
| site pages, `scenarios/**`, `authproxy/**`, `tools/**`, nav | **`Documentation/web/` itself** (tracked) | Edit directly here. |

---

## 3. The verify loop (do this for every change)

```bash
cd Documentation/web
npm install                     # first time only
npm run dev                     # or: npm run sync   (regenerates content from source)
# ...make the edit in the SOURCE location, then:
npm run sync                    # or restart dev; re-converts from source
npm run check                   # build + lint:docs + check:links + lint:prose + lint:markdown + check:external + chronicle-client-docs
```

**Gate caveats you must know (discovered in the audit):**
- `npm run check` **cannot pass on a plain build** in isolation — its internal-link check
  reports `/api/*` and `/storybook*` links as broken unless you also run `npm run build:api`
  and `npm run build:storybooks` first. Those links are live (200) in production. Either run
  those builds before `check:links`, or verify the 8 known link "failures" are only those
  paths.
- **`lint:prose` (Vale) and `check:external` (lychee) silently no-op if the tools aren't
  installed** (they print "not installed — skipping" and pass). Install Vale + lychee to
  actually exercise prose and external-link gates locally, or rely on CI.
- The sync prints `1 broken toc entries dropped` — that's the Fundamentals TS "Coordinate"
  entry (P2 item). It should read `0` once fixed.
- **Verify code examples against real source before "fixing" them.** The audit already
  distinguished real bugs from correct-but-suspicious code; when in doubt, grep the product
  `Source/` (e.g. `Arc/Source/JavaScript`, `Components/Source`) to confirm an API exists.
- **Branch caveat:** the audit ran with product siblings on feature branches, not `main`.
  Confirm which branch each product repo is on and target the right one; the production site
  builds from `main`.

**Definition of done for a change:** source edited (not generated), `npm run sync` clean,
`npm run check` green (0 errors, 0 broken links, `0 broken toc`), page sits in the right nav
bucket, and any code example is verified against source. Follow the repo's American-English,
sentence-case-headings, and descriptive-link-text rules.

---

## 4. The quality bar (read these first)

In `Documentation/.ai/rules/`:
- `writing-cratis-docs.md` — the tour voice (pain→relief, why-before-how, honest limits),
  Diátaxis page types, and the Starlight authoring components (`<Steps>`, `<Tabs>`,
  `<FullStackTabs>`, diagrams).
- `documentation-structure-and-formatting.md` — frontmatter, no-body-H1, headings/ToC,
  asides, code fences, links, trailing newline.
- `writing-correct-examples.md` — verify every framework API against real source.

Relevant skills (invoke via the skill tooling): `edit-cratis-docs`, `add-cratis-docs-page`,
`qa-cratis-docs` (headless light/dark visual QA), `write-documentation`.

---

## 5. The backlog (prioritized)

Full detail with every `file:line` and a concrete fix is in
**`Documentation/DOCS-AUDIT-2026-07.md`**. Condensed here so this handover stands alone.

### P0 — Correctness & things users hit (do first; mostly small diffs)

1. **Broken/invented copy-paste code**
   - **Components:** the removed `import { Column } from 'primereact/column'` appears in **9
     places** — replace with `import { Column } from '@cratis/components/DataTables'`.
     (`components/displaying-data.md:17`, `list-screen-with-actions.md:19`,
     `tutorial/list-it.mdx:18`, `tutorial/list-and-detail.mdx:33`,
     `DataTables/data-table-for-query.md:24`, `data-table-for-observable-query.md:24`,
     `DataPage/index.md:26,57`, `DataPage/menu-items.md:13` — all under `Components/Documentation/`.)
   - **Arc:** `arc/frontend/react/command-form/validation.md` invents `CommandResult.hasErrors()`
     / `getErrorsFor()` (use `validationResults` / form-context `getFieldError`);
     `form-lifecycle.md` documents a non-existent `beforeExecute` (the real prop is
     `onBeforeExecute`, a value transform) and imports from `@cratis/arc/commands` instead of
     `@cratis/arc.react/commands`. Source: `Arc/Documentation/`.
   - **Components:** `DataTables/column-configuration.md` documents PrimeReact's Column props,
     not the shipped `ColumnProps<TData>`; `Dropdown/index.md:181-192` uses PrimeReact's
     `<Dialog onHide>` instead of the Cratis dialog. Arc `commands/model-bound/index.md` uses
     `using OneOf;` where it should be `using Cratis.Monads;`.

2. **Unreachable / broken-in-build content**
   - **CLI:** add `Scenarios` (`href: scenarios/toc.yml`) and the `reference` Overview to
     `cli/Documentation/toc.yml` / `reference/toc.yml` — both sections are orphaned from nav.
   - **Arc:** 4 file-vs-folder URL collisions (`backend/mongodb.md`,
     `backend/proxy-generation/configuration.md`, `backend/chronicle/commands.md`,
     `frontend/core/queries.md`) — collapse each to one `index.md`, delete the sibling `.md`.
   - **Chronicle:** move the CI artifacts out of the user docs — `chronicle/statistics/`
     (coverage `<iframe>` to an unrouted file → 404) and `chronicle/benchmarks/` (raw
     HTML/JS/887-line JSON, no page).

3. **Factual contradictions / wrong statements**
   - Chronicle Event Revision "not implemented" (`concepts/event-sequence.md:48`) vs the
     working procedure in `events/revision.md` — reconcile.
   - Chronicle: three conflicting "three projection approaches"; `.AutoMap()` taught against
     the project's own rule in ~10 declarative pages; wrong "Subject" glossary definition
     (`concepts/glossary.md:85`); MongoDB-as-only-backend (`concepts/event-store.md:11`).
   - Site (edit in `web/`): `compatibility.mdx:26` says "TypeScript 6" — Arc ships **7.0.2**;
     `whats-new.mdx` "Latest" points to the 2nd-oldest of 6 digests; `why-cratis.mdx:58` /
     `cratis-stack.mdx:19` describe Studio ("Soon") in present tense.

4. **Shipped placeholders** — Arc `backend/proxy-generation.md:79,83` ("will be documented
   here"); Chronicle `projections/immediate-projections.md` "in progress" banner (page is
   ~half-written — finish it and drop the banner).

### P1 — Systemic hygiene (bulk passes)

- **Add `description` frontmatter to the 747/873 pages that lack it** (Chronicle 301, Arc 229,
  Components 77, Fundamentals 44, CLI 29, Architecture 29, Contributing 17, Screenplay 13,
  Scenarios 8). One sentence each, in **source**. Biggest single lever (SEO, social, llms.txt).
  Consider a script that adds a `description:` derived from the page's intro where missing.
- **Add `<FullStackTabs>` (synced C#↔generated-TS)** to the model-bound command/query/read-model
  reference pages — the differentiator is barely shown in the reference tree.
- **Add a Mermaid diagram per non-trivial concept page** (Components 2/91 and Fundamentals
  1/45 are the worst; also Chronicle concept pages listed in the report).
- **Sentence-case headings** (Title-Case is pervasive: ~197 in Chronicle projections/, 369
  across Components+CLI), **American-English** fixes, **tag untagged code fences**.

### P2 — Structure, IA & coverage

- **Re-group the nav** (`web/astro.config.mjs`): the "Cratis Stack" overview topic is an
  overloaded ~23-entry catch-all that buries AuthProxy/Studio/Screenplay. Promote real
  products; resolve the two competing "Scenarios" entry points.
- **De-duplicate** the overlapping "map" pages (index/why-cratis/cratis-stack/adopting),
  `showcase`≈`samples`, Arc's Core-vs-ASP.NET (×4) and twin aggregate pages, Chronicle's
  event-evolution (×3). **Reconcile the two CommandForm doc sets** (Components vs Arc) with a
  cross-link + one canonical field-props page.
- **Document the undocumented shipped surface** — Components `Display` (Avatar/Badge/Chip/
  ProgressBar/Skeleton/Tag) and `Notifications` (Toaster/toast/toastCommandResult) modules and
  3 CommandForm fields; decide Chronicle's Java-client story (0 pages, yet claimed).
- **Fix the dropped toc entry** — `Fundamentals/Documentation/typescript/toc.yml:6`
  ("Coordinate" → missing `coordinate.md`). **Contributing `release-digests/`**: curate into
  `/whats-new` and exclude the raw files, or give them a landing + toc + real titles.

### P3 — Tour-voice, depth & maturity framing

- Rewrite Fundamentals reference-dump openings; bring `fundamentals/typescript/index.md` to
  parity with the C# sibling.
- Arc: reframe controller-based framing to the model-bound default; flesh out the thin MVVM area.
- Components: remove speculative "(If implemented)" filler; add "when NOT to use".
- Split the oversized Chronicle model-bound pages (968–1171 lines); add diagrams to reducers.
- Badge Screenplay as **Preview**; fix `studio.mdx` to use `<CardGrid>` + `seti:` icons.
- Architecture: real landing paragraph; give CRARCH rules examples + rationale; de-dupe the
  two identical index tables; reconcile the 400- vs 200-line threshold.

### Tooling/process

- Make CI assert Vale + lychee are installed (or the scripts warn loudly); wire
  `build:api`/`build:storybooks` into the `check` chain (or teach `check-links` to skip those
  paths). Exempt `chronicle/code-analysis/**` from the `chronicle-client-docs` shared-doc
  audit (its C#-only analyzer docs are a false positive).

---

## 6. Recommended first PR (fast, high-impact)

Fix the **broken/invented code examples** (P0.1) — Components `primereact/column` ×9 and the
three Arc frontend bugs. Small diffs, verifiable against `Source/`, and they stop readers from
pasting non-working code. Verify each replacement compiles/type-checks against the real
exports, `npm run sync && npm run check`, then open one PR titled e.g.
"Fix broken/invented code examples in Components and Arc docs".

Then tackle the **CLI orphaned nav** (one `toc.yml` edit) and the **two site-page facts**
(`compatibility.mdx` TypeScript version, `whats-new.mdx` latest digest) — both trivial and
user-visible.

---

## 7. Deliverables from the audit (for reference)

- `Documentation/DOCS-AUDIT-2026-07.md` — full file-cited report (this backlog's source).
- Shareable dashboard: https://claude.ai/code/artifact/94c59811-039b-4555-9add-266868ac4af6
