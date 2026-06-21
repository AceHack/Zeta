---
id: 081KQX9B50008QG0R0001XDTDQ
priority: P1
status: open
title: "GitHub Pages discoverability - content sources and information architecture"
created: 2026-05-06
last_updated: 2026-05-08
parent: 081KQGDBJ0008QG0R002NV04N9
depends_on: [081KQX9B50008QG0R001J6ARGX, 081KR2E4K0008QG0R0035QVX6S, 081KR2E4K0008QG0R000WYVJAF, 081KR2E4K0008QG0R001HV8DEG, 081KR2E4K0008QG0R001B503RK]
classification: blocked-on-pages-workflow
decomposition: clean
children: [081KR2E4K0008QG0R0035QVX6S, 081KR2E4K0008QG0R000WYVJAF, 081KR2E4K0008QG0R001HV8DEG, 081KR2E4K0008QG0R001B503RK]
type: friction-reducer
---

# 081KQX9B50008QG0R0001XDTDQ - Pages content sources

Define and implement the public information architecture for
the initial Pages site.

## Work scope

This row owns which repo docs become public Pages content,
which docs stay internal substrate, and how contributor
personas land on the right on-ramp without turning the first
site into a full marketing redesign.

## Acceptance criteria

- Initial source list is explicit: landing page, vision,
  alignment, glossary, selected research, and contributor
  on-ramp content.
- Excluded sources are explicit: memory, hygiene history,
  backlog, and other internal substrate.
- The site has stable URLs before indexing begins.
- Content selection serves the contributor personas already
  documented in the repo.

## Decomposition

- `081KR2E4K0008QG0R0035QVX6S` owns the public source inventory and internal-source
  exclusion boundary.
- `081KR2E4K0008QG0R000WYVJAF` owns the stable URL route map and pre-indexing freeze.
- `081KR2E4K0008QG0R001HV8DEG` owns the contributor on-ramp information architecture
  for first-time readers.
- `081KR2E4K0008QG0R001B503RK` owns the selected-research publication queue and
  redaction gate for public Pages content.
