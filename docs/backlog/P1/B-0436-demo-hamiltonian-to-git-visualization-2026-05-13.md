---
id: B-0436
zetaid: 081KRFA460008QG0R0009TXX5S
priority: P1
status: open
title: "Demo — Hamiltonian-to-git visualization (git history → phase-space rendering)"
tier: product-demo
effort: L
created: 2026-05-13
last_updated: 2026-05-14
parent: B-0401
depends_on: [B-0434]
children: [B-0495, B-0496]
tags: [demo, hamiltonian, git, phase-space, alignment-ui, github-pages, html, js]
type: feature
---

# B-0436 — Hamiltonian-to-git visualization

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

None; depends on B-0434 CSS/JS scaffolding (already shipped).
