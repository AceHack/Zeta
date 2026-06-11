---
id: B-0495
zetaid: 081KRHWGX0008QG0R001RHSSHT
priority: P1
status: closed
closed: 2026-05-14
closed_by: "PR #3135"
title: "Hamiltonian viz — slice-1: static panel scaffold in demo/index.html"
tier: product-demo
effort: S
created: 2026-05-14
last_updated: 2026-05-14
parent: B-0436
depends_on: [B-0434]
composes_with: [B-0435, B-0494]
tags: [demo, hamiltonian, git, phase-space, alignment-ui, github-pages, html, js]
type: feature
---

# B-0495 — Hamiltonian viz slice-1: static scaffold

## What

Add a 6th tab "Hamiltonian" to `demo/index.html` with a static mock
phase-space trajectory rendering. Each mock commit is a point on a
2D canvas; a spline connects them to form the trajectory. All
rendering uses DOM Canvas API — no third-party deps.

No GitHub API calls in this slice; mock data establishes the visual
pattern for slice-2 to replace with live data.

## Acceptance criteria

- [ ] "Hamiltonian ▸" tab appears in the nav and activates cleanly
- [ ] Canvas renders a labelled phase-space plot (x = time index,
      y = commit energy proxy) with ≥ 8 mock trajectory points
- [ ] Axis labels, gridlines, and legend are readable
- [ ] A "How to Read" explanatory panel is present
- [ ] Panel renders without JS errors in browser console
- [ ] `dotnet build -c Release` → 0 warnings, 0 errors

## Pre-start checklist

- Prior-art search: no existing Hamiltonian/phase-space panel in
  demo/index.html (grep confirmed). Circuit Breaker tab (B-0435) is
  the template pattern for a new lazy-rendered tab.
- Dependency check: B-0434 is closed/shipped; scaffolding present.
- Claim: acquired by otto-cli (B-0436 umbrella claim).
