# Tying globals/soft-tensors to a .NET tensor type, an interface, and an algebra — Z-set already IS the sparse tensor over a semiring (Aaron, 2026-06-07)

Aaron: *"can we tie this into [the] dotnet tensor class or some interface around it or an algebra?"*
Grounded answer (read against the code, not aspirational); one precise gap; Beacon-anchored.

## The answer in one line

**Most of it already exists.** The algebra is `ISemiring<'W>` (`src/Core/Semiring.fs`); the sparse-tensor
instance is `ZSet` (a COO sparse tensor over the **integer ring**); the dense leaf ties to
`System.Numerics.Tensors` (already a dependency, already used by `ZSet` for the SIMD `TensorPrimitives.Sum`).
The one missing piece is a **semiring-generic weighted set** so the weights can be uncertainty/probability
(= the soft tensor), not just `int64`.

## What's already in the repo (grounded)

- **The algebra — `ISemiring<'W>`** (`Semiring.fs`): `Zero`/`One`/`Add`(⊕)/`Mul`(⊗)/`Negate`, with concrete
  rings `IntegerRing`, **`IntervalRing`** (interval/uncertainty weights — already!), and
  **`ProbabilitySemiring`**. This is a GraphBLAS-shaped algebra: ⊕ and ⊗ over a chosen semiring.
- **The sparse tensor — `ZSet<'K>`** (`ZSet.fs`, `Algebra.fs`): a map *coordinate(key) → weight*. That **is**
  a sparse tensor in COO format. Its ops are tensor algebra: `(+)` = ⊕ (elementwise/union), join =
  ⊗-contraction (Einstein summation over shared indices), `sum` = reduction. DBSP incremental view
  maintenance over Z-sets is literally incremental sparse-tensor algebra.
- **The dense tie — `System.Numerics.Tensors`** (`Core.fsproj` dependency): `ZSet` already slice-strides the
  contiguous weight array and calls `TensorPrimitives.Sum` (SIMD). So the dense math path is already wired.

## The "navigate to / index into" split maps cleanly onto the .NET tensor type

- **Sparse, ragged, addressed → `Global`/`ZSet`** (the COO sparse tensor over a semiring). Navigate *to* a
  leaf with MUMPS verbs / address a coordinate.
- **Dense, rectangular, computed → `System.Numerics.Tensors.Tensor<T>` + `TensorPrimitives`.** The leaf blob
  is a dense `Tensor<T>`; index *into* it and run SIMD/BLAS. `Globals` addresses & versions the leaves;
  `Tensor<T>` computes them. (Same as model-weights: navigate to the tensor, index into it.)

## The one gap (precise, buildable)

`ZSet`'s `Weight` is **hardwired to `int64`** (`Algebra.fs`: `type Weight = int64`, matching Feldera's
`ZWeight = i64`; `(+)` uses `Checked.(+)` on int64). So Z-set is a sparse tensor over the **integer ring
specifically** — it can't carry interval/probability weights. The **soft tensor** needs:

> **`WeightedSet<'K,'W>` parameterized by `ISemiring<'W>`** — the semiring-generic sparse tensor. `ZSet`
> becomes the `IntegerRing` instance (perf-specialized: pools + SIMD); the **soft tensor** is the
> `IntervalRing` / `ProbabilitySemiring` instance (uncertainty-bearing cells). Union = ⊕, contraction/join =
> ⊗ over the chosen semiring. This is **GraphBLAS**: sparse linear algebra parameterized by a semiring.

So: `DynamicValue`-over-`SoftValue` is the *document/ragged* face of the soft tensor; `WeightedSet` over
`IntervalRing`/`ProbabilitySemiring` is its *algebraic* face. They are the same object in two registers.

## Proposed shape (design — build pending; ZSet-relationship is a real fork)

1. **C# neutral contract `ITensor<T>`** (per the 2026-06-07 naming convention — interface libs are C#,
   language-neutral): a minimal tensor port spanning a **dense** impl (`Tensor<T>`-backed) and a **sparse**
   impl (`WeightedSet`/COO-backed), unified by semiring-parameterized **contraction (einsum)**.
2. **`WeightedSet<'K,'W>` over `ISemiring<'W>`** — the semiring-generic sparse tensor (F# impl). `ZSet` =
   `IntegerRing` instance; soft tensor = `IntervalRing`/`ProbabilitySemiring` instance.
3. **`contract` / `einsum`** — the contraction operator parameterized by the semiring (sum-product =
   marginalization/belief-prop; max-plus = Viterbi; boolean = reachability; integer = Z-set join).

**The fork to decide before building:** generalize `ZSet` itself to `WeightedSet<'K,'W>` (risking the
perf-tuned int64 hot path) **vs** add a parallel general `WeightedSet` and keep `ZSet` as its specialized
instance. Leaning toward the latter (keep `ZSet` hot-path-pure; `WeightedSet` is the general algebra) —
needs a nod. Backlogged.

## Beacon anchors

- **GraphBLAS** (Kepner et al.; the C API) — sparse linear algebra **parameterized by a semiring**: the
  strongest prior art for "an algebra around sparse tensors," exactly the `WeightedSet`+`ISemiring` shape. ·
  **TACO — The Tensor Algebra Compiler** (Kjolstad et al., OOPSLA 2017) — unified sparse+dense tensor algebra
  / einsum over formats (COO/CSF/dense); the compilation story for `contract`. · **Einstein summation /
  tensor contraction** — the core operation. · **DBSP** (Budiu et al.) — Z-set algebra = incremental sparse
  tensor algebra (our existing instance). · **System.Numerics.Tensors / `TensorPrimitives` / `Tensor<T>`**
  (.NET 9/10) — the dense leaf + SIMD (already a dependency). · **Semiring/Kleene algebra** — the algebraic
  foundation (`Semiring.fs`). · **Feldera/Differential Dataflow** — `ZWeight=i64` (why `ZSet` is integer-
  specialized). Honest novelty: none in GraphBLAS/TACO; the contribution is recognizing **Z-set = the
  integer instance of a semiring-generic sparse tensor**, with the soft tensor as the interval/probability
  instance and `DynamicValue`/`Global` as its ragged face — unifying our DBSP, semiring, uncertainty, and
  global substrates under one tensor algebra, dense leaves on `System.Numerics.Tensors`.
