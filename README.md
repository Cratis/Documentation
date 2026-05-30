# Documentation Site project

The Cratis documentation site. Documentation is kept close to the code it documents, so each
Cratis repository carries its own `Documentation/` folder; this repo aggregates them into one site.

> **The site is being migrated to a modern [Astro Starlight](https://starlight.astro.build/)
> build, which lives in [`web/`](./web/).** Start there — see **[`web/README.md`](./web/README.md)**
> for prerequisites and how to run it locally. The legacy DocFX site under `Source/` is documented
> at the bottom of this file and remains the currently-deployed site until cutover.

## Run the new site locally (short version)

The new site reads each product's `Documentation/` from a sibling clone, so check the product repos
out next to this one, all on the `docs-overhaul` branch, then run the site:

```shell
# layout: <parent>/{Documentation, Chronicle, Arc, Components, Fundamentals, .github}
for r in Chronicle Arc Components Fundamentals .github; do (cd "$r" && git checkout docs-overhaul); done

cd Documentation/web
npm install
npm run dev        # http://localhost:4321
```

Verify with `npm run check` (build + docs lint + link check). Full details, including the
verification checklist, are in [`web/README.md`](./web/README.md).

---

## Legacy DocFX site (`Source/`)

The original site is built with [DocFX](https://dotnet.github.io/docfx/) and the
[SingulinkFX](https://github.com/Singulink/SingulinkFX) template, aggregating per-product docs via
git submodules. Check out recursively:

```shell
git clone --recursive https://github.com/cratis/Documentation.git
# or, after a plain clone:
git submodule update --init --remote --recursive
```

For local development, navigate to the `Source` folder, run `yarn restore`, then `yarn watch` and
open [http://localhost:8080](http://localhost:8080). Everything is configured through `Source/docfx.json`.

This DocFX site is being replaced by the Starlight site in `web/`.
