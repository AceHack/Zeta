---
id: 081M0DN8Y8R087G0R00101VSA2
type: bug
state: done
priority: P2
slug: two-shape-catalog-entries-render-byte-identical-goldens-quan
title: "Two shape-catalog entries render byte-identical goldens: quantum-circuit-singlet-chsh and quantum-circuit-bell-coincidence-singlet"
created: 2026-08-19T18:41:55.992Z
completed: 2026-08-19T20:32:04.214Z
depends_on: []
composes_with: []
---

# Two shape-catalog entries render byte-identical goldens: quantum-circuit-singlet-chsh and quantum-circuit-bell-coincidence-singlet

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0DN8Y8R087G0R00101VSA2-*.md` glob. -->

Detected by `bun src/Core.TypeScript/hygiene/audit-visual-confusability.ts` (TIER 0), baselined
there against this id. Analysis: `docs/design/2026-08-19-confusable-shapes-are-the-babel-failure-relocated-a-skeleton-guard-for-the-mark-vocabulary.md` §6.

## The defect

`db/shapes/golden/quantum-circuit-bell-coincidence-singlet.svg` and
`db/shapes/golden/quantum-circuit-singlet-chsh.svg` are **byte-identical**
(sha256 `10936a1beb49…`). No perceptual model is required: nothing distinguishes them for any
observer, machine included.

Not a rendering artifact. `src/Core.TypeScript/quantum-observable/generate-circuit-svgs.ts` builds
both from the identical gate sequence:

```
singletChsh  (:31-38)  h(0) ; cx(0,1) ; x(1) ; z(1) ; ry(0, 0.0) ; ry(1, -PI/4)
bellSinglet  (:51-58)  h(0) ; cx(0,1) ; x(1) ; z(1) ; ry(0, 0.0) ; ry(1, -PI/4)
```

Two catalog entries; one circuit. The name carries meaning the mark does not.

## Why nothing caught it

`tests/Tests.FSharp/ShapeAcceptance.Tests.fs` compares each golden against **its own generator's
output** — agreement by construction, in the sense
`docs/research/2026-08-14-branch-free-visual-encoding-*.md` §11 names. `src/Core/ShapeAcceptance.fs`
is the genuinely strong gate (known-answer laws, fail-closed on an unknown shape) but its laws are
**per-shape**: no check in the repo compares two catalog entries to each other.

## The decision this needs (physics, not design)

CHSH evaluates a correlator at **four measurement-angle pairs**; the file comment at `:30` says the
entry is "for E(a0, b0) as a representative corner". If that corner is genuinely the same circuit as
the Bell-coincidence singlet, the entry is a duplicate and should be deleted. If the CHSH corner is
meant to carry different measurement angles, `ry(1, ...)` should reflect them. Either resolution
closes this; picking one is a call for whoever owns `quantum-observable`.

## Done when

`auditCatalogIdentity` reports no byte-identical pair and the `KNOWN_OPEN` line is deleted.
