# Research Note: Incompleteness of the Zeta IR Normalizer

**Date:** 2026-06-21
**Author:** Manus AI
**Component:** `Zeta.Core.ZetaIrNormalizer`

## Key Recommendation
**The Zeta IR Normalizer is SOUND but INCOMPLETE.** It is not a decision procedure for program equivalence. We must not rely on structural equality of normalized IRs (`normalize A == normalize B`) to determine if two generators compute the same function.

## 1. The Completeness Question
The `ZetaIrNormalizer` successfully lowers the 6-op `zeta-ir-v4` grammar into the 4-op minimal generating set (`{mul, add, xshrxor, xrotxor}`). We have formally verified (via Lean 4 and FsCheck) that this lowering is **sound** (preserves denotation), **idempotent**, and **closed** over the core four.

The natural next question is **completeness**: does the normalizer serve as a canonical decision procedure for IR equivalence? Formally, if two IR programs $A$ and $B$ compute the exact same function over `UInt64` (i.e., $\forall x, \text{eval}(A, x) = \text{eval}(B, x)$), do they normalize to the exact same structural IR list?

$$\forall A, B \in \text{Ir}. (\forall x, \text{eval}(A, x) = \text{eval}(B, x)) \implies \text{normalize}(A) = \text{normalize}(B)$$

## 2. The Verdict: Incomplete
The normalizer is **provably incomplete**. The theorem above is false.

The current `normalizeOp` function operates strictly point-wise—it lowers individual operations in isolation without inspecting the surrounding program structure. It performs no algebraic simplification, fusion, or term rewriting across sequence boundaries.

Because the grammar admits multiple ways to construct identical algebraic functions using sequences of core operations, we can easily construct equivalent programs that normalize to distinct structures.

### Counterexample 1: Multiplication Composition
The simplest counterexample exploits the associativity of multiplication in the ring $\mathbb{Z}/2^W\mathbb{Z}$.

* **Program A:** `[Mul 2, Mul 3]`
* **Program B:** `[Mul 6]`

Both programs compute $f(x) = x \times 6 \pmod{2^W}$.
Because `Mul` is already a core-four operation, the normalizer preserves both programs exactly as written:

* `normalize(A)` = `[Mul 2, Mul 3]`
* `normalize(B)` = `[Mul 6]`

The normal forms are structurally unequal despite strict functional equivalence.

### Counterexample 2: Rotation Algebra
A second counterexample exploits the algebraic structure of bitwise rotation.

* **Program A:** `[Rotl 1, Rotl 2]`
* **Program B:** `[Rotl 3]`

Both programs compute a total left-rotation by 3 bits.
The normalizer lowers `Rotl r` to `XRotXor [0, r]`:

* `normalize(A)` = `[XRotXor [0, 1], XRotXor [0, 2]]`
* `normalize(B)` = `[XRotXor [0, 3]]`

Again, the normal forms are distinct.

## 3. Conclusion and Architectural Boundaries
The incompleteness is not a flaw in the normalizer, but a deliberate architectural boundary. 

The normalizer's job is **vocabulary reduction** (6 ops $\to$ 4 ops), not **algebraic simplification**. Building a true canonical normal form for program equivalence would require a full term-rewriting engine capable of flattening all affine and linear transformations over $\mathbb{F}_2$ and $\mathbb{Z}/2^W\mathbb{Z}$.

For downstream consumers (compilers, optimizers, Lean targets):

1. **You CAN** rely on `normalize` to strip `xorshr` and `rotl` from the vocabulary, guaranteeing you only need to implement 4 operations.
2. **You CANNOT** rely on `normalize(A) == normalize(B)` to deduplicate generators or prove functional equivalence. Equivalency checking remains the domain of SMT solvers (like the existing Z3 harness) or exhaustive search.
