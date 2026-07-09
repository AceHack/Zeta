---
id: 081KTH4Q78208QG0R0022E5Z3Z
type: task
state: backlog
priority: P3
slug: local-first-crdt-primitives-on-z-set-lww-register-or-set-rga
title: "Local-first CRDT primitives on Z-set (LWW-Register/OR-Set/RGA) + PSI as a private Z-set intersection"
created: 2026-06-07T13:35:24.930Z
depends_on: []
composes_with: ["081KSXN940008QG0R003FCQ7WT"]
---

# Local-first CRDT primitives on Z-set (LWW-Register/OR-Set/RGA) + PSI as a private Z-set intersection

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH4Q78208QG0R0022E5Z3Z-*.md` glob. -->

## STATUS (Otto 2026-06-07, corrected against the code)

Already in `src/Core/Crdt.fs` (with tests): **GCounter, PNCounter, OrSet, LwwRegister** — the workitem
over-listed LWW-Register/OR-Set as "missing"; they exist + are ordinal-clean. **LWW-Map LANDED** this round
(`LwwMap<'K,'V>` — per-key LwwRegister, tombstone remove, merge commutative/assoc/idempotent; 4 tests).
**RGA / sequence CRDT LANDED** this round (`Rga<'T>` — unique-id elements, After-anchor, tombstone remove,
sibling-order-by-id-DESC for convergence; merge commutative/assoc/idempotent; 4 tests incl. concurrent-insert
convergence). **Genuinely remaining:** **PSI** as a private Z-set intersection over the `.zc` transform.

## Purpose

Aaron 2026-06-07 ("we should do it in zset if it makes sense") after the privacy-first/local-first talk:
realize the local-first collaborative CRDT primitives on the DBSP Z-set substrate, where missing. We
already have G-Set / GCounter / Bag / Z-set (CRDTs by construction — commutative+associative+idempotent
merge). The local-first community relies on a few more:

- **LWW-Register** (last-writer-wins, by timestamp/lamport) — single-value CRDT.
- **OR-Set** (observed-remove set) — add/remove set with tombstones (Z-set retraction is close).
- **RGA / sequence CRDT** — collaborative ordered lists/text (the hard one; needed for collab editing).
- **PSI (private set intersection)** as a PRIVATE Z-set intersection over the PQ `.zc` privacy transform —
  find joins without revealing plaintext.

Each as a Z-set/Bag-shaped primitive with the 4-lang byte-lock + golden vectors (081KSXN940008QG0R003FCQ7WT). Full prior-art:
`docs/research/ip-questionable/2026-06-07-catherine-nimisha-privacy-first-...md`.

## Acceptance

The missing CRDTs implemented on Z-set (F# + TS first, then C#/Rust) with convergence-law tests
(commutative/associative/idempotent) + shared golden vectors; PSI prototype over `.zc`. Anchored to the
local-first/CRDT Beacon entries.

## Anchors

- CRDTs (Shapiro 2011) · local-first (Ink & Switch 2019) · `GSet`/`GCounter`/`Bag`/`ZSet` · `.zc` privacy
  transform (081KSNY2Z0008QG0R002JKH50A/081KT07NV0008QG0R0032MCYER) · 081KSXN940008QG0R003FCQ7WT (4-oracle checklist) · manifesto §6 consent-first.
