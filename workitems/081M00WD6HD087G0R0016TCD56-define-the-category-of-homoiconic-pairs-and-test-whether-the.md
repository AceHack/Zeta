---
id: 081M00WD6HD087G0R0016TCD56
type: task
state: backlog
priority: P2
slug: define-the-category-of-homoiconic-pairs-and-test-whether-the
title: "Define the category of homoiconic pairs and test whether the N=1 adinkra is initial in it"
created: 2026-08-14T19:36:27.949Z
depends_on: []
composes_with: []
---

# Define the category of homoiconic pairs and test whether the N=1 adinkra is initial in it

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00WD6HD087G0R0016TCD56-*.md` glob. -->

Lumen's analysis: `docs/research/2026-08-14-adinkra-minimal-homoiconicity-the-half-rotation-tower-and-where-the-obstruction-actually-lives-lumen.md` §2.2 (Reading B).

## Why this exists

Aaron's thesis says adinkras are "kind of **minimal** homoiconicity". A minimality claim needs a
category and an ordering, and there are two readings that give **opposite** answers:

- **Reading A — minimal = fewest vertices for a given N.** Minimal adinkras are code quotients
  (`2^(N-k)` vertices, k maximal), which are NOT regular representations, so homoiconicity **fails**
  for k > 0. Minimal AND homoiconic holds **exactly for N <= 3** (no nonzero doubly-even codeword fits
  in fewer than 4 coordinates, so k = 0 is forced there). Handled by `081M00WD2KG087G0R0038MX9HW`.
- **Reading B — minimal = the smallest carrier of the property at all.** The N=1 adinkra is one
  boson, one fermion, one edge, one sign bit: `A = Cl(0,1)`, dim 2. This reading is where Aaron's
  claim is interesting and it is currently a **claim-shape, not a claim**, because the category is
  undefined.

## The work

Define the category **HomIc**: objects are homoiconic pairs `(A, M, rho)` with `A` a unital algebra,
`M` a left `A`-module and `rho : A -> M` an `A`-module isomorphism (equivalently `M` is the regular
representation). Morphisms: algebra maps commuting with the `rho`s. Then ask:

> Is the N=1 adinkra **initial** in HomIc restricted to objects with at least one generator?

## Falsifier

Exhibit a homoiconic pair with at least one generator admitting no morphism from the N=1 adinkra, or
admitting more than one. Either kills initiality.

## Honest bound

This is the weakest of the three items Lumen minted today, and it is minted as a **claim-shape to be
made into a claim**, not as a result. If the category turns out not to have an initial object, that is
a legitimate and publishable negative and the thesis should drop the word "minimal" in Reading B and
keep it only in the N <= 3 sense.

Day-scale. Route: Soraya, or Lumen with Soraya reviewing.
