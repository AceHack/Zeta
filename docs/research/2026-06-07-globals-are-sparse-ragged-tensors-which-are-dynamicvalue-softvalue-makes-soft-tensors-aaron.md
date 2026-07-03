# Ragged sparse tensors ARE DynamicValue; SoftValue leaves make them soft tensors (Aaron, 2026-06-07)

Refines the `Globals` capture (`2026-06-07-cache-multimodel-globals-...`). Faithful capture; a **Rodney's-
Razor read on the just-landed `Globals` primitive** (it partly re-derives DynamicValue). Beacon-anchored.

## The chain

1. A Caché/MUMPS **global** = a **sparse multidimensional array** (prior doc).
2. **vs tensor**: a tensor is a *dense, rectangular, fixed-shape* multidimensional array; a global is the
   **ragged/jagged** version — *"no declared shape"* (Aaron's "sharp" = **ragged**, not "sparse"; the
   distinguishing property is the absence of a declared rectangular shape).
3. **The collapse (Aaron):** *"but this is just DynamicValue — SoftValue even makes this soft."*

## What this means — the essential form

A **ragged, sparse, heterogeneous, path-addressed tree IS exactly `DynamicValue`.** DynamicValue is already:
the nested-Map/Array variant *is* the sparse multidimensional array; **no declared shape** (ragged); **leaves
of any type** (heterogeneous); **string/int subscripts = the path**. So:

> **A "global" / ragged sparse tensor is not a new structure — it is a navigation API over `DynamicValue`.**

And the soft version drops out for free:

> **`DynamicValue` with `SoftValue` leaves = a SOFT (probabilistic / uncertainty-bearing) sparse ragged
> tensor** — every cell carries a Bayesian value-with-uncertainty instead of a sharp scalar. The
> incompressible-residual / Bayesian-uncertainty thread (`2026-06-07-incompressible-residual-as-bayesian-
> uncertainty`) applied pointwise across a multidimensional index space.

| | sharp tensor | sharp global | **soft tensor (this)** |
|---|---|---|---|
| structure | dense rectangular | ragged sparse | ragged sparse |
| address | int tuple | string path | string path |
| cell | scalar | `DynamicValue` leaf | **`SoftValue` leaf** |
| home | ndarray lib | `DynamicValue` | **`DynamicValue` over `SoftValue`** |

## Rodney's-Razor read on the landed `Globals` primitive (honest self-indictment)

`Globals<'V>` (PR #6850) backs itself with a **parallel `Map<Path,'V>` store** — which **re-derives the
ragged-tree structure DynamicValue already is.** That's **accidental complexity**: the *essential* content is
"MUMPS-verb navigation (`set`/`get`/`kill`/`$DATA`/`$ORDER`/`$QUERY`) over the canonical ragged tree," and
the canonical ragged tree is DynamicValue, not a fresh `Map`. The **verbs are genuinely useful**; the
**separate store is not.** Correct shape: `Globals` verbs operate **over `DynamicValue`** (and, specialized,
over `DynamicValue` with `SoftValue` leaves → the soft-tensor API). Re-basing it:

- deletes the parallel structure (one ragged tree in the system, not two);
- gives soft tensors *for free* (the verbs are value-generic over the DV leaf);
- unifies with every DV consumer (codecs, CBOR/JSON byte-lock, content-addressing, lenses/projections).

Backlogged as a consolidation (rebase `Globals` onto `DynamicValue`); decision pending (see below).

## Why the soft tensor is worth having (not just tidy)

- **Belief over a sparse index space** — a probabilistic EAV / sparse contingency table / soft master-data
  cube: each `(subscripts)` cell is a distribution, not a point. Marginalize/condition = tensor contraction
  over a semiring (sum-product = belief propagation).
- **Tensor unfolding = the multi-model lens** (prior doc) now carries uncertainty through the projection.
- Ties the compression/Bayesian arc to a concrete data structure: the *sharp* tensor is the compressed
  generator output; the *soft* tensor is generator-output **+ residual uncertainty** in one object.

## Beacon anchors

- **Sparse tensor formats** — COO (coordinate list) / **CSF** (compressed sparse fiber; Smith & Karypis,
  IPDPS 2015) — the scaling layout for a global-as-sparse-tensor (lands on Arrow columnar). · **Ragged /
  jagged arrays** — the no-declared-shape lineage (MUMPS globals, 1966; nested/jagged arrays). ·
  **Probabilistic / soft tensors** — tensor decomposition over semirings; **sum-product networks** (Poon &
  Domingos 2011); factor graphs / belief propagation (the contraction semantics for soft cells). · **EAV /
  sparse contingency tables** — the relational shadow of a sparse global. · DynamicValue + SoftValue (ours)
  — the essential home. Honest novelty: none in sparse/soft tensors; the contribution is recognizing
  **DynamicValue *is* the ragged sparse tensor and DynamicValue-over-SoftValue *is* the soft tensor**, with
  MUMPS-verb navigation as the API — collapsing the `Globals` primitive into the existing substrate.
