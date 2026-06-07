# Cortical columns as sparse tensors — Numenta SDRs / Thousand Brains as a Beacon anchor for the sparse-tensor substrate (Aaron, 2026-06-07)

Aaron: *"the 1000 brains guy [Jeff Hawkins] says the cortical columns are sparse tensors."* A Beacon anchor
for the sparse-tensor work (`2026-06-07-tensor-algebra-tie-in-...`, `Globals`, `TensorRef`). Peeled to the
defensible claim — this is *prior art / formalism*, not "we built a cortex."

## The honest mapping

Numenta's **Sparse Distributed Representations (SDRs)** are the formal object: high-dimensional binary
vectors with **~2% active bits** (the rest zero). That is **a sparse tensor over the boolean semiring** —
the active-bit coordinates are exactly a Z-set/COO sparse tensor's support. So Hawkins' "sparse" is the same
sparse we mean, and SDRs are an instance of the substrate, not a new thing to build:

| Numenta / Thousand Brains | our substrate |
|---|---|
| **SDR** (~2% active binary vector) | **sparse tensor** — Z-set/`WeightedSet` over the boolean/integer semiring (active coords = support) |
| **SDR overlap** (# shared active bits = similarity, noise-robust) | **sparse contraction / inner product over the boolean semiring** = the overlap count; also the near-dup **similarity index** |
| **SDR union** (bitwise OR of representations) | **⊕ over the boolean semiring** (set-union; idempotent — a CRDT G-Set) |
| **reference frames** (grid/place-cell coordinate systems per object) | **coordinate/path addressing** of a `Global`/tensor (the subscript path *is* a reference frame) |
| **cortical-column voting** (many models, consensus) | **CRDT-merge / aggregation** across columns' sparse representations (commutative, order-independent) |

So the four threads converge on the *same* object: sparse tensor (algebra) = Z-set over a semiring
(substrate) = SDR (neuroscience formalism) = ragged `DynamicValue`/`Global` (document face). The semiring
choice picks the operation: **boolean** → SDR overlap/union (Numenta); **probability/interval** → soft
tensor (Bayesian); **integer** → Z-set/DBSP.

## Why it's a strong anchor (not hand-wave)

Numenta published the **math of SDRs** — capacity, false-match probability under fixed sparsity, union
properties, noise robustness (Ahmad & Hawkins, *Properties of Sparse Distributed Representations*, 2015).
Those are exactly the *quantitative* properties of sparse-tensor support sets: how many sparse vectors fit
without collision, overlap-as-similarity error bounds — directly reusable reasoning for our sparse-tensor /
similarity-index design. The Thousand Brains framing (reference frames + voting) further anchors the
**coordinate-addressing** (`Globals` paths) and **consensus-by-commutative-merge** (CRDT) choices.

## Honest scope (peel)

- This is **anchoring/formalism**, not a claim to implement HTM, sequence memory, or cortical learning. We
  borrow the **SDR sparse-tensor formalism and its math**, and note our substrate already expresses it.
- SDRs are **binary** (boolean semiring); our sparse tensor generalizes the weight to any semiring — SDR is
  the boolean instance, soft tensor the probability instance. The generalization is ours; the sparse-binary
  formalism is Numenta's.
- No buildable slice claimed here — it sharpens the Beacon anchors for the sparse-tensor backlog
  (`WeightedSet`/`ITensor`/`contract`), and supplies SDR-overlap math for the similarity-index design.

## Beacon anchors

- **Jeff Hawkins**, *A Thousand Brains: A New Theory of Intelligence* (2021); **Numenta HTM** — cortical
  columns, reference frames, voting. · **Ahmad & Hawkins**, *Properties of Sparse Distributed
  Representations and their Application to Hierarchical Temporal Memory* (2015) — the SDR math (capacity,
  overlap, false-match bounds). · **Grid/place cells** — O'Keefe; Moser & Moser (Nobel 2014) — the
  reference-frame neuroscience. · Ties (ours): `WeightedSet`/`ISemiring` (the sparse-tensor algebra — boolean
  semiring = SDR ops), the similarity-index doc (SDR overlap = sparse inner product), `Globals` (paths =
  reference frames), CRDT G-Set (SDR union = idempotent ⊕). Honest novelty: none in SDRs (Numenta) or sparse
  tensors; the contribution is recognizing **SDR = the boolean-semiring instance of our sparse-tensor
  substrate**, unifying Numenta's formalism with the Z-set/semiring/soft-tensor/global stack.
