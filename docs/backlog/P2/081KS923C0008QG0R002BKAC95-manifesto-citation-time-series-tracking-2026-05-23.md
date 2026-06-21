---
id: 081KS923C0008QG0R002BKAC95
priority: P2
status: closed
closed: 2026-05-23
closed_by: "ALL 5 acceptance criteria met — cron-cadence wiring shipped at .github/workflows/manifesto-citation-snapshot-cadence.yml (daily 06:37 UTC; branch-handoff per GitHub Actions PR-creation permission limits); first snapshot landed at docs/hygiene-history/manifesto-citations/2026-05-23.json (2.8KB)"
title: "Manifesto citation time-series tracking — persistent snapshots + delta-over-time"
tier: governance
effort: S
created: 2026-05-23
last_updated: 2026-05-30
depends_on: [081KRHWGX0008QG0R0016T9408]
composes_with: []
tags: [manifesto, governance, time-series, hygiene-history]
type: friction-reducer
---

# 081KS923C0008QG0R002BKAC95 — Manifesto citation time-series tracking

## What

Extend `tools/hygiene/audit-manifesto-citations.ts` (shipped 2026-05-23 per 081KRHWGX0008QG0R0016T9408) with a **persistent-snapshot mode** that writes per-day citation counts to a structured location and reports deltas-since-last-snapshot.

## Why

The 2026-05-23 baseline (88 files / 684 citations) is a single point. The 081KRHWGX0008QG0R0016T9408 constitutional-promotion gate asks "are citations growing?" — that requires a time-series, not a snapshot.

## Acceptance criteria

- [x] `--snapshot` flag writes the count summary to a dated file under `docs/hygiene-history/manifesto-citations/YYYY-MM-DD.json` — shipped
- [x] `--delta` flag reads the most-recent prior snapshot + reports change-since-last per surface + per form — shipped (markdown + `--json` modes)
- [x] Snapshot file is git-committed (per substrate-or-it-didn't-happen) — `2026-05-23.json` (2.8KB) committed
- [x] Test coverage for snapshot + delta paths — 14 new tests added (30 total; 100% pass)
- [x] Composes with a dedicated cron — shipped as `.github/workflows/manifesto-citation-snapshot-cadence.yml` (daily 06:37 UTC; pushes a snapshot branch and writes a run-summary handoff because this repository does not permit `GITHUB_TOKEN` to create pull requests)

## Repair note

2026-05-30 audit found the first six scheduled runs pushed
`ops/manifesto-citation-snapshot-*` branches and then failed at
`gh pr create` with `GraphQL: GitHub Actions is not permitted to
create or approve pull requests (createPullRequest)`. The workflow now
stops after the branch push and records branch/compare URLs in the run
summary. The branch remains the durable handoff surface for the next
maintainer/agent pass to open or land.

## Out of scope

- The `--report` markdown rendering already exists (shipped in slice 1)
- Cross-AI external citation detection (separate child of 081KRHWGX0008QG0R0016T9408; needs external substrate ingestion)
- Constitutional-promotion gate decision logic (per 081KRHWGX0008QG0R0016T9408: that's the human maintainer's call)

## Composes with

- 081KRHWGX0008QG0R0016T9408 (parent — constitutional-promotion readiness tracking)
- `tools/hygiene/audit-manifesto-citations.ts` (the script this extends)
- `.claude/rules/encoding-rules-without-mechanizing.md` (cron-driven cadence pattern)
- `tools/hygiene/audit-rule-cross-refs.ts` (sibling count-then-classify pattern)

## Substrate-honest framing

P2 because: the slice-1 baseline (count snapshot) is the immediately-useful work; time-series adds future signal but isn't blocking any current decision. Naturally picked up when the constitutional-promotion conversation surfaces again.

## Origin tick

Filed as part of 081KRHWGX0008QG0R0016T9408 slice 1 shipping (audit-manifesto-citations.ts; 2026-05-23). Child slice candidate identified in the same PR.
