---
id: 081KR2E4K0008QG0R0035QVX6S
priority: P1
status: open
title: "Pages content sources - public inventory and exclusion boundary"
created: 2026-05-08
last_updated: 2026-05-08
parent: 081KQX9B50008QG0R0001XDTDQ
depends_on: [081KQX9B50008QG0R001J6ARGX]
classification: blocked-on-pages-workflow
decomposition: atomic
owners: [architect, docs]
type: friction-reducer
---

# 081KR2E4K0008QG0R0035QVX6S - Pages public source inventory

Create the first explicit inventory of repository documents that are
eligible for the public GitHub Pages site, along with the hard exclusion
boundary for internal substrate.

## Acceptance criteria

- Public source inventory names the initial landing, vision, alignment,
  glossary, contributor on-ramp, and selected research source files.
- Internal exclusions are explicit for `memory/`, `docs/hygiene-history/`,
  `docs/backlog/`, `docs/claims/`, and operational loop state.
- Each eligible source has a short reason it belongs on the public site.
- Each excluded class has a short reason it stays internal substrate.
- The inventory is repo-native and can be consumed by later route and SEO
  work without scraping prose from 081KQGDBJ0008QG0R002NV04N9.

## Out of scope

- Rendering pages.
- Writing SEO metadata.
- Choosing final URL slugs beyond enough naming to unblock 081KR2E4K0008QG0R000WYVJAF.
