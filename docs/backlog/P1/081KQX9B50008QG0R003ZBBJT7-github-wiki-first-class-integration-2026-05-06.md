---
id: B-0237
zetaid: 081KQX9B50008QG0R003ZBBJT7
priority: P1
status: open
title: "GitHub Wiki first-class integration after Pages launch"
created: 2026-05-06
last_updated: 2026-05-08
parent: B-0154
depends_on: [B-0232, B-0233, B-0234]
classification: blocked-on-pages-primary-surface
decomposition: decomposed
children: [B-0299, B-0300]
owners: [docs, architect]
type: friction-reducer
---

# B-0237 - GitHub Wiki first-class integration

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
