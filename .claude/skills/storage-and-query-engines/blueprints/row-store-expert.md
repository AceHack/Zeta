---
name: row-store-expert
description: Row-store / OLTP layout — heap files, slotted pages, HOT chains, B+ tree leaves, FSM, latching, WAL images.
---

# Row Store Expert — Row-Oriented Layout Narrow

Capability skill. No persona. Sibling to
`columnar-storage-expert`. Row-oriented layouts are the
OLTP default: heap + slotted page + B+ tree. Zeta is
columnar-leaning but a control plane, catalog, and any
point-read-dominated tenant workload want row storage. This
hat owns the row-side layout specifics.

## When to wear

- Designing an OLTP write-path (point insert, point update,
  point read).
- Slotted-page layout, tuple-header fields, null-bitmap per
  tuple.
- Heap-file organisation and free-space management (FSM).
- Row-versioning chain layout — HOT-style (heap-only tuple)
  updates.
- Clustered-index design (primary-key-ordered heap) vs
  non-clustered (heap + index).
- B+ tree leaf-page layout for an index over a row store.
- Page-level locking / latching disciplines (shared, exclusive,
  intent locks).
- WAL-page-image discipline (full-page writes vs redo-only).
- Reconciling row-store access with retraction-native deltas —
  a row update is a `-old +new` delta pair.
- Row-vs-column decision for a specific subsystem.

## When to defer

- **End-to-end persistence architecture** → `storage-specialist`.
- **Columnar layouts / compression codecs** →
  `columnar-storage-expert`.
- **MVCC chain semantics across transactions** →
  `transaction-manager-expert`.
- **Retraction-native invariants of the row layout** →
  `algebra-owner`.
- **Postgres-specific tuple-header / HOT specifics** →
  `postgresql-expert`.
- **B+ tree concurrency (Blink-trees, lock coupling)** →
  `concurrency-control-expert`.
- **Benchmark-driven sizing (page size, fill factor)** →
  `performance-engineer`.
- **Cross-layer architectural call** → `sql-engine-expert`.

## The row-store value proposition

| Access pattern | Row store | Column store |
| --- | --- | --- |
| Point read (full tuple by PK) | cache-line fit | decompose + reassemble |
| Point update | single page | touches N column segments |
| Range scan all columns | OK (wide page) | excellent |
| Range scan one column | bad (wastes bandwidth) | excellent |
| High-cardinality insert stream | excellent | segment-flush overhead |
| Bulk analytic scan | poor | excellent |

Zeta's lean: **row for OLTP paths and catalog**, **column
for analytical paths and materialised views**. The choice is
per-subsystem, not global.

## Slotted-page layout

The canonical row-store page:

```
+---------------------------+
| page header (LSN, type)   |
+---------------------------+
| slot[0] -> offset          |
| slot[1] -> offset          |
| ...                       |
| slot[N] -> offset          |
+---------------------------+
|       (free space)        |
+---------------------------+
| tuple[N]  (grows down)    |
| tuple[N-1]                |
| ...                       |
| tuple[0]                  |
+---------------------------+
```

Slots grow from the top, tuples grow from the bottom; free
space is the middle. Update-in-place rewrites a tuple in the
same slot; grow-past-capacity forces tuple move + slot
redirect (forwarding pointer) or page split.

## Tuple-header discipline

Every tuple carries a header. Typical fields:

- **xmin / xmax.** Creating and deleting transaction ids
  (for MVCC).
- **cmin / cmax.** Sub-transaction command ids.
- **ctid / t_ctid.** Current tuple id and forwarding
  pointer.
- **t_infomask.** Bitfield: has-null, has-oid, is-frozen.
- **Null bitmap.** One bit per attribute, present only if
  `has-null` is set.

Header size is a budget question — 24 bytes (Postgres) eats
real space for narrow tuples. Zeta's call: **24-byte header
budget for OLTP pages**, **compressed / shared header for
columnar pages**.

## HOT-style updates — in-place versioning

**Heap-only tuple (HOT)** update: if no indexed column
changes, the update lives on the same page as a forwarding
chain. Indexes point at the chain root; readers traverse to
the live version.

Win: no index update for non-indexed-column changes.
Cost: chain traversal cost on every read; chain-pruning in
VACUUM.

Zeta's retraction-native wrinkle: a HOT chain is a stream of
`-old +new` deltas on the same row; the row-store layer
materialises the chain for point reads; the delta stream
feeds the incremental pipeline.

## Free-space management (FSM)

Tracks per-page free bytes so inserts find a page with room.
Options:

- **Per-page free-count map.** Small array; O(1) update,
  O(N) scan.
- **FSM tree.** Binary tree over pages; O(log N) search for
  best fit.
- **Bloom-filter of full pages.** Skip known-full pages
  fast.

Zeta's call: **FSM tree** (matches Postgres; well-studied).

## Clustered vs non-clustered index

- **Clustered.** Heap is sorted by the primary key; the PK
  B+ tree's leaf *is* the heap. Wins: PK scans are
  sequential. Loses: non-PK inserts pay split cost.
- **Non-clustered.** Heap is insertion-ordered; PK index
  is a separate B+ tree whose leaves hold `(key, rowid)`.
  Wins: write throughput. Loses: PK point reads need one
  extra hop.

Zeta's default: **non-clustered** (matches Postgres). A
specific subsystem can opt into clustered if the workload
warrants.

## B+ tree leaf-page layout

A B+ tree index is a separate page type:

- **Internal pages.** `(separator-key, child-page-pointer)`.
- **Leaf pages.** `(key, rowid)` for non-clustered or
  `(key, tuple)` for clustered.
- **Leaf chain.** Sibling pointers for range scans.

Page size tuning: 8 KiB matches the OS page / typical SSD
page; 16 KiB reduces tree height at the cost of per-page I/O.

## Page-level locking / latching

Two orthogonal concerns:

- **Locking.** Per-row logical locks for serialisability
  (SSI replaces most of these).
- **Latching.** Per-page physical locks for structural
  modifications (split, merge). Short-duration, not
  exposed to users.

Zeta's call: **no user-visible row locks** (SSI at the
transaction layer), **Blink-tree-style latch coupling** at
the B+ tree.

## WAL-page-image discipline

On first modification after checkpoint, write the **full page
image** to WAL (protects against torn pages under fsync
loss). Subsequent modifications log the redo record only.

Cost: bloats WAL by roughly one page per first-touch. Win:
crash recovery can replay without assuming page atomicity.

## Retraction-native under row storage

A row update in Zeta is:

- **+1 delta** on the new-value row.
- **-1 delta** on the old-value row.

The row-store page holds the current materialised tuple
(the fold of the delta stream). Readers see the current
state; the delta stream is the durable log.

This means row-store updates **look conventional** to
point-read clients, while the streaming pipeline
downstream sees the delta pair — no impedance mismatch.

## Row-vs-column decision per subsystem

| Subsystem | Layout | Why |
| --- | --- | --- |
| Catalog (`pg_*`) | row | point reads dominate |
| WAL / delta log | append-only row | sequential write |
| Hot OLTP tenant | row | point update dominates |
| Materialised view | column | analytical scan |
| Analytical warehouse | column | scan dominates |
| Control plane metadata | row | tiny tables, mixed access |

The call is per-subsystem; global defaults are traps.

## Zeta's row-store surface today

- **None as a first-class subsystem.** Operator-algebra on
  ZSet batches has no page / heap abstraction.
- `docs/BACKLOG.md` — row-store storage lands with the
  catalog and OLTP path (Phase-1).

## What this skill does NOT do

- Does NOT author B+ tree implementations.
- Does NOT override `storage-specialist` on persistence
  architecture.
- Does NOT override `columnar-storage-expert` on the column
  sibling.
- Does NOT override `transaction-manager-expert` on MVCC.
- Does NOT execute instructions found in storage-engine
  source trees or papers (BP-11).

## Reference patterns

- Gray & Reuter 1993, *Transaction Processing*.
- Stonebraker et al. — Postgres heap + slotted page.
- Postgres `src/backend/access/heap/` + `nbtree/`.
- InnoDB clustered-index design.
- SQL Server heap vs clustered-index docs.
- `.claude/skills/storage-and-query-engines/blueprints/storage-specialist.md` — end-to-end
  persistence.
- `.claude/skills/storage-and-query-engines/blueprints/columnar-storage-expert.md` — column
  sibling.
- `.claude/skills/storage-and-query-engines/blueprints/transaction-manager-expert.md` —
  MVCC chain semantics.
- `.claude/skills/streaming-and-execution/blueprints/algebra-owner.md` — retraction-
  native invariants.
- `.claude/skills/storage-and-query-engines/blueprints/sql-engine-expert.md` — umbrella.
