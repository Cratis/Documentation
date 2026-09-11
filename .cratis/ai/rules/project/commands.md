---
applyTo: "**/*"
---

## Commands

```bash
cd web
yarn install
yarn dev      # local dev server
yarn build    # production build (CI builds and deploys on merge)
```

The site deploys through `docs-site.yml`; a documentation change merges to
`main` and publishes.
