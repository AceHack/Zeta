---
id: B-0295
zetaid: 081KR2E4K0008QG0R0038JGMJ8
priority: P1
status: open
title: "Pages discoverability - repository metadata and discovery surface"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0235
depends_on: [B-0232, B-0234]
classification: blocked-on-live-pages
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# B-0295 - Repository discovery surface

Wire the GitHub repository metadata to the public Pages site
so visitors, contributors, and search systems see one coherent
entry point.

## Acceptance criteria

- Repository homepage points at the live GitHub Pages URL.
- Repository description matches the Pages positioning without
  overclaiming production readiness.
- Repository topics include the honest technical discovery terms
  from B-0154.
- The repo-to-Pages path is documented so future metadata edits
  have an owner and review surface.
