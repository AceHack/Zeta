# Distance-based content addressing: a similarity index alongside the exact content-address, for near-dup discovery (Aaron, 2026-06-07)

Riffs off the AST-as-essence / per-dev-style thread (`2026-06-07-canonical-essence-...`) and the
confluence lemma. Faithful capture; Beacon-anchored; **one honest tension peeled up front.**

## The insight

> Aaron: *"even if there are slight changes, if we use distance-based content-based addressing then we
> could discover those, because they would be very close to each other in content space."*

If "slightly changed" versions of the same code/doc land **near each other in an address space**, then
near-duplicates, refactor candidates, copy-paste-with-edits, and convergent independent solutions all
become **discoverable as neighbors** — not invisible the way exact hashing leaves them.

## The honest tension (peel first — this is load-bearing)

**A cryptographic content-address is deliberately distance-DESTROYING.** BLAKE3 (and any good hash) has
the **avalanche property** (Shannon diffusion): flip one input bit → ~half the output bits flip → a
completely unrelated address. That is *exactly what we want* for identity/dedup/Merkle/confluence (no
near-collisions, no forgery), and it is the **opposite** of "similar ⇒ nearby." So you **cannot** recover
proximity from the BLAKE3 address itself — the information is destroyed by design.

**Therefore: two distinct addressing schemes, side by side — not one.** This is the key correction to
make the idea sound:

| | **Exact content-address** (have it) | **Similarity address / index** (this proposal) |
|---|---|---|
| function | identity, dedup, Merkle root, confluence | "how close is this to that?" near-dup discovery |
| primitive | BLAKE3 (`ContentAddress128` / `ContentHash256`) | LSH / SimHash / MinHash / embedding over canonical AST |
| property | **avalanche** — 1-bit ⇒ unrelated | **locality-preserving** — similar ⇒ nearby |
| equality | exact byte equality | thresholded distance (ε-ball / k-NN) |
| answer | "are these the *same*?" | "are these *similar*, and how?" |

They are complementary, not competing. The exact address is the spine (dedup/merge/proof); the similarity
index is a **secondary lens** layered over the *same canonical essence*.

## Why this composes beautifully with what we already have

The synergy is genuine **because we canonicalize to AST-essence first** (the per-dev-style thread):

- **Distance on the canonical form ignores formatting.** Because style/whitespace is already stripped into
  the canonical AST, "close in content space" = **close in logic**, not close in whitespace. The similarity
  index measures *semantic* proximity for free — the thing that actually matters — without the noise.
- **It refines confluence/merge.** Exact-equal ⇒ dedup (confluence lemma). *Near*-equal ⇒ the merge
  resolver has a **real semantic conflict**, and the distance tells you **how** near — which can drive
  auto-reconciliation thresholds (tiny tree-edit-distance ⇒ likely auto-mergeable; large ⇒ surface to a
  human). Distance turns the binary same/different into a gradient the resolver can act on.
- **It rides the Merkle DAG.** Subtree hashes already give cheap exact-subtree dedup; a similarity index
  over subtrees gives cheap *near*-subtree clustering (shared-logic discovery across files/branches/repos).

## The shape (if/when built — backlogged, not built)

```
text → parse → canonical AST (essence)  ──┬──► BLAKE3 ──► exact content-address   (identity / dedup / merge)
                                          └──► fingerprint ──► similarity index   (LSH bucket / k-NN)
```

- **Fingerprint candidates** (pick per artifact class): **MinHash** over AST-shingles (Jaccard), **SimHash**
  over feature vectors (cosine), **winnowing** fingerprints (MOSS-style, robust to small edits), or a
  learned **code-embedding** (code2vec-style) for cross-style/cross-language semantic similarity.
- **Index**: LSH buckets for sub-linear approximate-nearest-neighbor; "find similar to this node" = query
  the bucket; clusters = natural code families.
- **Distance metric**: **tree-edit-distance** (Zhang–Shasha) on the AST is the principled "slight change"
  measure; cheaper shingle/embedding distance is the scalable approximation.

## Honest scope / cautions

- **Approximate, not a proof.** LSH/embeddings give *candidates*; near ≠ equal. Use it for discovery,
  suggestion, conflict-triage — never as the dedup/identity/proof key (that stays BLAKE3-exact).
- **Metric choice is per-artifact-class** and load-bearing; "content space" is not one canonical space —
  AST-shingle-Jaccard, feature-cosine, and learned-embedding give *different* neighborhoods. Name which.
- **Cost**: a second index to build/maintain incrementally; embeddings add a model dependency (hexagonal
  it behind a port, like BLAKE3, if we go learned). Start metric-based (MinHash/tree-edit), add learned later.
- This is a **discovery/tooling layer**, landed incrementally; it does not touch the exact-address spine.

## Beacon anchors

- **SimHash** — Charikar, *Similarity Estimation Techniques from Rounding Algorithms* (STOC 2002); Google
  near-dup web (Manku et al. 2007). · **MinHash** — Broder, *On the Resemblance and Containment of
  Documents* (1997). · **LSH / approximate-NN** — Indyk & Motwani (STOC 1998); Gionis–Indyk–Motwani 1999. ·
  **Winnowing / MOSS** — Schleimer, Wilkerson, Aiken (SIGMOD 2003) — local fingerprinting for code
  similarity/plagiarism (the closest prior art to "near-dup code over canonical form"). · **Tree edit
  distance** — Zhang & Shasha (1989). · **code2vec** — Alon, Zilberstein, Levy, Yahav (POPL 2019) —
  learned code embeddings where similar code clusters. · **Nilsimsa** (locality-sensitive spam hash) — the
  anti-avalanche hash precedent. · **Shannon** (diffusion/avalanche) — why the *exact* address can't do
  this, motivating the second index. · **Unison** (content-addressed code) — the exact-address spine this
  layers over. Honest novelty: none in LSH/near-dup itself (mature field); the contribution is **a
  similarity index over the content-addressed canonical-AST essence** — semantic (style-invariant)
  proximity unified with the exact-address dedup/merge/confluence substrate, distance feeding merge-conflict
  triage.
