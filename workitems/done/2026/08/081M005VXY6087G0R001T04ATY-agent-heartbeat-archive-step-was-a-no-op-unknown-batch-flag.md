---
id: 081M005VXY6087G0R001T04ATY
type: bug
state: done
priority: P2
slug: agent-heartbeat-archive-step-was-a-no-op-unknown-batch-flag
title: "agent-heartbeat archive step was a no-op: unknown --batch flag, pipe-masked exit code, and a --since that matched nothing"
created: 2026-08-14T13:02:33.414Z
completed: 2026-08-15T13:38:33.566Z
depends_on: []
composes_with: []
---

# agent-heartbeat archive step was a no-op: unknown --batch flag, pipe-masked exit code, and a --since that matched nothing

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M005VXY6087G0R001T04ATY-*.md` glob. -->

## The defect

`.github/workflows/agent-heartbeat.yml`, soraya's "Archive PR review history" step, ran:

```
bun src/Core.TypeScript/forge-host/github/archive-pr-reviews.ts \
  --owner Lucent-Financial-Group --repo Zeta --batch 3 --since 7d \
  2>&1 | tail -10 || echo "::warning::[archive] archive step failed (non-fatal)"
```

Three independent defects, each sufficient on its own to make the step do nothing:

1. **`--batch` is not a flag the tool accepts.** `parseArgs` falls through to
   `process.stderr.write("unknown arg: ...")` + `process.exit(1)`. Live proof: run
   31800609010, soraya tick — total step output was the single line `unknown arg: --batch`.
2. **The exit code was masked twice.** A pipeline's status is the last command's, so
   `... | tail -10` turned the archiver's `1` into `0`, and that in turn made the
   trailing `|| echo "::warning::"` **unreachable**. Verified:
   `bash -c 'false 2>&1 | tail -10 || echo FALLBACK; echo $?'` prints no FALLBACK and `0`.
   The step reported success on every tick.
3. **`--since 7d` matched zero PRs anyway.** The filter is `p.mergedAt >= since`, a
   *lexicographic string compare* against ISO timestamps, and `"2026-08-14T..." >= "7d"`
   is `false`. Fixing only (1) and (2) would have produced a step that exits 0, looks
   healthy, and still archives nothing. Additionally, the invocation passed neither a PR
   number nor `--all-merged`, which is itself a `return 1`.

A comment in `agent-heartbeat.yml` (added 2026-08-11) asserted `--since 7d` on this step was
"working" and warned future readers off "fixing" it. That claim was wrong — it conflated this
tool's `--since` with the mutation-runner's git-approxidate `--since` — and is retracted in place.

## Measured cost (derived 2026-08-14, not estimated)

Archiving has a **1282-PR-number hole between PR 9058 (2026-07-01) and PR 10341 (2026-08-13)**.
Across the newest 3000 merged PRs, **1273 have no shard**, 1252 of them inside that window.
Coverage by day is 0% for 2026-07-04..2026-08-12 and returns to 100% on 2026-08-13, when the
primary path (`pr-archive-on-merge.yml`) resumed.

Calibration, honestly: this is **not data loss**. GitHub still holds those review threads, and
the per-merge path — not this step — is the primary archiver. What was lost is the *git-canonical
mirror* the repo maintains precisely because the host copy is not durable, plus ~6 weeks of a
safety net reporting green while dead. The backfill would have drained the hole; it never ran once.

## The fix

- `archive-pr-reviews.ts`: new `--limit N` bounded sweep; `--all-merged` now **skips PRs that
  already have a shard** and takes the **oldest** N of what remains, so repeated bounded ticks
  *drain* the backlog instead of re-picking the same head (the newest-first + small-cap
  starvation shape is deliberately avoided). `normalizeSince()` turns `Nd`/`Nh` into a real
  cutoff and rejects anything else loudly instead of silently matching nothing.
- The workflow captures the exit code explicitly with no pipe on the command, and emits a real
  `::warning::` when the tool fails.

## Non-vacuity probes

- `src/Core.TypeScript/hygiene/audit-workflow-cli-flags.ts` (+ test) — **closes the class**:
  parses each tool's accepted-flag set out of its source and checks every workflow invocation
  against it, but only for tools whose parser rejects unknown flags (where an unaccepted flag
  is provably fatal). Runs in `gate.yml` via `bun test src/Core.TypeScript/hygiene/`.
- `src/Core.TypeScript/forge-host/github/archive-pr-reviews.test.ts` — runs the **real parser**
  on the **real argv** extracted from the workflow YAML, plus a pinned negative that the historical
  `--batch` argv still exits 1 (so the probe cannot silently stop discriminating), plus a guard
  that the step does not pipe away the tool's exit status.

## Follow-up (not done here)

The 1273-PR backlog is not backfilled by this PR. The fixed step drains it at 3 PRs/tick;
at 48 ticks/day that is roughly 9 days, or an operator can run
`--all-merged` with a larger `--limit` once to drain it in a single pass.

## Resolution (2026-08-15)

**Drift close.** Acceptance shipped on `main` in #10577. The workflow
no longer passes `--batch`; `normalizeSince` and `--limit` exist;
`audit-workflow-cli-flags.ts` is the class-level probe. The 1273-PR
backfill follow-up is still a follow-up, not this row. No code change
in this close.
