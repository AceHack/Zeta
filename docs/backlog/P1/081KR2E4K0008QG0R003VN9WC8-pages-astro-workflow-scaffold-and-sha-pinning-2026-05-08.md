---
id: B-0274
zetaid: 081KR2E4K0008QG0R003VN9WC8
priority: P1
status: open
title: "Pages discoverability - Astro workflow scaffold and SHA pinning"
created: 2026-05-08
last_updated: 2026-05-08
parent: B-0232
depends_on: [B-0047]
classification: buildable-now
decomposition: atomic
type: friction-reducer
---

# B-0274 - Astro workflow scaffold

Create the GitHub Pages deployment workflow skeleton for Astro,
including minimal permissions and SHA-pinned actions.

## Acceptance criteria

- Workflow file exists with build+deploy steps.
- Required permissions are explicit and minimal.
- Action references are SHA-pinned where required.
