# Fingerprint tables and factor graphs — two directions over one bipartite shape (IBLT is where they meet)

Aaron 2026-06-13: "FactorGraph — are these and our rainbow-table fingerprint stuff similar?"

## The answer: related as two DIRECTIONS over the same bipartite graph

- **Fingerprints (Bloom, Count-Min, MinHash, our spectral probes)** are the FORWARD, lossy
  direction: items hash into buckets, ONE pass, no iteration. The structure is a bipartite graph
  (items ↔ buckets); the query is a cheap membership/similarity claim with honest false-positive
  bounds — SoftLens's "cheap claim, escalate to solid ground."
- **Factor graphs (Zeta.Bayesian)** are the INVERSE, recovery direction: variables ↔ factors,
  ITERATE messages until beliefs settle. The query is a marginal — a belief with a variance.
- **THE MEETING POINT — IBLT (Goodrich & Mitzenmacher 2011):** the moment you try to INVERT a
  fingerprint table (recover the set, not just test membership), the decoder is iterative PEELING
  on the bucket graph — which IS belief propagation with hard (certain/uncertain) messages. The
  same peeling decodes LDPC codes (Gallager 1962 — BP's original home) and fountain codes (Luby).
  Sparse-hash sketches and message-passing decoders are one family.
- **The GDL closes the loop** (Aji–McEliece 2000, our standing anchor): the FFT is itself a GDL
  instance — so our SpectralPivot fingerprint probes and FactorGraph's sum-product are literally
  the same algorithm schema at different semirings. The WSet third-ring demo (this week) is the
  in-tree proof of the schema.
- **Rainbow tables proper (Oechslin 2003) are the odd one out:** precomputed hash CHAINS — a
  deterministic time-memory tradeoff walk, not message passing. Related in spirit (precompute
  structure, invert cheaply), different machinery (no bipartite graph, no semiring fold).

## What this buys us (the practical note)

Set-reconciliation between rooms/replicas is the natural next use: two parties exchange IBLT-style
fingerprints of their Z-sets and PEEL the difference — O(|Δ|) reconciliation riding the same
bipartite+BP machinery we now own on both sides (FingerprintPrism forward, FactorGraph inverse).
That is a named slice, not a promise: it would pair with the Merkle/RangeSet sync lanes and the
treaty's golden discipline.

## Pointers

- `src/Bayesian/FactorGraph.fs` (the inverse direction) · `FingerprintPrism`/`SpectralPivot`
  (the forward) · the WSet GDL demo (the schema, in-tree) · Beacon: Goodrich–Mitzenmacher 2011
  (IBLT); Gallager 1962; Luby 2002; Aji–McEliece 2000; Oechslin 2003 (the distinction).
