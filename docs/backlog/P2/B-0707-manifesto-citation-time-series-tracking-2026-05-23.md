---
id: B-0707
priority: P2
status: closed
closed: 2026-05-23
closed_by: "4 of 5 acceptance criteria met (cron-cadence wiring deferred as separate follow-up concern); first snapshot landed at docs/hygiene-history/manifesto-citations/2026-05-23.json (2.8KB)"
title: "Manifesto citation time-series tracking — persistent snapshots + delta-over-time"
tier: governance
effort: S
created: 2026-05-23
last_updated: 2026-05-23
depends_on: [B-0525]
composes_with: []
tags: [manifesto, governance, time-series, hygiene-history]
type: friction-reducer
---

# B-0707 — Manifesto citation time-series tracking

## What

Extend `tools/hygiene/audit-manifesto-citations.ts` (shipped 2026-05-23 per B-0525) with a **persistent-snapshot mode** that writes per-day citation counts to a structured location and reports deltas-since-last-snapshot.

## Why

The 2026-05-23 baseline (88 files / 684 citations) is a single point. The B-0525 constitutional-promotion gate asks "are citations growing?" — that requires a time-series, not a snapshot.

## Acceptance criteria

- [x] `--snapshot` flag writes the count summary to a dated file under `docs/hygiene-history/manifesto-citations/YYYY-MM-DD.json` — shipped
- [x] `--delta` flag reads the most-recent prior snapshot + reports change-since-last per surface + per form — shipped (markdown + `--json` modes)
- [x] Snapshot file is git-committed (per substrate-or-it-didn't-happen) — `2026-05-23.json` (2.8KB) committed
- [x] Test coverage for snapshot + delta paths — 14 new tests added (30 total; 100% pass)
- [ ] ~~Composes with the daily razor-cadence workflow OR a new dedicated cron~~ — **deferred to a follow-up** (cron wiring is a separate concern; manual snapshot already useful; pre-commit gate or weekly cron candidate)

## Out of scope

- The `--report` markdown rendering already exists (shipped in slice 1)
- Cross-AI external citation detection (separate child of B-0525; needs external substrate ingestion)
- Constitutional-promotion gate decision logic (per B-0525: that's the human maintainer's call)

## Composes with

- B-0525 (parent — constitutional-promotion readiness tracking)
- `tools/hygiene/audit-manifesto-citations.ts` (the script this extends)
- `.claude/rules/encoding-rules-without-mechanizing.md` (cron-driven cadence pattern)
- `tools/hygiene/audit-rule-cross-refs.ts` (sibling count-then-classify pattern)

## Substrate-honest framing

P2 because: the slice-1 baseline (count snapshot) is the immediately-useful work; time-series adds future signal but isn't blocking any current decision. Naturally picked up when the constitutional-promotion conversation surfaces again.

## Origin tick

Filed as part of B-0525 slice 1 shipping (audit-manifesto-citations.ts; 2026-05-23). Child slice candidate identified in the same PR.
