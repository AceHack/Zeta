# Design Note: Zeta IR Canonicalizer (Equivalence Decision Procedure)

**Author:** Manus AI
**Date:** June 21, 2026

## 1. The Goal and the Gap
In the previous cycle, we proved that the `ZetaIrNormalizer` is sound, idempotent, and core-four-closed, but **incomplete**: it maps the 6-op grammar to the 4-op minimal generating set (`mul`, `add`, `xshrxor`, `xrotxor`), but it does *not* map all functionally equivalent programs to the same normal form [1]. For example, `[Mul 2, Mul 3]` and `[Mul 6]` both compute $x \mapsto 6x$, but they normalize to themselves.

The goal is to build the "heavier artifact": a true **canonicalizer** that decides IR equivalence. If two v1–v4 IR programs compute the same function over $\mathbb{Z}/2^W\mathbb{Z}$ and $\mathbb{F}_2$, they must canonicalize to the exact same sequence of operations. This makes canonicalization a query-optimizer-style normal form, enabling free deduplication, equivalence checks, and caching.

## 2. Reusable Repo Machinery
We do not need to build solver orchestration or relation semantics from scratch. The repo already contains the necessary architectural primitives:

1. **`SolverHarness.fs` (Z3/CVC5 Cross-Check):**
   The formal verification folder (`src/Core.FSharp.Z3Verify/SolverHarness.fs`) provides `runZ3`, `runCvc5`, and `crossCheck`. We can use this to build a property test that asserts: *for any randomly generated IR, its canonical form is functionally equivalent to the original, as proven by SMT (unsat on `original(x) != canonical(x)`).* This elevates the FsCheck empirical proof to a bounded SMT proof per canonicalization.

2. **Registry as a Relation (`GeneratorIrRegistry.fs` / `generator-ir-registry.ts`):**
   The TS harness (`nway-diff.ts`) and the F# registry treat generators as rows in a Z-set relation, keyed by content-addressed `ZetaId` [2]. The canonicalizer is architecturally a **view (projection)** over this relation: `CanonicalIrRegistry = SELECT id, canonicalize(ir) FROM GeneratorIrRegistry`.

3. **Algebraic Substrate (Negative finding on Adinkra):**
   The Adinkra code (`BitAdinkra.fs`, `AdinkraCode.fs`) is strictly about doubly-even error-correcting codes and the $e_8$ extended Hamming code [3]. It does not provide symbolic algebra or term rewriting for $\mathbb{Z}/2^W\mathbb{Z}$. The canonicalizer must implement its own algebraic rewrite rules.

## 3. The Algebraic Rewrite System (The "Query Optimizer")
The core-four ops split cleanly into two algebraic rings:

- **Affine/Ring Ops ($\mathbb{Z}/2^W\mathbb{Z}$):** `mul k`, `add k`
- **Linear Ops ($\mathbb{F}_2$):** `xshrxor ss`, `xrotxor rs`

To achieve canonicalization, we must define a strict ordering and fusion strategy. The first implementable slice (Slice 1) targets the most common redundancies:

### Slice 1: Ring Fusion (Multiplication and Addition)
Consecutive operations in the same ring must be fused.

- **Mul-Mul Fusion:** `[Mul a, Mul b]` $\to$ `[Mul ((a * b) mod 2^W)]`
- **Add-Add Fusion:** `[Add a, Add b]` $\to$ `[Add ((a + b) mod 2^W)]`
- **Zero/Identity Elimination:** `Mul 1`, `Add 0`, `XShrXor []`, `XRotXor []` are removed.
- **Zero Absorption:** `Mul 0` absorbs all preceding operations (since $f(x) \cdot 0 = 0$).

### Slice 2: F2 Linear Fusion (Rotates and Shifts)

- **XRotXor Fusion:** `[XRotXor A, XRotXor B]` $\to$ `XRotXor (A \oplus B)` where $\oplus$ is the symmetric difference of the rotation amounts modulo $W$.
- **XShrXor Fusion:** Similar symmetric difference for shifts.

### Slice 3: Commutation and Normal Form (The Hard Part)
To be a true decision procedure, the canonicalizer must commute ops into a canonical order (e.g., all $\mathbb{F}_2$ ops before $\mathbb{Z}/2^W\mathbb{Z}$ ops, or vice versa). However, `add` and `xshrxor` do not commute cleanly. Slice 3 will require representing the entire program as a sum of bit-vector affine transformations and emitting the minimal sequence.

## 4. Implementation Plan for Slice 1
We will implement Slice 1 (Ring Fusion + Identity Elimination) as a proof of concept.

1. **`ZetaIrCanonicalizer.fs`:**
   Implement a recursive `canonicalize` function that folds over the IR ops, fusing adjacent `Mul` and `Add` ops, and dropping identities.
2. **SMT Cross-Check:**
   Write a test that generates random IR, canonicalizes it, emits the SMT-LIB representation (reusing logic from `gen-smt2-from-ir.ts` but in F#), and calls `SolverHarness.crossCheck` to prove `original == canonical`.
3. **Integration:**
   Verify against the known generators in the registry.

## References
[1] `ZetaIrNormalizer.Tests.fs` and `docs/research/2026-06-21-lumen-zeta-ir-normalizer-incompleteness.md`
[2] `tests/cross-verification/_harness/generator-ir-registry.ts` lines 1-16
[3] `src/Core/AdinkraCode.fs` lines 6-233-90
