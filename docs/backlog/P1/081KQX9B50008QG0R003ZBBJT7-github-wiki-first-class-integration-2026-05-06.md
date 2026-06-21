---
id: 081KQX9B50008QG0R003ZBBJT7
priority: P1
status: open
title: "GitHub Wiki first-class integration after Pages launch"
created: 2026-05-06
last_updated: 2026-05-08
parent: 081KQGDBJ0008QG0R002NV04N9
depends_on: [081KQX9B50008QG0R001J6ARGX, 081KQX9B50008QG0R0001XDTDQ, 081KQX9B50008QG0R0004N4HNK]
classification: blocked-on-pages-primary-surface
decomposition: decomposed
children: [081KR2E4K0008QG0R00286HGNK, 081KR2E4K0008QG0R002MFK6AW]
owners: [docs, architect]
type: friction-reducer
---

# 081KQX9B50008QG0R003ZBBJT7 - GitHub Wiki first-class integration

Split the GitHub Wiki lane from the Pages lane so Pages can
ship first and Wiki can become a deliberate second surface.

## Work scope

This row owns Wiki seeding, repo-to-wiki sync strategy,
Pages-vs-Wiki division of responsibility, indexing
preconditions, and the Karpathy-style human-facing rendering
of internal markdown substrate.

## Acceptance criteria

- Initial Wiki pages are named and sourced.
- The integration mode is selected: repo-source-to-wiki or
  wiki-canonical-with-repo snapshot.
- Pages and Wiki content boundaries are explicit.
- Wiki indexing preconditions are verified before SEO success
  is attributed to Wiki.
