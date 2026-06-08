# Block-storage primitive — requirement & scope (hitchhiker trees, out-of-band blocks)

**Aaron, 2026-06-07 (#7035)** — a requirement-capture, NOT a build (this is a large primitive needing the
full Zeta protocol):

> "we prob need some hitchhiker trees or something to support large files, or some non-table-based files
> too, or out-of-band block storage; we likely need block-storage algebra and code and tests and tearing
> and seed treaty and 4-lang and 4-serializer and such."

## Why it's needed (where it sits)

The layering is `stream → table → file` (#7034): tables/files are folds of the one event stream, with
content referenced by hash (reference-not-copy, #7002). That works for *structured/small* content, but:

- **Large files** don't belong inline in the event stream (no-binary-in-proof-lineage; the stream stays
  text/diffable). They need **out-of-band block storage** — the bytes live in blocks addressed by hash;
  the stream/table/file holds only the pointer (already the `File of contentHash` shape, #7002).
- **Non-table-based / opaque files** (media, binaries) aren't naturally rows — they're block sequences.
- **Big mutable structures** need a persistent, log-structured, copy-on-write index — **hitchhiker
  trees** (a B-tree / append-log hybrid: batches writes in-node then flushes, giving good write amplitude
  + structural sharing; used by Datomic / Datahike) are the named candidate.

So block storage is the layer **under `stream`** for large/opaque content: `block` = an out-of-band,
content-addressed byte range; `file`/`table` reference blocks by hash; a hitchhiker tree indexes them.

## Scope — this is a full primitive, needs the standard protocol

Aaron named the full treatment, which is exactly the Zeta primitive-development protocol (NOT a single
tick):

- **Block-storage algebra** — the operations + laws (content-address, split/chunk, concat, dedup, GC;
  likely a monoid/semilattice over blocks; chunking via FastCDC, already in-repo).
- **Code** — the F# reference implementation (+ hitchhiker-tree index for large mutable structures).
- **Tests + tearing** — property tests + **DST tearing** (fault/partial-write injection; "tearing" =
  torn-write / crash-mid-block fault classes — the durability story).
- **Seed treaty** — the canonical golden-vector seed (hex-in-JSON, no-binary-in-proof-lineage) that the
  oracles agree on.
- **4-lang oracle** — F# (reference) + C# + Rust + TS conformance.
- **4-serializer** — CBOR / Arrow / protobuf / (JSON) byte-locked golden vectors.

This is multi-PR work and should be a **backlog item**, routed through the primitive registry + likely
Soraya (formal coverage: which properties get TLA+/Z3/FsCheck) and Naledi (perf: block size, write
amplification). It is explicitly **not built here** — this doc records the requirement, the placement
(under `stream`, out-of-band), the prior art, and the protocol it must follow.

## Honest scope (peel)

Requirement + scoping only. No block-storage code, algebra, tests, seed, oracle, or serializer exists yet.
The `File of contentHash` pointer (#7002) and `ContentStore`/`CasStore`/`DagFs`/`FastCdc` already in-repo
are the substrate this would build on (content-addressing + chunking are present; the block-storage
*algebra* + hitchhiker-tree index + the full 4×4 protocol are the gap). Next step: file a backlog item and
route to the primitive process — do not let this capture read as "done."

## Anchors (Beacon)

- **Hitchhiker trees** — David Greenberg (Datomic/Datahike); fractal/Bε-trees (Bender et al.); the
  write-batching B-tree + structural-sharing design.
- **Content-addressed block storage** — IPFS/IPLD, Git packfiles, restic/borg chunk stores, ZFS blocks;
  **FastCDC** content-defined chunking (Xia et al. 2016 — already `FastCdc.fs`).
- **Out-of-band large objects** — Postgres TOAST/large objects, S3 multipart, Git LFS.
- **Torn-write / tearing durability** — power-loss/atomicity testing; DST fault injection (`ChaosEnv`).
- Internal: #7002 (`File of contentHash`), #6995 (pluggable backends incl. DagFs), #7034 (stream→table→
  file layering), `ContentStore.fs`/`CasStore.fs`/`DagFs.fs`/`FastCdc.fs`, no-binary-in-proof-lineage,
  seed-treaty / 4-lang / 4-serializer disciplines.
