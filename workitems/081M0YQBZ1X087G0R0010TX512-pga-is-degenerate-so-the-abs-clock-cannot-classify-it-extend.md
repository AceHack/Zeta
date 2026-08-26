---
id: 081M0YQBZ1X087G0R0010TX512
type: task
state: backlog
priority: P2
slug: pga-is-degenerate-so-the-abs-clock-cannot-classify-it-extend
title: "PGA is degenerate so the ABS clock cannot classify it -- extend CliffordPeriodicity.fs to Cl(p,q,r) in F#"
created: 2026-08-26T09:45:37.597Z
depends_on: []
composes_with: []
---

# PGA is degenerate so the ABS clock cannot classify it -- extend CliffordPeriodicity.fs to Cl(p,q,r) in F#

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix -- resolve cross-refs by `081M0YQBZ1X087G0R0010TX512-*.md` glob. -->

## Why

`src/Core/CliffordPeriodicity.fs` classifies `Cl(p, q)`. **There is no `r`.** Measured
2026-08-26: no in-tree Clifford code handles a degenerate signature, and `PGA` appears
nowhere in `src/`. So the repo's Clifford instrument has zero coverage of **PGA(3D) =
Cl(3,0,1)** -- the 16-dimensional projective algebra Qualcomm's GATr is built on, and the
most-cited geometric-algebra architecture in the field.

The TypeScript side now covers it (`classifyDegenerate` in
`src/Core.TypeScript/research/conformal-embedding-and-curvature-budget.ts`, 6 falsifiers,
5 break-red mutations). **The F# authority does not**, so the two have diverged in coverage
-- and the F# module is the one the cross-verification golden vector is generated from.

## The shape of the fix, and the trap to avoid

**Do NOT extend `classify` to take an `r`.** A degenerate Clifford algebra is not semisimple
(the null generators are nilpotent and generate a Jacobson radical), so Atiyah-Bott-Shapiro
is **inapplicable**, not merely unimplemented. Threading an `r` through `classify` would
return a well-typed, confident, WRONG answer -- the vacuity class in its most dangerous
form, an instrument that judges an input it cannot judge.

The honest shape, mirroring what the TypeScript already does:

```
Cl(p,q,r)        ~=  Cl(p,q) (x) Lambda(R^r)
dim_R            =   2^(p+q+r)
Cl(p,q,r) / rad  ~=  Cl(p,q)          <- the semisimple quotient, which the clock CAN see
dim rad          =   2^(p+q) * (2^r - 1)
```

A separate function returning `{ RealDimension; RadicalDimension; SemisimpleQuotient;
IsDegenerate }`, with `r = 0` reducing exactly to the current behaviour so it is a strict
generalisation rather than a parallel path.

## Acceptance criteria

- `r = 0` reproduces `classify p q` exactly -- byte-identical on all 169 existing signatures,
  so the current golden vector still passes unchanged.
- `dim Cl(3,0,1) = 16`, matching GATr's published multivector dimension. This is the
  external check: the number is predicted by the structure theorem, not fitted.
- A negative control pinning that `Cl(3,1)` and `Cl(3,0,1)` share a dimension (16) and are
  NOT the same algebra -- one has an empty radical, the other is half nilpotent. Matching
  cardinality is not identification (`.claude/rules/numerology-vs-number-theory.md`).
- The golden vector is regenerated to include degenerate rows, and the TypeScript
  cross-oracle test consumes them -- so the two implementations stay pinned to each other
  rather than drifting again.
- Refuses a negative `r`.

## Not blocked by the Clifford-GPU hold

`081M0R18878087G0R001XY5A2J` holds GPU work: code, lowering, classifiers over the geometric
product, measurement. This is algebra *classification* -- the same category as the existing
`CliffordPeriodicity.fs`, which predates the hold and is `metered`.

## Pointers

- `docs/research/2026-08-26-all-three-geometric-algebra-towers-reduce-to-the-in-tree-cl30-*.md` -- the derivation and the tower table
- `src/Core.TypeScript/research/conformal-embedding-and-curvature-budget.ts` SS6 -- the reference implementation to port
- `src/Core.TypeScript/research/testdata/dump-clifford-grid.fsx` -- the generator that must grow degenerate rows
