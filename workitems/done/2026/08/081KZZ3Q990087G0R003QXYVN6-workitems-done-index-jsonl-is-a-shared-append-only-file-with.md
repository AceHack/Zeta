---
id: 081KZZ3Q990087G0R003QXYVN6
type: bug
state: done
priority: P2
slug: workitems-done-index-jsonl-is-a-shared-append-only-file-with
title: "workitems done index.jsonl is a shared append-only file with the conflict class the PR manifest already retired"
created: 2026-08-14T03:05:49.600Z
completed: 2026-08-14T11:05:50.699Z
depends_on: []
composes_with: []
---

# workitems done index.jsonl is a shared append-only file with the conflict class the PR manifest already retired

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZZ3Q990087G0R003QXYVN6-*.md` glob. -->

## The defect

`workitems/done/index.jsonl` is a **single shared append-only file** that every work-item completion
writes to. Two agents completing work-items concurrently therefore conflict on it, pairwise — the
identical defect that `docs/github/prs/manifest.jsonl` had.

**CHECKED, observed live 2026-08-13:** rebasing PR #10516 onto `main` produced exactly one conflict, in
this file, because another agent had completed a work-item in the meantime. Union-resolved to 35
records. That is one instance in one rebase, on a day when several agents were closing items.

## Why this is worth filing rather than absorbing

**The fix is already proven, one directory over.** `manifest.jsonl` had this exact shape and was retired
today (#10427, #10468):

- one file per record, keyed by a **ZetaId that is an invertible function of the natural key** — so a
  duplicate is *unrepresentable* and two writers cannot select the same path;
- the aggregate index **derived** rather than stored, with a drift gate;
- ordering by the natural key, **integer/ordinal compare**, no collation.

The concurrency proof there was done **with a control**: the old shape reproduces `CONFLICT`, the new
one merges clean. That method transfers directly.

`workitems/events/YYYY/MM/DD/<zetaid>.json` **already exists in this repo** and is the sharded shape for
work-item *events*. So the pattern is not merely proven in a neighbouring subsystem — it is proven in
*this* subsystem, for a sibling record type. The `done` index is the one that did not get it.

## Scale, honestly

This is **lower severity than the manifest was**. Work-item completions are far rarer than PR archives —
the manifest case produced 8–36 simultaneously-conflicting PRs and consumed three autonomous ticks of
hand-rebasing; this produced one conflict in one rebase. It is filed because the cost of fixing it is
now *very* low (the pattern, the helper, and the control-based proof method all exist) and because the
conflict rate scales with agent count, which is the direction this project is going.

**Do not gold-plate it.** If the derived-index machinery in `derive-pr-manifest.ts` generalises with a
small parameterisation, reuse it; if it does not, a hand-rolled second copy is the wrong trade for a
low-frequency file, and saying so is a fine outcome.

## Acceptance

- Two work-item completions generated concurrently both land with **no conflict** — demonstrated with a
  control that reproduces `CONFLICT` under the current shape.
- Re-running a completion for an already-done item is an **upsert**, not a duplicate line (§12).
- The index is derived and drift-gated, or explicitly justified as hand-maintained.

## Pointers

- `081KZYMY46P087G0R003S64V2B` — the manifest work-item, including the false-premise correction
- `src/Core.TypeScript/forge-host/github/pr-manifest-shards.ts` / `derive-pr-manifest.ts` — the shape
- `workitems/events/YYYY/MM/DD/<zetaid>.json` — the same shape already used for work-item events

