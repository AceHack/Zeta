---
id: B-0055.1
zetaid: 081KR7JY10008QG0R0035HP11K
priority: P2
status: closed
title: "Edge-claims catalog — monolithic TS implementation (11 CTF flags + schema)"
effort: L
created: 2026-05-10
last_updated: 2026-05-13
parent: B-0055
depends_on: []
classification: landed
decomposition: monolithic-pending-redecomp
type: friction-reducer
tags: [edge-claims, CTF, catalog, schema, monolithic, re-decomp-target]
---

# B-0055.1 — Edge-claims catalog (monolithic slice)

## Origin

This row formalizes the slice that landed first under the B-0055
frontier edge-claims CTF track. The implementation went directly to
code without a corresponding `.md` row — leaving B-0055.2
(re-decomposition row) with a dangling `depends_on: [B-0055.1]`
reference against a row that didn't exist.

Restored 2026-05-13 as part of the substrate-hygiene sweep that
also recovered B-0257..B-0261 and B-0289 (PR #3044), fixed the
notifier YAML-inline-comment parser bug (PR #3045), and created
B-0054.1 (sibling slice-row restoration in this PR).

## What landed

- `tools/research/edge-claims-catalog.ts` — typed TS schema + 11
  seed entries for the CTF frontier-flags track (~600 LOC,
  monolithic; intentionally large for first-pass exploration).

## Acceptance criteria (retroactive — all satisfied)

- [x] Catalog file exists at the canonical path
- [x] 11 CTF flags populated with stake-date + defense-surface +
      falsifiability hook
- [x] B-0055.2 (re-decomposition row) can reference it via
      `depends_on: [B-0055.1]`
- [x] Row file exists so backlog-ready-notifier no longer flags
      the dependency as dangling

## Re-decomposition status

B-0055.2 is the canonical re-decomp row for this monolithic slice.
The plan: break the ~600 LOC monolith into smallest atomic TS
modules + corresponding backlog rows. Tracked via B-0055.2.

## Composes with

- B-0055 (frontier edge-claims CTF track — parent)
- B-0055.2 (re-decomposition row depending on this slice)
- `tools/research/edge-claims-catalog.ts` (the monolithic
  implementation)

## Substrate-honest note

This row is a *retroactive* artifact — written 2026-05-13 to
document a slice that landed earlier without a row. Future slices
should land row-first, code-second; this row is the substrate
correction, not a precedent for code-first development. The
re-decomp work via B-0055.2 should happen row-first.
