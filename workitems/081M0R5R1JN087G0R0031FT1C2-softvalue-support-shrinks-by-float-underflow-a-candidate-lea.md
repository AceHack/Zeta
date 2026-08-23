---
id: 081M0R5R1JN087G0R0031FT1C2
type: bug
state: backlog
priority: P2
slug: softvalue-support-shrinks-by-float-underflow-a-candidate-lea
title: "SoftValue support shrinks by float underflow: a candidate leaves at 324 observations with no zero likelihood"
created: 2026-08-23T20:42:12.437Z
depends_on: []
composes_with: []
---

# SoftValue support shrinks by float underflow: a candidate leaves at 324 observations with no zero likelihood

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0R5R1JN087G0R0031FT1C2-*.md` glob. -->

**Found by:** adversarial verification of Aaron's widening/collapse framing —
`docs/research/2026-08-23-geometry-as-the-root-of-the-soft-regime-five-questions-two-already-answered-in-tree-one-refuted-lumen.md` §14.6. Aaron asked to be checked; this is what the check turned up.

## The defect

`src/Core/SoftValue.fs` `observe` is `w * max 0.0 (likelihood d)`, and `build` goes through
`WeightedSet.ofSeq`, which **prunes zero weights** (canonical form). So a candidate whose weight
reaches exactly `0.0` **leaves the support**.

Two paths reach zero. The first is intended; **the second is not**:

1. **Intentional.** A non-positive likelihood clamps to `0` — the docstring says *"that candidate
   refuted"*. Deliberate and documented.
2. **Silent, by float underflow.** With a likelihood of `0.1` for one candidate — merely unlikely,
   **never zero, never refuted** — the candidate's relative mass decays geometrically and reaches
   the denormal floor. **Measured: the candidate leaves the support after 324 observations.**
   Normalising each step does not prevent it, because the decay is in the *relative* mass.

## Why it matters, and it is not "a hopeless candidate died"

A candidate at `1e-324` is beyond practical relevance, so the *value* impact is nil. The defect is
**determinism**:

> **When the candidate dies is a function of float rounding.** Two oracles with different
> floating-point paths — different summation order, different libm, different JIT — prune at
> different steps, hold **different supports**, and therefore **diverge**. That breaks the
> four-oracle byte-lock and DST replay, which is the property the substrate is built on.

Support membership is a *discrete* fact derived from a *continuous* computation with no guard band.
That is the classic shape of a non-reproducible boundary.

## Reproduction

`python3 docs/research/scripts/2026-08-23-geometry-as-root-widening-as-retraction-verify.py`,
check `S3` (models the F# semantics; it does not run the F#). Confirming on the real `SoftValue`
is the first task.

## The fix is NOT to remove pruning

Zero-pruning is what makes `WeightedSet` canonical (`add a (negate a) = empty`), and removing it
would break that everywhere. The fix is to **distinguish *refuted* from *underflowed***. Options,
in rough order of preference:

- **Carry refutation explicitly** rather than by absence — a candidate refuted by a zero likelihood
  is a different state from one that merely became improbable. This is the honest modelling fix and
  matches the repo's four-register discipline (let unknown be unknown).
- **Floor the mass** at a representable epsilon during `build` on the belief lane, so the support is
  a function of the *evidence*, not of the exponent range. Note this changes normalisation slightly
  and needs its own falsifier.
- **Exact weights.** `ProbabilitySemiring.RationalRing` already implements `IRing<Rational>` over
  exact ℚ and is noted in `SoftValue.fs` as available; exact weights have no underflow. Cost is
  performance and unbounded denominators.

**Do not** simply widen before every observe: §14.2 shows `widen` is support-preserving, but
`foldRetained` calls `observe` internally, so the fold still loses keys.

## Falsifier (write it first — it fails today)

```
support(fold(E ∪ {e})) ⊇ support(fold(E))
```

Support is monotone under adding evidence. Prove it discriminates by introducing the underflow path
deliberately and confirming red. This is the first mechanical check of anything support-shaped on
the value axis — see §14.3/§14.4 for why it must **not** be labelled "the never-collapse check":
that phrase already means the snap discipline in this file, and the two classify `resolve` and
`observe` oppositely.

## Register

`metered` — the defect has a reproduction and a number (324 observations at a 10:1 likelihood
ratio). The *impact* claim (oracle divergence) is **argued, not measured**: no cross-oracle run has
been done, and doing one is the second task.
