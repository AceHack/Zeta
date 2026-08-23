---
id: 081M0QPZD9C087G0R002W8QC2A
type: bug
state: backlog
priority: P1
slug: drift-sweep-s-ledger-push-to-main-has-been-rejected-by-the-c
title: "drift-sweep's ledger push to main has been rejected by the CI Gate ruleset since 2026-08-13 — 1,597 green runs, zero ticks recorded"
created: 2026-08-23T16:24:05.164Z
depends_on: []
composes_with: []
---

# drift-sweep's ledger push to main has been rejected by the CI Gate ruleset since 2026-08-13 — 1,597 green runs, zero ticks recorded

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QPZD9C087G0R002W8QC2A-*.md` glob. -->

## What is broken

`drift-sweep.yml` runs every few minutes, computes the drift ledger correctly, commits
it, and then pushes to `main`. Since **2026-08-13** every one of those pushes has been
rejected:

```text
remote: error: GH013: Repository rule violations found for refs/heads/main.
remote: - Required status check "gate (required)" is expected.
 ! [remote rejected]     main -> main (push declined due to repository rule violations)
```

The workflow swallowed it with `git push || echo "push race — next tick re-records
(idempotent)"`, which misfiles a **permanent** rule rejection as a **transient** race.
Nothing re-records, because the next tick fails identically.

## Measured

| | |
|---|---|
| `drift-sweep` runs since 2026-08-13 | 1,866 completed, **1,597 concluded `success`** |
| Latest tick in `docs/drift-events/` | `000247`, dated **2026-08-13T15:56Z** |
| `data/platform-drift.json` watermark | run `32232815018`, dated **2026-08-19T08:28Z** |

So the drift dashboard everyone is pointed at has been serving numbers up to ten days
stale, from behind a green check, while the fold that would have refreshed them ran
~1,600 times and was discarded each time.

## What this item does NOT cover

The **loudness** half already landed (`feat/drift-is-loud-not-blocking`): the swallow now
classifies a rule rejection separately and emits an `::error::` naming the cause, and
`drift (loud)` in `gate.yml` goes red while any published drift artifact is stuck behind
the window. Both are still non-fatal — a red `drift-sweep` run would be noise, and the
gate floor is untouched.

What remains is the **route**: the ledger has to land somewhere. The other telemetry
lanes already solved exactly this — per `CLAUDE.md` "Heartbeat-via-commit", they park on
`heartbeat/*` refs and flush to `main` via PR, because the "CI Gate" ruleset requires
`gate (required)` at push time with no bypass actors. `drift-sweep` is the lane that was
never migrated.

## Acceptance

1. A tick's bookkeeping reaches `main` again — `docs/drift-events/` advances past `000247`
   and `data/platform-drift.json`'s watermark tracks recent runs.
2. `drift (loud)` stops reporting `PUBLICATION NOT LANDING` **without that check being
   weakened** — the check going quiet for any other reason is the failure, not the fix.
3. The route is the heartbeat-flush shape, not a bypass actor and not `--admin`.

## Pointers

- `.github/workflows/drift-sweep.yml` — the `Commit and push the tick event` step.
- `src/Core.TypeScript/ci/drift-loud.ts` — `publicationIsStale`, the detector that now
  says this out loud on every gate run.
- `src/Core.TypeScript/agent-heartbeats/merge-heartbeats-to-main.ts` — the working
  precedent for the flush lane.
- `CLAUDE.md` "Heartbeat-via-commit" — why pushes to `main` from a telemetry lane stopped
  working, and where the lanes went instead.
