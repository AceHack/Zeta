---
id: 081KRHWGX0008QG0R002GTT8CX
priority: P1
status: open
title: "Hamiltonian viz — slice-2: live GitHub API commit fetch → trajectory"
tier: product-demo
effort: M
created: 2026-05-14
last_updated: 2026-05-14
parent: 081KRFA460008QG0R0009TXX5S
depends_on: [081KRHWGX0008QG0R001RHSSHT]
composes_with: [081KRFA460008QG0R001MC7D7R, 081KRHWGX0008QG0R0029WA0HQ]
tags: [demo, hamiltonian, git, phase-space, alignment-ui, github-pages, html, js]
type: feature
---

# 081KRHWGX0008QG0R002GTT8CX — Hamiltonian viz slice-2: live GitHub API commit fetch

## What

Replace 081KRHWGX0008QG0R001RHSSHT's mock data with live commit data fetched from
`/repos/{owner}/{repo}/commits` via GitHub API. Map each commit to a
phase-space point: x = commit date (normalized), y = number of changed
files (energy proxy). Render with the same canvas from slice-1.

## Acceptance criteria

- [ ] Fetches up to 30 recent commits on first tab open (lazy-loaded)
- [ ] Graceful fallback to mock data when API rate-limited (403/429)
- [ ] Commit tooltip shows SHA, author, date, files-changed on hover
- [ ] `dotnet build -c Release` → 0 warnings, 0 errors

## Pre-start checklist

- Prior-art: depends on 081KRHWGX0008QG0R001RHSSHT being closed.
- API pattern: mirrors `loadAlignmentTab()` lazy-load pattern.
