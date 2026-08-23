---
id: 081M0R34AZY087G0R001H9N6YS
type: task
state: backlog
priority: P2
slug: descent-along-a-coarsening-the-exact-iff-extensive-vs-intens
title: "Descent along a coarsening: the exact iff, extensive vs intensive, and Pythagorean as within-fibre Bregman information"
created: 2026-08-23T19:56:29.566Z
depends_on: []
composes_with: []
---

# Descent along a coarsening: the exact iff, extensive vs intensive, and Pythagorean as within-fibre Bregman information

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R34AZY087G0R001H9N6YS-*.md` glob. -->

**Route to:** `formal-verification-expert` (Soraya). **Lean 4** for the descent theorem;
**a computed witness** for the two-barycentre disambiguation (already written, see below).

**Analysis this comes from:** `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-two-already-answered-in-tree-one-refuted-lumen.md` §10. Numbers reproduce from
`docs/research/scripts/2026-08-23-geometry-as-root-bregman-coarsening-verify.py` (`ALL PASS`, exit 0).

**Origin:** Aaron's addition after the first pass — the co/contravariance connection between C#
type theory and physics, and a parallel naming-registry design that arrived at *"measure DV2.0
change-rate over a **cluster** instead of an individual item."*

## Three obligations

**D1 — the exact descent condition (Lean 4, short).** For surjective `q : N → C` and any
`g : N → X`, a map `ḡ : C → X` with `ḡ ∘ q = g` exists **iff** `ker q ⊆ ker g` (constant on
fibres), and is then unique. Mathlib has this as the universal property of `Quot`/`Setoid`; the
value is in **stating it as the design's discharge condition** so the assertion becomes a theorem
with a hypothesis rather than a claim.

**D2 — the extensive/intensive split (the part the framing was missing).** There are **two**
pushforwards with **opposite** freedom, and which one the design means decides whether a hypothesis
is needed at all:

| carried object | pull back along `q` | push forward along `q` |
|---|---|---|
| **function** `N → X` (intensive — a per-item rate) | **free** | needs **constancy on fibres** |
| **measure** on `N` (extensive — a count) | needs a disintegration / section | **free** |

So "total changes per unit time across the cluster" is **already well-defined, no hypothesis**;
"the rate each member has" is **not**. State both, and state which one DV2.0 actually consumes —
§10.1 argues it is the intensive one, and that **within-fibre change-rate dispersion is not noise,
it is the measurement that the cluster is wrong** (a cluster that has merged a hub with a satellite).

**D3 — Pythagorean = within-fibre Bregman information.** Identify Amari & Nagaoka's generalised
Pythagorean theorem with the Bregman-information decomposition:

```
E_i[ KL(p_i ‖ q) ]  =  E_i[ KL(p_i ‖ p̄) ]  +  KL( p̄ ‖ q )     for every q in the family
                       └─ fibre-VARYING ─┘    └── DESCENDS ──┘
```

The first term is exactly the approximation error of the pushforward; the second is the part that
descends. With `φ = ‖·‖²` the same identity is the **law of total variance**. Checked to
`5.7e-14` over 2000 random `q`; the within-cluster information is exactly `0` iff the fibre is
constant.

## The disambiguation this must land, because the tree already contains both

*"Measure over the cluster"* does not name one operation. The same members have **two** KL
barycentres, both already implemented in different files:

| barycentre | closed form | already in the tree as |
|---|---|---|
| `argmin_q E[KL(p_i ‖ q)]` (right-KL) | **moment average** — `(0.500000, 4.050000)` | **EP moment matching** (Minka 2001) |
| `argmin_q E[KL(q ‖ p_i)]` (left-KL) | **natural-parameter average** — `(0.947368, 1.052632)` | **NG4's `mix()`** — log-linear pooling (Genest 1984) |

This is the e-versus-m ambiguity of §3.3 arriving by a different door. **The variance route does
not dissolve Q3's ill-posedness; it re-derives it**, and names the missing datum: *fix which affine
structure is canonical for the purpose.*

## Falsifier

Exhibit a surjection `q` and a non-fibre-constant `g` that nevertheless descends (would refute
D1's iff), **or** a Bregman divergence and a cluster for which the D3 decomposition is inexact.

## Anchors (checked)

- Mac Lane, *Categories for the Working Mathematician* (2nd ed. 1998) I.2 — contravariant functor
  = functor on `C^op`; the definition both the C# and the physics conventions are measured
  against (§10.2 writes out the translation; the labels are swapped by exactly one `op`).
- Banerjee, Guo & Wang 2005, *On the optimality of conditional expectation as a Bregman predictor*,
  IEEE Trans. Inf. Theory 51 — the barycentre is the unique optimum.
- Banerjee, Merugu, Dhillon & Ghosh 2005, *Clustering with Bregman divergences*, JMLR 6 — the
  within-cluster Bregman information, which is **literally** the "cluster by distance in an
  embedding, then measure per cluster" design pattern that generated this item.
- Amari & Nagaoka 2000, Thm 3.8 / 3.9 — the Pythagorean and projection theorems D3 identifies with
  the above.

## Not in scope

Implementation. And the **Gärdenfors** half of Q3 — a coarsening yields a quotient, not a convex
region, so §3.3's problem is untouched by this item.
