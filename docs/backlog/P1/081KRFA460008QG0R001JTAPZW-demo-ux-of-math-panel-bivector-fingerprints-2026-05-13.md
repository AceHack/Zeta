---
id: 081KRFA460008QG0R001JTAPZW
priority: P1
status: closed
title: "Demo — UX-of-math panel (bivector fingerprints, partial-credit scoring)"
tier: product-demo
effort: L
created: 2026-05-13
last_updated: 2026-05-13
parent: 081KR7JY10008QG0R001VP6JWG
depends_on: [081KRFA460008QG0R0005DWKBG]
tags: [demo, ux-of-math, bivector, clifford, alignment-ui, github-pages, html, js]
type: feature
---

# 081KRFA460008QG0R001JTAPZW — UX-of-math panel

## What

A "UX of math" panel in `demo/index.html` that renders bivector fingerprints and
partial-credit scoring in a form non-mathematicians can engage with. Makes the
Clifford/HKT substrate legible as an alignment-signal surface.

## Acceptance criteria

- [x] Panel renders without errors in `demo/index.html` — slice-1 PR #3136
- [x] Displays at least one worked example of a bivector fingerprint — slice-1 PR #3136
- [x] Partial-credit scoring concept is explained visually — slice-2 PR #3137 (slider) + slice-3 (clickable board)
- [x] `dotnet build -c Release` → 0 warnings, 0 errors — confirmed slice-3

## Blocked on

None; depends on 081KRFA460008QG0R0005DWKBG CSS/JS scaffolding (already shipped).

## Slice history

| Slice | PR | What shipped |
|-------|----|--------------|
| 1 | #3136 | Static bivector fingerprint canvas (HC-1 worked example) + partial-credit score board |
| 2 | #3137 | Non-orthogonal bivector slider — sin(θ) weight visualisation |
| 3 | — | Clickable score board rows → any clause's fingerprint loads in canvas; closes 081KRFA460008QG0R001JTAPZW |
