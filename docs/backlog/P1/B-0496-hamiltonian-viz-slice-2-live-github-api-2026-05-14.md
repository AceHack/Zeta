---
id: B-0496
zetaid: 081KRHWGX0008QG0R002GTT8CX
priority: P1
status: open
title: "Hamiltonian viz — slice-2: live GitHub API commit fetch → trajectory"
tier: product-demo
effort: M
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0436
depends_on: [B-0495]
composes_with: [B-0435, B-0494]
tags: [demo, hamiltonian, git, phase-space, alignment-ui, github-pages, html, js]
type: feature
---

# B-0496 — Hamiltonian viz slice-2: live GitHub API commit fetch

## What

Replace B-0495's mock data with live commit data fetched from
`/repos/{owner}/{repo}/commits` via GitHub API. Map each commit to a
phase-space point: x = commit date (normalized), y = number of changed
files (energy proxy). Render with the same canvas from slice-1.

## Acceptance criteria

- [ ] Fetches up to 30 recent commits on first tab open (lazy-loaded)
- [ ] Graceful fallback to mock data when API rate-limited (403/429)
- [ ] Commit tooltip shows SHA, author, date, files-changed on hover
- [ ] `dotnet build -c Release` → 0 warnings, 0 errors

## Pre-start checklist

- Prior-art: depends on B-0495 being closed.
- API pattern: mirrors `loadAlignmentTab()` lazy-load pattern.
