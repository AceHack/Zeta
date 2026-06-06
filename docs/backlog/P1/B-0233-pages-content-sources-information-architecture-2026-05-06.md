---
id: B-0233
zetaid: 081KQX9B50008QG0R0001XDTDQ
priority: P1
status: open
title: "GitHub Pages discoverability - content sources and information architecture"
created: 2026-05-06
last_updated: 2026-05-08
parent: B-0154
depends_on: [B-0232, B-0301, B-0302, B-0303, B-0304]
classification: blocked-on-pages-workflow
decomposition: clean
children: [B-0301, B-0302, B-0303, B-0304]
type: friction-reducer
---

# B-0233 - Pages content sources

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

- `B-0301` owns the public source inventory and internal-source
  exclusion boundary.
- `B-0302` owns the stable URL route map and pre-indexing freeze.
- `B-0303` owns the contributor on-ramp information architecture
  for first-time readers.
- `B-0304` owns the selected-research publication queue and
  redaction gate for public Pages content.
