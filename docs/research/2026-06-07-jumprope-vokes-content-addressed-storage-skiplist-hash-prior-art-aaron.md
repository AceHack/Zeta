# Jumprope (Scott Vokes, Strange Loop 2012) — content-addressed storage with a hash-as-probability skiplist; prior art for our COW store (Aaron, 2026-06-07)

Aaron shared **Scott Vokes — "Data Structures: The Code That Isn't There"** (Strange Loop 2012), whose
**Jumprope** is direct prior art for our content-addressed store (`ContentStore`/`DagFs`/Merkle-DAG fs).
Beacon anchor (`anchor-to-human-prior-art`). The "content-based hashing with distance measurements" Aaron
noted = the **skiplist express-lanes** (jump-by-2, jump-by-4) used for seeking, with a **hash as the
probability function** so the structure is deterministic from content.

## The Jumprope (verbatim shape from the talk)

Content-addressable storage for large binary strings/files — *"kind of like a git repo but much better for
big files."* Three structural elements, backed by a key-value store:

- **Leaf** — a chunk of raw data.
- **Limb** — a series of content hashes + their links, stored in an array.
- **Trunk** — a limb with a big end node.

Properties: *"somewhat like a skiplist that uses a hash as its probability function"*; **persistent +
immutable** (cache anywhere); **CAS instead of pointers** (lock-free, emergence from local behavior);
**rolling hash** for content-defined chunking (deterministic breaks, cheap block matching — the rsync
family); **tunable** bad-performance guarantees (1%, .1%, …); excellent **seeking** for streaming /
pipelining content; ~2 KB limb-node / 64 KB leaf-node overhead; trivial to fetch / stream / mirror; used
for a distributed FS ("scatterbrain"), "similar to Amazon Dynamo."

Framing quotes worth keeping: *"A data structure is just a stupid programming language"* (Gosper) → *"A data
structure is just a [tiny] virtual machine"* (Vokes); *"The cheapest, fastest, and most reliable components
are those that aren't there"* (Gordon Bell) — the talk's thesis that the right data structure **subtracts
code**.

## How it anchors / informs Zeta

- **Our content-addressed store IS the Jumprope/CAS family** — name the anchor rather than claim novelty.
  `ContentStore` (single-instance, CAS, immutable/COW) + the Merkle-DAG fs are the same lineage.
- **We already have the rolling-hash chunker:** `FastCdc.fs` (Xia et al., USENIX ATC 2016) = the
  content-defined chunking Vokes uses; `Merkle.fs` hashes the chunks. So `FastCdc` + `Merkle` + the new
  `ContentStore` = a Jumprope, modulo the seekable skiplist layer.
- **The gap a Jumprope fills (a design lead, backlogged):** `ZSetMerkle` is a Merkle tree over *structured
  Z-set* data; a **Jumprope-style skiplist-over-content-hashes** is the right node type for **large blobs /
  streaming** — seekable, tunable, dedup'd. A `DagFs` leaf whose content is a big file should be a Jumprope
  (Leaf/Limb/Trunk over `FastCdc` chunks), not a single ZSet-Merkle node. Complementary, not a replacement.
- **CAS-not-pointers + emergence-from-local + tunable guarantees** map onto our standing disciplines:
  lock-free/wait-free (#2), scale-free (#1), weight-free (#3), DST-tunable. *"Roundabouts, not traffic
  lights"* (decentralized, local decisions, low lock contention) is the same intuition as our scale-free bus.
- *"A data structure is a tiny virtual machine"* is a nice Beacon framing for **DynamicValue-as-carrier /
  behavior-as-data** (the value describes + runs behavior).

## Backlogged

A Jumprope-style seekable large-blob content node (Leaf/Limb/Trunk skiplist over `FastCdc` chunks +
`Merkle`/content hashes) as the big-file leaf type in the store — filed for when the store handles blobs.

## Beacon anchors

- **Scott Vokes**, *Data Structures: The Code That Isn't There* (Strange Loop 2012) — the **Jumprope**
  (content-addressed large-file storage; skiplist-with-hash-probability; Leaf/Limb/Trunk; CAS; tunable). ·
  **William Pugh**, *Skip Lists* (1990) — probabilistic balanced structure. · **Andrew Tridgell**, rsync
  rolling hash; **FastCDC** (Xia et al., 2016) — content-defined chunking (we ship it). · **Bagwell /
  Okasaki** — persistent immutable structures. · **Amazon Dynamo** (DeCandia et al., 2007) — CAS / gossip /
  tunable consistency. · **Merkle** (1987); **git object model**; **IPFS** (Merkle-DAG CAS). Honest novelty:
  none in CAS itself — we adopt the lineage; the contribution is unifying it with the DBSP Z-set / Merkle /
  schema-evolution substrate under one interface.
