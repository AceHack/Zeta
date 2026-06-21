---
id: 081KQX9B50008QG0R001J6ARGX
priority: P1
status: open
title: "GitHub Pages discoverability - Astro publish workflow"
created: 2026-05-06
last_updated: 2026-05-08
parent: 081KQGDBJ0008QG0R002NV04N9
depends_on: [081KQ3HBZ0008QG0R0022ZJ7KV]
classification: buildable-now
decomposition: decomposed
children: [081KR2E4K0008QG0R003VN9WC8, 081KR2E4K0008QG0R0032SWP2M]
type: friction-reducer
---

# 081KQX9B50008QG0R001J6ARGX - Astro Pages publish workflow

Implement and validate the GitHub Pages publishing path for
the chosen Astro static-site generator.

## Work scope

This row owns the workflow and build mechanics: Astro setup,
Pages artifact upload, deploy action, permissions,
concurrency, SHA-pinning, and the first successful HTTP 200
at the Pages URL.

## Acceptance criteria

- `.github/workflows/pages-deploy.yml` builds and deploys the
  site on push to `main` and `workflow_dispatch`.
- Actions are SHA-pinned where the factory hygiene rules
  require it.
- Permissions are minimal and explicit, including
  `contents: read`, `pages: write`, and `id-token: write`.
- The Pages URL returns HTTP 200 after deployment.
