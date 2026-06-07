# Cratis Documentation

The Cratis documentation site. Documentation is kept close to the code it documents, so each
Cratis repository carries its own `Documentation/` folder; this repo aggregates them into one
Astro Starlight site.

The site lives in [`web/`](./web/). Start with [`web/README.md`](./web/README.md) for
prerequisites, local development, and verification.

## Run the site locally

The site reads each product's `Documentation/` from a sibling clone, so check the product repos out
next to this one on the branch you want to preview. For the released site, use `main`:

```shell
# layout: <parent>/{Documentation, Chronicle, Arc, Components, cli, Fundamentals, .github}
for r in Chronicle Arc Components cli Fundamentals .github; do (cd "$r" && git checkout main); done

cd Documentation/web
npm install
npm run dev        # http://localhost:4321
```

Verify with `npm run check` (build + docs lint + link check). Full details, including the
verification checklist, are in [`web/README.md`](./web/README.md).
