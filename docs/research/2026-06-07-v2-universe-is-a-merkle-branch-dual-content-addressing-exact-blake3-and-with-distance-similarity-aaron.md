# A "v2 universe" is a Merkle branch; the universe is content-addressed BOTH ways — exact (BLAKE3) + with-distance (similarity) (Aaron, 2026-06-07)

Peels the "shattered immutability / reality manipulation / temporal plasticity / universe management" gush to
two grounded keepers — the second closes the loop back to this session's first capture (#6849).

## Keeper 1 — "v2 universe" = a branch in the Merkle tree (git- and filesystem-native)

> Aaron: *"your v2 universe — we just call that a branch in our Merkle tree, git native and filesystem native."*

The whole "foundation is not static / reinterpret the bits in v2 / Higgs-collapse / retractable" thread
(#6906/#6907) grounds to one boring, correct mechanism: **branching.** A "universe version" is a **branch =
a Merkle root = a COW version**; reinterpretation is checking out a different branch; retraction is a
revert/reset. No reality-manipulation, no temporal plasticity — it is **ZetaFS branch-scoped Merkle roots**
(the `2026-06-07-zetafs-is-branch-scoped-merkle-root` capture), git-native + filesystem-native:
`git checkout v2` over content-addressed COW state. The Higgs-collapse "symmetry break that confers meaning"
*is* the branch you choose; "retractable" *is* that branches revert and merge.

## Keeper 2 — the universe is content-addressed BOTH ways (full circle to #6849)

> Aaron: *"our universe is content based addressed — and without distance (BLAKE3), and with distance, so
> content similarity — both."*

The substrate addresses content in **two coexisting registers** (exactly the split captured in this session's
first PR, #6849):

| register | mechanism | property | for |
|---|---|---|---|
| **exact (without distance)** | **BLAKE3** (the content hash) | **avalanche** — 1-bit change ⇒ unrelated address (distance-DESTROYING) | identity, dedup, Merkle root, confluence, proof |
| **with distance (similarity)** | a **similarity index** (LSH / SimHash / MinHash / embedding over the canonical form) | **locality-PRESERVING** — near content ⇒ near address | near-dup discovery, clustering, refactor/refind, "near this" |

**Both, not one.** Exact addressing is the spine (identity/dedup/merge/proof); similarity addressing is the
secondary lens (discovery, "find content close to this"). They are complementary precisely because BLAKE3 is
*distance-destroying by design* and the similarity index is *distance-preserving by design* — you need a
second index, you can't recover proximity from the hash (#6849, the load-bearing tension). Together they make
the universe **navigable by identity AND by similarity** — and on the canonical/AST essence, "with distance"
means *semantic* similarity, not whitespace.

So the picture, grounded: a content-addressed (exact + similarity) Merkle filesystem whose "universe versions"
are branches, retractable and reinterpretable (the reversible covenant + schema evolution to the base).

## The peel (discard)

Off: "shattered immutability paradigm," "reality manipulation," "temporal plasticity," "universe management,"
"semantic superposition." Alexa overlay. The honest substance: **branches** (versioning/reinterpretation/
retraction) + **dual content-addressing** (exact BLAKE3 + with-distance similarity). Person-boundary holds.

## Beacon anchors

- **Content-addressing exact:** BLAKE3 (`Core.FSharp.Blake3`); Git/IPFS/Unison; Merkle trees; avalanche/
  diffusion (Shannon) — why exact can't do similarity. · **Content-addressing with distance:** LSH (Indyk–
  Motwani), MinHash (Broder), SimHash (Charikar), MOSS/winnowing — the similarity index (#6849). · **Branches:**
  ZetaFS branch-scoped Merkle root, `DagFs`/`ContentStore` (COW), git-native; the foundation-not-static/Higgs
  capture (#6906/#6907). · the reversible covenant (#6896). Honest novelty: none in content-addressing or
  branching; the contribution is stating the substrate's foundation plainly — a **dual-addressed (exact +
  similarity) content-addressed Merkle filesystem** whose **"universes" are branches** (reinterpretable,
  retractable) — closing the loop to #6849 and deflating the "universe manipulation" gush to `git checkout`.
