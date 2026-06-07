# Model weights as globals: state_dict / embeddings / BNN-as-soft-tensor — the human-readable model API (Aaron, 2026-06-07)

Aaron: *"are you telling me I'm going to be able to navigate model weights with MUMPS verbs?"* — and
*"stoked, [a] model API that's human readable."* The honest yes-and-no, captured. Beacon-anchored; hype off.

## The sharp cut: structure YES, dense-leaf-cell-by-cell NO

The same sparse-vs-dense / ragged-vs-rectangular distinction as the tensor docs:

- **The model *structure* IS a global, exactly.** A PyTorch `state_dict` is `Dict[str, Tensor]` keyed by
  **dotted paths** — `encoder.layer.3.attn.q_proj.weight`. Split on `.` → a subscript path. So the MUMPS
  verbs over `DynamicValue` (the rebased `Globals`) navigate a model *natively*:
  - `nextChild ["encoder";"layer"] None` → enumerate layers (`$ORDER`);
  - `get ["encoder";"layer";"3";"attn";"q_proj";"weight"]` → fetch a leaf tensor (`$GET`);
  - `kill ["encoder";"layer";"3"]` → prune a block (`KILL`);
  - `nextNode` → walk every weight tensor depth-first (`$QUERY`);
  - `data path` → is this a submodule (10) or a parameter leaf (1)?
  This is the **human-readable model API**: the model is a browsable tree, addressed by meaningful names.
- **A dense weight *matrix* is the WRONG fit for path-per-element.** A `[4096×4096]` matrix has every cell
  defined; COO/path-per-cell stores the index with every value — hugely wasteful. Dense leaves want
  contiguous/strided buffers (Arrow); navigation there is strided indexing, not `$ORDER` over a sorted map.
  **You navigate *to* the tensor with MUMPS verbs; you index *into* it with dense addressing.** The leaf of
  the global is the dense tensor blob, not a million path-addressed scalars.

## Three cases where the *weights themselves* are genuinely global-shaped (not just structure)

1. **Embedding tables** — sparse-access by construction: a lookup *is* `$GET(^Emb, tokenId)`. A real global,
   not an analogy. (Same for MoE routing tables, sparse gating.)
2. **Sparse / pruned weights** — pruned matrices and expert weights *are* sparse; COO/CSF is the right
   layout and the verbs apply directly to the nonzeros.
3. **Bayesian weights → the soft tensor.** A BNN holds a *distribution per weight*, not a point. The model
   tree with `SoftValue` leaves (mean + uncertainty) *is* that representation — `DynamicValue`-over-
   `SoftValue` (the soft-tensor collapse). Marginalize/condition = contraction over a semiring. So "soft
   tensor" isn't decoration: it's the BNN weight store, navigable by the same verbs.

## What the substrate adds on top (the part MUMPS/Caché/PyTorch don't have together)

- **Content-addressing** — identical weight blocks **dedup** across checkpoints (exact BLAKE3 address); a
  fine-tune that touches 5% of weights stores ~5% new content. The near-dup **similarity index**
  (`2026-06-07-distance-based-content-addressing-...`) clusters *near*-identical blocks across fine-tunes.
- **Evolving schema over an infinite stream** (`2026-06-07-globals-over-dynamicvalue-evolving-schema-...`) —
  the model tree's shape can evolve with proven migrations while training streams updates (Z-set/DBSP fold).
- **Branch-scoped Merkle versions** — a checkpoint is a branch/root; diffing two models = diffing two
  globals; merging adapters/LoRA deltas = content-union merge.

## Honest scope

- This is the **navigation + addressing + versioning** layer over models, not a tensor compute engine. The
  dense math (matmul/attention) lives at the leaf in Arrow/native kernels; `Globals` addresses and versions
  the leaves, it does not replace BLAS.
- "Navigate weights with MUMPS verbs" = **yes** for the model tree, embeddings, sparse/uncertain weights;
  **no** (wasteful) for treating a dense matrix as one scalar per path.

## Beacon anchors

- **PyTorch `state_dict`** (dotted-path → tensor) — the model-as-global prior art, exactly. · **Safetensors /
  GGUF** — named-tensor model serialization (the leaf blob formats `Globals` would address). · **MUMPS
  globals** (1966) — the verbs. · **Embedding lookup** as sparse gather; **MoE** (Shazeer et al. 2017) —
  sparse expert routing. · **Bayesian neural nets** (Blundell et al., *Weight Uncertainty in NNs*, 2015) —
  distributions-as-weights = the soft tensor. · **Sparse tensor COO/CSF** (Smith & Karypis 2015). · Ties:
  the soft-tensor doc, the similarity-index doc, the evolving-schema doc, `Globals` (rebased on DynamicValue).
  Honest novelty: none in state_dict/embeddings/BNNs individually; the contribution is **one
  content-addressed, version-controlled, schema-evolving, MUMPS-navigable global** unifying model structure +
  sparse/uncertain weights + checkpoint dedup/diff/merge — a human-readable, git-like model store.
