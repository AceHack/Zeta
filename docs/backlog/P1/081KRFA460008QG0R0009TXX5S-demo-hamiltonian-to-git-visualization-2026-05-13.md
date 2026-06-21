---
id: 081KRFA460008QG0R0009TXX5S
priority: P1
status: open
title: "Demo — Hamiltonian-to-git visualization (git history → phase-space rendering)"
tier: product-demo
effort: L
created: 2026-05-13
last_updated: 2026-05-14
parent: 081KR7JY10008QG0R001VP6JWG
depends_on: [081KRFA460008QG0R0005DWKBG]
children: [081KRHWGX0008QG0R001RHSSHT, 081KRHWGX0008QG0R002GTT8CX]
tags: [demo, hamiltonian, git, phase-space, alignment-ui, github-pages, html, js]
type: feature
---

# 081KRFA460008QG0R0009TXX5S — Hamiltonian-to-git visualization

## What

Render git commit history as Hamiltonian trajectories through phase space in
`demo/index.html`. Each commit is a point in the trajectory; the panel makes
the mathematical framing (compile-time consciousness threading via F# computation
expressions) visually legible to a non-specialist audience.

## Acceptance criteria

- [ ] Panel renders without errors in `demo/index.html`
- [ ] Fetches recent commits from GitHub API and renders as a trajectory
- [ ] Visual representation is legible at a glance (no raw JSON dumps)
- [ ] `dotnet build -c Release` → 0 warnings, 0 errors

## Blocked on

None; depends on 081KRFA460008QG0R0005DWKBG CSS/JS scaffolding (already shipped).
