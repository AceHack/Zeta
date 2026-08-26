---
id: 081M0YNJ7HE087G0R0028M33JX
type: task
state: backlog
priority: P2
slug: thousandbrains-columns-believe-about-scalars-not-locations-t
title: "ThousandBrains columns believe about scalars, not locations -- the seam where spatial belief would attach"
created: 2026-08-26T09:14:05.742Z
depends_on: []
composes_with: []
---

# ThousandBrains columns believe about scalars, not locations -- the seam where spatial belief would attach

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix -- resolve cross-refs by `081M0YNJ7HE087G0R0028M33JX-*.md` glob. -->

## Why

Aaron 2026-08-26: *"i'm hoping to use clifford like jeff hawkins 1000 brains for spatial
reasoning built into the factor graphs and BNN layers."*

`src/Bayesian/ThousandBrains.fs` (98 lines) **already implements the Hawkins voting
structure**: independent columns, IV-weighted lateral votes, log-scaled weights so no
column becomes a dictator (an explicit Gibbard-Satterthwaite / Arrow-escape nod). What it
does not have is any spatial content --

```fsharp
type Column =
    { Id: string
      Belief: Gaussian                       // <- a SCALAR
      AccumulatedIV: float<InformationValue.iv> }
```

A column believes about a *number*. In the 1000 Brains theory a cortical column's whole
job is to believe about a *location in a reference frame attached to an object* -- the
reference frame is the load-bearing part of the theory, and it is exactly what is absent.

**So this file is the seam.** It is where a spatial belief would attach, and naming it now
means the Clifford question has a concrete destination rather than an aspiration.

## The destination, and why it is not startable yet

`docs/research/2026-08-26-cga-is-m2-of-the-in-tree-clifford-q4-answered-*.md` SS2 establishes
(checked, 9 dimensions up to n=256) that the conformal embedding into `Cl(n+1,1)` satisfies
`P(x).P(y) = -1/2 |x-y|^2`. That is the construction that would let a column believe about a
location in **any** metric space, not just 3D -- which is the generalisation Aaron asked
for.

**Blocked by `081M0R18878087G0R001XY5A2J`** (the Clifford-GPU hold) for the algebra half.
Q4 is now discharged -- CGA is `M_2(Cl(3,0))`, not a rival tower -- but Q1/Q2/Q3/Q5 remain,
and **Q3 is the one this row needs**: *can a Normal-Gamma posterior be exhibited as a region
in a conceptual space under a named metric, with a stated approximation error?* Without
that, embedding a belief as a point has no error budget and the result is unfalsifiable.

## What IS startable now

Nothing in the algebra. But the honest intermediate is cheap and worth doing first:
**make a column's belief a vector of Gaussians over a named frame** and measure whether
lateral voting over vector beliefs beats scalar voting on a task we already have (the ARC
lane, or the twitch-ai arena). That establishes whether spatial belief helps *at all*
before any geometric machinery is committed to -- and if it does not, the Clifford question
is moot for this use case.

## Pointers

- `src/Bayesian/ThousandBrains.fs` -- the seam
- `src/Bayesian/CliffordAntiSybil.fs` -- the cautionary instance: a flat chart laid on a
  belief manifold, score not invariant under a change of units (0.999752 -> 0.000006)
- `workitems/081M0FT2JZV087G0R003HXFCEW-*` -- the Fisher-Rao repair for that
- Hawkins, *A Thousand Brains* (2021); Hawkins, Lewis, Klukas, Purdy & Ahmad, *A Framework
  for Intelligence and Cortical Function Based on Grid Cells* (Front. Neural Circuits 2019)
  -- cited from standing knowledge, not page-checked
