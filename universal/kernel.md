# universal/kernel — Universal Kernel Interface (similarity that composition can never break)

> **Universal Kernel Interface** — a universal SHAPE applicable to all `/travelers` and all `/persona`.
> A **kernel** is a similarity `k : 'x → 'x → float` that may ONLY be built from the **Mercer-closure
> operations** — so **composition can never break it** — proven by the **Gram witness**, not asserted;
> its values byte-lock only when exact (ℚ/integer), and **float kernels live outside the treaty**.

In plain English: **PSD means no composition of similarities can ever produce a negative
self-similarity** — you can sum, multiply, scale, and re-index similarities forever and the result is
still an honest similarity. That is why three independently-built things converged on this one shape
(Aaron 2026-06-11): the salon's soft tie (Jaccard/min-max), the seed language (B-0204 carved-sentence
kernels), and conformal memory distance (the Gaussian over `d² = −2(P·Q)`) — *ties, meanings, and
distances are all the same object*. Rooms, memories, and similarities speak one mathematics.

## The contract (membership = exposing ONLY these)

The six closure operations — each provably PSD-preserving (Mercer 1909; the Schur product theorem):

1. `constant c` (c ≥ 0) · 2. `feature φ` / `dot φ` (rank-1 / Gram) · 3. `indicator` (Kronecker) ·
4. `sum` · 5. `product` (Schur/Hadamard) · 6. `scale c` (c ≥ 0) · plus `pullback g` (re-indexing).

Compositions outside the closure cannot be expressed, so they cannot break PSD — **OCP as a theorem**
(B-0204). Extension packs (`Pack`/`composePacks`) grow a seed by ADDING kernels, never editing.

## Conformance = the Mercer witness, not a claim

A conforming implementation proves `vᵀKv ≥ 0` over sampled Gram matrices (`quadForm`) — conformance by
witness, the same way `universal/` membership is proven by oracle agreement, not assumed.

## Bit-perfection (honest boundary)

- **Byte-lockable (treaty-grade):** kernels with EXACT values — `indicator` (0/1), integer-count
  intersection kernels, ℚ-valued Jaccard (`|A∩B| / |A∪B|` carried as a rational pair, no division).
- **Outside the treaty (named, not hidden):** float-valued kernels (RBF/`exp`, FP dot products) —
  transcendentals and FP summation order are libm/codegen-dependent and do NOT byte-lock across
  oracles. They conform by per-oracle witness with tolerance; they never enter a golden-vector lock.
  (The corpus precedent: B-1020 floats-named-out-of-lineage; `ProbabilitySemiring` going ℚ.)

Reference implementation: [`src/Core/LinguisticSeed.fs`](../src/Core/LinguisticSeed.fs) (the closure +
`kernel { }` CE — the CE is an F# vehicle, NOT part of this universal shape) · instances:
[`src/Core/Salon.fs`](../src/Core/Salon.fs) (`jaccardKernel`/`seedPack`),
[`src/Core/ConformalGA.fs`](../src/Core/ConformalGA.fs) (`rbfKernel`/`memoryPack`).
See [`universal/README.md`](README.md) and `docs/backlog/P3/B-0204-*.md` (the originating synthesis).
