---
id: 081KT07NV0008QG0R001PHV1ND
priority: P3
status: open
title: Ace registry incremental/paginated index — delta updates + range requests (deferred from slice 6)
effort: M
ask: operator 2026-06-01
created: 2026-06-01
last_updated: 2026-06-01
depends_on:
  - 081KT07NV0008QG0R000SJ34AK
composes_with: []
tags: [ace, package-manager, registry, remote, scaling, deferred-enhancement, slice-6]
---

## What this row proposes

Slice 6 (081KT07NV0008QG0R000SJ34AK, shipped via #6431) fetches the **entire** registry index as one signed
JSON document every revalidation (conditional GET: a 304 skips the body, a 200 re-downloads
the whole index). That is fine for a small/medium catalog but does not scale to a large
registry where the full index is many MB. This row tracks an **incremental/paginated
index**: fetch only the delta since the last-seen `sequence`, or page the index, so a
large catalog does not pay a full-index download on every change.

## Scope sketch

- A delta/append format: the signed index carries a base `sequence` + a list of
  per-package adds/removes since a prior `sequence`, OR a paginated set of signed
  sub-indexes (e.g. sharded by name-prefix) each independently verified.
- The three trust gates must still hold over the **reconstructed** catalog: signature on
  each delta/page (pinned key), monotonic `sequence` anti-rollback across the chain, and
  freshness on the newest segment. A missing/!-contiguous delta in the chain → hard refusal
  (no silent gap).
- Cache stores the reconstructed catalog + the high-water `sequence`; a delta applies onto
  the cached base.

## Why deferred (operator 2026-06-01)

A single full-index document is correct + simplest for the first remote-registry slice;
incremental fetch is a scaling optimization that only matters at large catalog size.
Operator: *"everything we skipped lets slice off for further enhancements."*

## Composes with

- 081KT07NV0008QG0R000SJ34AK (Ace remote registry — the slice this defers from)
- 081KT07NV0008QG0R001K340B3 (TUF role separation — snapshot/timestamp roles interact with incremental fetch)
- 081KR2E4K0008QG0R002YE3MMD (Ace DLC package manager CLI)
