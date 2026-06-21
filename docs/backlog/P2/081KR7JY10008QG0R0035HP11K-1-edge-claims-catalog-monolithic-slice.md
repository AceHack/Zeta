---
id: 081KR7JY10008QG0R0035HP11K
priority: P2
status: closed
title: "Edge-claims catalog — monolithic TS implementation (11 CTF flags + schema)"
effort: L
created: 2026-05-10
last_updated: 2026-05-13
parent: 081KQ3HBZ0008QG0R001K0EC2C
depends_on: []
classification: landed
decomposition: monolithic-pending-redecomp
type: friction-reducer
tags: [edge-claims, CTF, catalog, schema, monolithic, re-decomp-target]
---

# 081KR7JY10008QG0R0035HP11K — Edge-claims catalog (monolithic slice)

## Origin

This row formalizes the slice that landed first under the 081KQ3HBZ0008QG0R001K0EC2C
frontier edge-claims CTF track. The implementation went directly to
code without a corresponding `.md` row — leaving 081KR7JY10008QG0R001JW71CT
(re-decomposition row) with a dangling `depends_on: [081KR7JY10008QG0R0035HP11K]`
reference against a row that didn't exist.

Restored 2026-05-13 as part of the substrate-hygiene sweep that
also recovered 081KR2E4K0008QG0R001J0536V..081KR2E4K0008QG0R0004B55ND and 081KR2E4K0008QG0R001SWEPNV (PR #3044), fixed the
notifier YAML-inline-comment parser bug (PR #3045), and created
081KR2E4K0008QG0R0003J0FB8 (sibling slice-row restoration in this PR).

## What landed

- `tools/research/edge-claims-catalog.ts` — typed TS schema + 11
  seed entries for the CTF frontier-flags track (~600 LOC,
  monolithic; intentionally large for first-pass exploration).

## Acceptance criteria (retroactive — all satisfied)

- [x] Catalog file exists at the canonical path
- [x] 11 CTF flags populated with stake-date + defense-surface +
      falsifiability hook
- [x] 081KR7JY10008QG0R001JW71CT (re-decomposition row) can reference it via
      `depends_on: [081KR7JY10008QG0R0035HP11K]`
- [x] Row file exists so backlog-ready-notifier no longer flags
      the dependency as dangling

## Re-decomposition status

081KR7JY10008QG0R001JW71CT is the canonical re-decomp row for this monolithic slice.
The plan: break the ~600 LOC monolith into smallest atomic TS
modules + corresponding backlog rows. Tracked via 081KR7JY10008QG0R001JW71CT.

## Composes with

- 081KQ3HBZ0008QG0R001K0EC2C (frontier edge-claims CTF track — parent)
- 081KR7JY10008QG0R001JW71CT (re-decomposition row depending on this slice)
- `tools/research/edge-claims-catalog.ts` (the monolithic
  implementation)

## Substrate-honest note

This row is a *retroactive* artifact — written 2026-05-13 to
document a slice that landed earlier without a row. Future slices
should land row-first, code-second; this row is the substrate
correction, not a precedent for code-first development. The
re-decomp work via 081KR7JY10008QG0R001JW71CT should happen row-first.
