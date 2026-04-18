# References

External material we study to keep Dbsp.Core honest. Two kinds:

1. **Authored notes** under `references/notes/` — our own
   write-ups synthesising what matters from each upstream.
2. **Disposable mirror state** under `references/upstreams/` —
   cloned upstream repositories used as read-only references.
   **Gitignored; regeneratable via script; never hand-edited.**
3. **Per-upstream package notes** under `references/<name>/` —
   legacy imports (currently `tla-book/`) that came from other
   projects with their own file layouts. These will be rationalised
   into `references/notes/` as we cite them.

See `docs/UPSTREAM-LIST.md` for the curated watchlist + category
index; see `docs/TECH-RADAR.md` for our own Adopt/Trial/Assess/
Hold rings.

## Layout

```
references/
├── README.md                      (this file)
├── reference-sources.json         (machine-readable manifest)
├── notes/                         (authored synthesis; commit these)
│   ├── RESEARCH-NOTES.md
│   └── ...
├── upstreams/                     (GITIGNORED; sync-script-managed)
│   ├── feldera/
│   ├── slatedb/
│   └── ...
└── tla-book/                      (Lamport *Specifying Systems* PDF)
```

## Policy

- **Never hand-edit `references/upstreams/<name>/`.** It is
  disposable. If it's wrong, fix the sync script or the
  upstream URL in `reference-sources.json`, then re-sync.
- **Authored notes only in `references/notes/`.** One `.md` per
  topic, named `<TOPIC>-NOTES.md` in SCREAMING-KEBAB-CASE.
- **Every upstream in `reference-sources.json` has a
  one-sentence "why this matters."** Kept in sync with the
  prose in this README.
- **Adding a source:** append a row to
  `reference-sources.json`, add a one-liner below in the
  **Upstreams** section, run the sync script (when it exists).
- **Removing a source:** remove the row + the prose line; the
  sync script, next invocation, is authorised to delete the
  now-orphan `upstreams/<name>/` mirror.

## Upstreams

### Streaming / IVM
- **Feldera** — Rust DBSP reference; our closest incremental-
  SQL competitor. Apples-to-apples benchmark pending.
- **Materialize** — Streaming SQL warehouse; always-fresh
  materialized views; Differential Dataflow under the hood.
- **Differential Dataflow / Timely** — McSherry et al.; the
  foundations our `Recursive` combinator references.
- **Naiad** — Abadi et al. SOSP 2013; multi-dimensional logical
  time.
- **Noria** — Gjengset SOSP 2018; partial-materialisation read
  store.

### Storage substrates
- **FASTER HybridLog** (MSR) — closest .NET-native prior art
  for `DiskSpine`.
- **TigerBeetle** — LSM-forest + VOPR simulator; inspiration
  for deterministic simulation testing.
- **SlateDB** — CAS-manifest + `writer_epoch` pattern; verdict:
  adopt pattern, don't clone code.
- **RocksDB / LevelDB / LMDB** — embedded LSM / B+tree
  references.
- **FoundationDB** — Will Wilson's DST discipline; `ChaosEnv.fs`
  + `VirtualTimeScheduler` borrow directly.

### Event stores / replicated logs
- **EventStoreDB / Kurrent** — typed outcome APIs inform our
  `OutcomeDU` sketch.
- **Kafka / Redpanda / BookKeeper** — replicated-log references.
- **NATS** — subject-based pub/sub wire-protocol reference;
  lightweight control-plane candidate (circuit registration,
  shard gossip, liveness) alongside the Arrow Flight data plane.
  See `references/notes/NATS-RESEARCH.md`.
- **NATS JetStream** — durable streaming layer on top of NATS
  (successor to retired "NATS Streaming / STAN"); stream +
  consumer abstractions, RAFT replication, and
  `AckExplicit`/`AckAll`/`AckNone` policies that map onto our
  `DurabilityMode` variants. Candidate retraction-native
  ingestion source for `ZSet` delta feeds. Correctness story is
  unproved — no Jepsen, no published TLA+ — noted in
  `docs/security/THREAT-MODEL.md`.

### Formats / wire
- **Apache Arrow + Flight** — columnar in-memory + wire format.
  Used in `ArrowSerializer.fs`; Flight planned for multi-node.
- **Parquet / ORC / Iceberg / Delta Lake** — object-store table
  formats; reference for Z-set-aware SST layout research.
- **Protobuf / Cap'n Proto / FlatBuffers / MessagePack** —
  serialisation references (we use FsPickler + Arrow IPC
  primarily).

### Temporal / bitemporal / graph
- **Datomic** — AEVT/AVET indexes; inspiration for
  closure-table-style `Hierarchy.fs`.
- **XTDB 2** — Arrow bitemporal indexes; temporal-query
  inspiration.
- **Neo4j / Memgraph / Dgraph / JanusGraph / NebulaGraph** —
  graph-database references.

### Sketch / AMQ literature
- **Ceramist** (Coq-verified AMQs) — formal-verification bridge
  candidate for our Lean port.
- **CQF paper** (Pandey SIGMOD 2017) — Trial upgrade path for
  `BloomFilter.fs`.

### Formal verification
- **Lamport *Specifying Systems*** — TLA+ canonical reference
  (PDF at `references/tla-book/`).
- **Newcombe et al., *How AWS Uses Formal Methods*** (CACM 2015)
  — the paper that sold the repo on TLA+.
- **Izraelevitz et al. DISC'16** — buffered durable
  linearizability; correctness model for durability modes.

### Category theory
- **CTFP (Milewski)** — required-reading foundation for the
  operator algebra vocabulary. Local PDF at
  `docs/category-theory/ctfp-milewski.pdf`.

### Threat modelling
- **Adam Shostack, *Threat Modelling*** + **EoP card game**
  (PDFs at `docs/security/eop-*.pdf`).
- **Microsoft SDL (12 practices)** — basis for
  `docs/security/SDL-CHECKLIST.md`.

### Legacy-import containers
- `references/tla-book/` — Lamport's *Specifying Systems* PDF.

## Sync script (pending)

A `scripts/references/sync.sh` / `sync.ps1` pair is planned to
populate `references/upstreams/` from `reference-sources.json`.
Until it lands, an upstream that needs to be cloned is cloned
manually once under `references/upstreams/` (gitignore already
excludes it).
