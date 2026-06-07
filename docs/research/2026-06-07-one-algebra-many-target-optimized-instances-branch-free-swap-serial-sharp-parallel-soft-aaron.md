# One algebra, many target-optimized instances, swapped branch-free (serial-sharp ↔ parallel-soft) (Aaron, 2026-06-07)

Aaron: *"it's fine to have single-core CPU-optimized algebra and parallel-optimized ones for the same
algebra, and maybe combinations in between — all very relevant"* … *"we try to still avoid ifs everywhere so
it's easy to switch between parallel soft and serial sharp algebra."* The design principle behind the
`Result`/`Sat` numeric split; faithful capture; Beacon-anchored.

## The principle

**One algebra (interface), many implementations — each optimized for an execution target — selected by
*passing a different instance*, never by `if`/`match` branches at the call site.**

The targets form a matrix, all behind the same interface:

| axis | values |
|---|---|
| **representation** | **sharp** (exact / point value) ↔ **soft** (`SoftValue` distribution, uncertainty-bearing) |
| **execution** | **serial** (single-core, deterministic) ↔ **parallel** (multi-core / SIMD / GPU-shader) ↔ hybrid |
| **error** | `Result` (CPU/correctness) ↔ saturating/NaN-poison (`Sat`, shader-lowerable) |

Every cell is a *legitimate, relevant* implementation of the *same* algebra. You pick one by selecting the
instance; the surrounding code is **identical** and **branch-free**.

## Why branch-free, and how instance-passing delivers it

`if target = Parallel then ... else ...` scattered through the hot path is the anti-pattern: it couples every
call site to the target set, it *is* a branch (divergent on GPU, mispredicted on CPU), and adding a target
edits every site. Instead, the algebra is a **value** (the `ISemiring`/`IMonoid`/`ISemilattice` *instance*):
the call site takes the instance as a parameter and calls `sr.Add`/`m.Combine` — **zero conditionals**. Swap
serial-sharp for parallel-soft by handing in a different instance; nothing else changes. This is:

- **dictionary-passing / typeclass-as-value** — the algebra travels as data, not as a type-baked behaviour.
  (This is exactly why the repo's instance-passing `ISemiring` is right, and why we did **not** bake numerics
  into the type via .NET static-abstract generic math: static-abstract fixes one impl *per type* — you
  cannot swap serial↔parallel without a new type. Instance-passing keeps the switch a value-swap.)
- **branch-free** — no `if` at the call site = no divergence (shader-friendly) and no misprediction (CPU).
- **scale-free (manifesto §1)** — the same code path runs beautifully on one core and on N; the *instance*
  carries the degree-of-parallelism, exactly like the DoP-knob on the ferry/throttle (async-all-the-way rule:
  DoP=1 deterministic serial ⇒ DoP=N parallel, same code, no special cases).

## Honest state + the gap this names

Today the `Result` (CPU/correctness) and `Sat` (shader) numerics are **two modules** — the caller picks
`DynamicValueNumeric.add` vs `DynamicValueNumeric.Sat.add` (and likewise `SoftValueNumeric`). That is
selection, but at *module* granularity (the caller names the module), not yet a single swappable **instance**.
To fully realize "swap one value, zero ifs":

- wrap each variant as an instance of a numeric-algebra **interface** (e.g. `INumericAlgebra<'T>` with
  `Add`/`Mul`/`Negate`/`Zero`/`One`), and let call sites take the interface — then serial-sharp, parallel-
  soft, etc. are interchangeable values.
- **the one real fork** to settle first: the `Result` variant and the `Sat` variant have **different return
  shapes** (`Result<'T,_>` vs total `'T`), so they cannot sit behind a *single* interface signature. Either
  (a) one interface per return-shape family (a `Result` algebra interface and a total/`Sat` algebra
  interface, each with serial/parallel/sharp/soft instances), or (b) unify on a total signature with an
  in-band poison (NaN) and drop `Result` from the swappable set. Recommend (a) — keep `Result` for the audit
  path, total for the swappable hot path. Backlogged (build pending this choice).

## The DUs are the algebras "in between" — CRDT-like vs consensus-like flows

Aaron: *"our DUs would be the algebras in between"* … *"consensus or crdt like flows."* The "combinations in
between" serial-sharp and parallel-soft are encoded as **discriminated unions**, and the way a DU's cases
*combine* is its algebra — which lands on one of the two coordination flows the system already names
(cells-as-geodes: **CommutativeView** vs **SerializedSaga**):

| in-between flow | the DU's combining algebra | execution | consistency |
|---|---|---|---|
| **CRDT-like** | **commutative + idempotent monoid** = join-semilattice (`ISemilattice`; G-Set / `WeightedSet` over a commutative semiring; LWW-register) | **parallel**, order-independent | AP (eventual) |
| **consensus-like** | **serialized total order** (arrival-order-canonical, compensation-not-retraction — the actor/saga) | **serial** | CP |

So the matrix isn't only `{sharp,soft}×{serial,parallel}` — the **DU is the selector that carries the
in-between**, and its combine-law decides the flow:

- a DU whose cases merge by a **join-semilattice** (commutative + idempotent) is a **CRDT** — it runs
  **parallel**, out-of-order, no coordination (the confluence theorem: out-of-order ⇒ same result *iff* the
  resolver is a join-semilattice). The parallel-soft-friendly side.
- a DU whose cases must be **totally ordered** (arrival-canonical) is a **consensus / serialized-saga** flow —
  **serial**, CP, the SerializedSaga lane.

This is **branch-free dispatch by *structure*, not ad-hoc `if`**: matching a DU case is exhaustive, typed
selection (the algebra is chosen by the data's shape), and the *merge/consensus* function — not a target
conditional — resolves it. Choosing CRDT-parallel vs consensus-serial is again a value/shape decision, not a
branch in the hot path. The DU *is* the in-between algebra; its combine-law *is* whether the flow is
CRDT-like or consensus-like.

## Beacon anchors

- **Typeclass-as-dictionary** (Wadler & Blott; the dictionary-passing translation) — the algebra as a passed
  value. · **Strategy pattern** (GoF) — interchangeable algorithm objects. · **Data-oriented / branchless
  design** (Acton) — avoid per-element branches; select once. · **GraphBLAS** — one sparse-LA API,
  semiring + backend selected, not branched. · **BLAS levels / MKL / cuBLAS** — same algebra (matmul) with
  serial / multi-core / GPU implementations behind one interface (Aaron's BLAS-at-MacVector anchor). ·
  Ours: instance-passing `ISemiring`/`IMonoid`/`ISemilattice`, `WeightedSet` (semiring as a parameter),
  `DynamicValueNumeric`/`SoftValueNumeric` `Result`+`Sat` variants (the first instances), the DoP-knob ferry
  (`async-all-the-way-truthful-signatures` rule), manifesto §1 scale-free, `SpineSelector` (the existing
  select-an-impl precedent). Honest novelty: none in strategy/dictionary-passing; the contribution is
  applying it as the **uniform discipline for the algebra layer** — one interface, a serial-sharp /
  parallel-soft / hybrid matrix of instances, swapped branch-free, so the same code lowers from one core to
  SIMD to shader by value-selection alone.
