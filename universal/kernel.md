# universal/kernel — Universal Kernel Interface (similarity that composition can never break)

> **Universal Kernel Interface** — a universal SHAPE applicable to all `/travelers` and all `/persona`.
> A **kernel** is a similarity `k : 'x → 'x → float` that may ONLY be built from the **Mercer-closure
> operations** — so **composition can never break it** — proven by the **Gram witness**, not asserted;
> its values byte-lock only when exact (ℚ/integer), and **float kernels live outside the treaty**.

In plain English: **PSD means no composition of similarities can ever produce a negative
self-similarity** — you can sum, multiply, scale, and re-index similarities forever and the result is
still an honest similarity. That is why three independently-built things converged on this one shape
(Aaron 2026-06-11): the salon's soft tie (Jaccard/min-max), the seed language (081KQTPYE0008QG0R0028V263Z carved-sentence
kernels), and conformal memory distance (the Gaussian over `d² = −2(P·Q)`) — *ties, meanings, and
distances are all the same object*. Rooms, memories, and similarities speak one mathematics.

## The contract (membership = exposing ONLY these)

The six closure operations — each provably PSD-preserving (Mercer 1909; the Schur product theorem):

`constant c` (c ≥ 0); `feature φ` / `dot φ` (rank-1 / Gram); `indicator` (Kronecker); `sum`;
`product` (Schur/Hadamard); `scale c` (c ≥ 0); plus `pullback g` (re-indexing).

Compositions outside the closure cannot be expressed, so they cannot break PSD — **OCP as a theorem**
(081KQTPYE0008QG0R0028V263Z). Extension packs (`Pack`/`composePacks`) grow a seed by ADDING kernels, never editing.

## The proof is the CLOSURE; the Gram witness is a regression CHECK (Math Razor 2026-06-11)

The **proof** that a kernel is PSD is the **closure itself** — it is built only from PSD-preserving
operations, so the composite is PSD by construction (a type-level guarantee, provable in Lean: each
combinator preserves the PSD predicate). The **Gram witness** (`vᵀKv ≥ 0` on sampled points via
`quadForm`) is **evidence, not proof** — a finite-sample regression check that the algebra was not
violated (e.g. a non-closure op smuggled in). Sell it as the check, never as the certificate. (Precondition
caught the same day: `dot` must zero-extend ragged vectors, not min-truncate, or it is not a Gram matrix.)

## Bit-perfection (honest boundary)

- **Byte-lockable (treaty-grade):** kernels with EXACT values — `indicator` (0/1), integer-count
  intersection kernels, ℚ-valued Jaccard (`|A∩B| / |A∪B|` carried as a rational pair, no division).
- **Outside the treaty (named, not hidden):** float-valued kernels (RBF/`exp`, FP dot products) —
  transcendentals and FP summation order are libm/codegen-dependent and do NOT byte-lock across
  oracles. They conform by per-oracle witness with tolerance; they never enter a golden-vector lock.
  (The corpus precedent: 081KTAH8Q0008QG0R001YHSSA0 floats-named-out-of-lineage; `ProbabilitySemiring` going ℚ.)

>**Declared vocabulary (anti-tribal-knowledge, Aaron 2026-06-11: "tribal knowledge is bad — unless you
>declare the tribe").** This interface deliberately adopts three load-bearing terms; they are DECLARED
>here, not assumed: **PSD** = positive-semidefinite = "no composition of similarities can ever produce a
>negative self-similarity" (the plain-English form above is canonical; the jargon is the index into the
>literature). **Mercer closure** = the set of operations that preserve PSD (Mercer 1909). **Gram witness**
>= testing `vᵀKv ≥ 0` on a sampled Gram matrix. Anyone may use these words here knowing exactly what they
>mean; that is a declared tribe, not hidden lore.

Reference implementation: [`src/Core/LinguisticSeed.fs`](../src/Core/LinguisticSeed.fs) (the closure +
`kernel { }` CE — the CE is an F# vehicle, NOT part of this universal shape) · instances:
[`src/Core/Salon.fs`](../src/Core/Salon.fs) (`jaccardKernel`/`seedPack`),
[`src/Core/ConformalGA.fs`](../src/Core/ConformalGA.fs) (`rbfKernel`/`memoryPack`).
See [`universal/README.md`](README.md) and `docs/backlog/P3/081KQTPYE0008QG0R0028V263Z-*.md` (the originating synthesis).
