---
id: 081M0R1RV1Z087G0R0004SVNXJ
type: task
state: backlog
priority: P2
slug: prove-the-conjugate-exponential-family-translation-theorem-a
title: "Prove the conjugate exponential-family translation theorem and refute dual flatness as its source"
created: 2026-08-23T19:32:44.223Z
depends_on: []
composes_with: []
---

# Prove the conjugate exponential-family translation theorem and refute dual flatness as its source

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R1RV1Z087G0R0004SVNXJ-*.md` glob. -->

**Route to:** `formal-verification-expert` (Soraya). **Tool: Lean 4** for the identity; **a
computed witness** for the counterexample — no prover needed there, only a check that cannot pass
by accident.

**Analysis this comes from:** `docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-two-already-answered-in-tree-one-refuted-lumen.md` §2.

## The claim to settle

PR #14268 measured that the Normal-Gamma conjugate update in natural coordinates **is vector
addition**, and `src/Bayesian/Message.fs:64` already stores a Gaussian as
`{PrecisionMean; Precision}` with `( * )` as componentwise add. The open question was whether
that additivity is a **theorem of dual flatness** or a property that dual flatness merely
accompanies. §2 argues the latter, and that the implication runs the **other way**.

## Two obligations

**S3a — the positive identity (Lean 4).** For an exponential family
`p(x|θ) = h(x)·exp(⟨θ, T(x)⟩ − A(θ))` with a conjugate prior in natural form, the posterior
natural parameter is `θ_post = θ_prior + Σ η(data)`. The content is
`exp⟨θ,T⟩ · exp⟨θ',T⟩ = exp⟨θ+θ',T⟩` — clean equational content, and the hypothesis that must
appear is **conjugacy in an exponential family**, *not* dual flatness.

**S3b — the non-implication.** Dual flatness does **not** entail additivity. Two witnesses, and
the second is the sharper one because it lives inside the same manifold:

1. The Gaussian sampling family is dually flat; put a Student-t (or Laplace, or uniform) prior on
   `μ` and the posterior leaves the family entirely — there is no vector to add.
2. A dually flat manifold supplies **two** canonical affine charts on equal footing. The update is
   addition in `θ`; in the m-affine chart it is `η ↦ ∇A(∇A*(η) + T(x))`, which is not addition.
   **A dually flat manifold has a chart in which its own update is not additive**, so dual
   flatness cannot be what selects the chart. Conjugacy is.

**Also worth pinning as a regression:** `Message.fs`'s own `Bernoulli` is the in-tree witness —
its `( * )` is *not* componentwise addition in the stored `ProbTrue` coordinate, because
`ProbTrue` is a non-affine chart of the same additive (log-odds) group.

## What this decides

Whether NG4's headline property is **structural** or a lucky parameterisation. §2.5 answers
**structural, and not lucky** — the natural parameterisation is canonically determined up to an
affine transformation, and additivity survives affine change of coordinates — but relocates the
source from the dually flat geometry to conjugacy.

## Falsifier

Produce a dually flat statistical manifold on which Bayesian conditioning is vector addition in
**every** affine chart — that would refute S3b's second witness. Or produce a conjugate
exponential-family pair whose natural-coordinate update is not additive — that would refute S3a.

## Anchors (checked)

- Amari & Nagaoka, *Methods of Information Geometry* (AMS/OUP 2000) §3.5 — exponential family ⟹
  dually flat, `g = ∇²A`, the Legendre-dual `θ`/`η` charts.
- Pitman–Koopman–Darmois — fixed-dimension sufficient statistics characterise exponential
  families; this is what actually produces the additivity.
- Already partly in-tree:
  `docs/research/2026-08-20-the-belief-manifold-is-hyperbolic-not-spherical-cl21-not-cl41-*.md` §5
  ("the affine structure is earned; the metric laid on top of it is not").

## Not in scope

Implementation.
