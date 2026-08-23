---
id: 081M0R1RV3T087G0R001YAWXNK
type: task
state: backlog
priority: P3
slug: pre-register-the-gardenfors-convexity-question-as-a-model-co
title: "Pre-register the Gardenfors convexity question as a model comparison not a proof obligation"
created: 2026-08-23T19:32:44.282Z
depends_on: []
composes_with: []
---

# Pre-register the Gardenfors convexity question as a model comparison not a proof obligation

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R1RV3T087G0R001YAWXNK-*.md` glob. -->

**Explicitly NOT routed to `formal-verification-expert`.** This is an empirical model comparison,
not a proof obligation, and misrouting it to a prover would manufacture a proof of something that
is not a theorem.

**Analysis this comes from:** `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-two-already-answered-in-tree-one-refuted-lumen.md` §5.

## Why the obvious form of the question is the vacuity class

`src/Core/LinguisticSeed.fs` is a Mercer-closed kernel algebra, PSD by construction. A PSD kernel
determines an RKHS and an isometric Hilbert embedding (Moore–Aronszajn 1950; Schoenberg 1938) — so
**"English is geometric" and "the linguistic seed is a Mercer kernel" are the same statement**, and
Aaron's claim is already implemented in different words.

That is exactly why the *existence* claim carries no information: `LinguisticSeed.indicator`
(`k(a,b) = 1 iff a = b`) sends every point to a distinct orthonormal basis vector, and a convex
combination of distinct basis vectors with more than one nonzero coefficient is never a basis
vector. **Every subset of every set is convex under `indicator`.** No categorisation of English —
natural, arbitrary, or adversarial — can fail. Any set at all admits `indicator`, so the existence
of a geometry is free.

**The obstruction is not infinite-dimensionality** (a correction to the framing): affine convexity
is a statement about the ambient space while the data live on a thin curved image `φ(X) ⊂ H`, so
the membership test has an empty antecedent. That is equally true for a curved surface in ℝ³.

## What to pre-register instead

> Does a **prototype/Voronoi** model over the kernel metric
> `d(a,b) = √(k(a,a) − 2k(a,b) + k(b,b))` predict **held-out** category membership better than a
> pre-registered alternative set — nearest-neighbour-to-all-exemplars, a linear separator, and
> logistic regression on `φ` — on a corpus and a kernel both fixed **in advance**?

This can come out negative, it is measured in held-out log-likelihood, and it requires proving
nothing. Gärdenfors' own result (*Conceptual Spaces* 2000 §3.9, on Okabe, Boots & Sugihara's
Voronoi theory) is that prototype-generated concepts are convex **automatically** — so convexity is
a *consequence* of the model, never the empirical content.

The weaker intermediate repair, recorded so it is not re-invented: **Menger betweenness**
(Menger 1928) makes convexity *statable* from `k` alone, but exact betweenness holds on a
measure-zero set of a strictly convex Hilbert space, so on finite data it needs an ε and the
verdict becomes threshold-dependent. Honest, weak, and not the thing to route.

## Deliverable

A pre-registration document: corpus, kernel, baselines, statistic, and the decision rule — all
fixed before any number is computed. No implementation of the comparison itself under this item.

## Two findings for the code phase (reported, not filed as implementation)

1. `LinguisticSeed` exposes `gram` and `quadForm` and **no distance function**, so convexity is
   not computable from its current API at all. Two lines, and they are not there.
2. **Anchor correction.** The module cites **Mercer's theorem** (1909), which needs a *continuous*
   kernel on a *compact* domain; `Kernel<'x> = 'x -> 'x -> float` has an arbitrary `'x` with no
   topology. The theorem that entails the module's claim is **Moore–Aronszajn (1950)**, which needs
   only PSD. `Mercer-closure` for the combinator closure is fine and standard; the *existence of
   the geometry* should cite Moore–Aronszajn.

## Falsifier

The pre-registered baselines win on held-out log-likelihood.

## Not in scope

Implementation, and any attempt to register the affine-convexity form — §5.2 shows it is the
vacuity class and it must never be registered in place of this.
