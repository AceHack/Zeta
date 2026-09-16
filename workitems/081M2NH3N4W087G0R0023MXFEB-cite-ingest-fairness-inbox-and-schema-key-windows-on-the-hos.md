---
id: 081M2NH3N4W087G0R0023MXFEB
type: task
state: backlog
priority: P1
slug: cite-ingest-fairness-inbox-and-schema-key-windows-on-the-hos
title: "Cite ingest, fairness inbox, and schema/key windows on the host WAL"
created: 2026-09-16T16:34:27.612Z
depends_on: ["081M2K1PF0K087G0R001JAF8V4", "081M26HWSZ6087G0R00373BN0Q"]
composes_with: []
---

# Cite ingest, fairness inbox, and schema/key windows on the host WAL

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M2NH3N4W087G0R0023MXFEB-*.md` glob. -->

## Purpose

Three peels on one host `GroupCommitDiskDeltaLog`, not git jsonl:

1. Typed cite edges from factory docs into `CitedByIndex`.
2. Local fairness inbox so B sees inbound cites; reply cannot overwrite.
3. Schema deltas, evolution-window readers, and key-grant windows as events
   on the same WAL.

Depends on document ingest (`081M2K1PF0K087G0R001JAF8V4`) and the named
fairness protocol (`081M26HWSZ6087G0R00373BN0Q`).

## Acceptance

- Fixture: `cite A B reviews` plus a markdown link and a ZetaId replay to
  inbound `CitedBy` for B. Unknown relations are skipped, not coerced.
- `FairnessInbox` drain is subscriber-local; a second drain is empty; B's
  reply does not retract A's cite.
- Schema add + reader join/leave + a phase-bounded grant round-trip on one
  host directory. Grant expires by phase, no retract event. Crash recovery
  of the WAL stays `toy`.

## Limits (named)

- Closed relation vocabulary (citations-as-first-class). No CJK, no phrase
  search, no walking the Zeta tree in CI. EvolutionWindow still uses int
  reader versions (the existing gate), not SchemaZ prefix-as-version. This
  does **not** prove live catalog overlap, multi-planet schema, or TPM key
  material. Not FUSE. Not Apple.
