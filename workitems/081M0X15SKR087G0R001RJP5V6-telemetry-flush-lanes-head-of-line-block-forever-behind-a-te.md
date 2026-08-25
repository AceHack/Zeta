---
id: 081M0X15SKR087G0R001RJP5V6
type: bug
state: backlog
priority: P1
slug: telemetry-flush-lanes-head-of-line-block-forever-behind-a-te
title: "telemetry-flush lanes head-of-line block forever behind a terminally-red immutable PR head"
created: 2026-08-25T17:58:32.312Z
depends_on: []
composes_with: []
---

# telemetry-flush lanes head-of-line block forever behind a terminally-red immutable PR head

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0X15SKR087G0R001RJP5V6-*.md` glob. -->

## Measured (2026-08-25T17:52Z-18:10Z)

`drift (loud)` on `main` self-reported that `data/platform-drift.json` was pinned at run
`32816944713`, older than all 60 runs in the window. The dashboard was serving numbers
from 11 hours earlier from behind a green cadence.

Cause: PR #15276 (`heartbeat/drift-sweep`) open since 06:37Z, head `1972556b7d`, never
updated. Every subsequent tick parked in `heartbeat/drift-sweep-buffer` and published
nothing. Last landing of `data/platform-drift.json` before the fix: `b1ee54f064`, 06:35:50Z.

**ALL FOUR telemetry-flush lanes were wedged at once, from three unrelated causes:**

| PR | lane | open since | why the head died |
|---|---|---|---|
| 15276 | `drift-sweep` | 06:37Z | 3 lint shards exited **124** in `tools/setup/linux.sh` -- the apt budget ran out on a stalled Azure mirror. The lints **never executed**. `gate (required)` is the rollup of those. |
| 15325 | `society` | 08:21Z | `audit-orphaned-archive-refs`: 5 stranded archive records vs baseline 3 -- stranded *because the `pr-archive` lane was itself wedged*. A cascade. |
| 15327 | `pr-archive` | 08:26Z | same audit |
| 15385 | `tick-metrics` | 16:31Z | head cut inside the 10-minute window when `main` carried a TypeScript syntax error in `src/Core.TypeScript/observe/model-benchmark.ts` (broken by #15384 16:28Z, fixed by #15388 16:38Z). The head is pinned to a `main` that no longer exists. |

## The shared defect

`chooseFlushRoute` asked exactly one question -- *is a PR open on this ref* -- and if so
buffered, unconditionally and forever. The immutable-head design is correct **while the head
is under test**: replacing it restarts every required check and would starve a cadence lane
whose period is shorter than the gate. That premise expires the moment a check reaches a
terminal non-success conclusion. Nothing re-runs it, auto-merge never fires, and waiting is
no longer backpressure -- it is deadlock.

`rerun-cancelled-gate.yml` does not cover this and **must not be widened to**: it rescues
`cancelled` only, and its header states the reason correctly -- re-running a genuine
`failure` converts a real red into a flaky green. The three apt-stalled shards concluded
`failure` (step exit 124), not `cancelled`, so they were out of its scope by design.

## Fix

`chooseFlushRoute` takes a third input, a `HeadVerdict` from `classifyHeadVerdict` over the
head's check-runs (the check-runs API, never `statusCheckRollup`, which under-reports):

- **under-test** -- any check queued/running, all completed checks green, or no checks yet.
  Route stays `buffer`. Unchanged behaviour.
- **dead** -- a latest-per-name check concluded `failure`/`timed_out`/`cancelled`/
  `action_required`/`stale`. New route `supersede`: force-push the fresh aggregate onto the
  active ref, which moves the open PR's head and starts the full gate from scratch on it.

**No check is widened, relaxed, or waived.** The superseding head runs the same required
checks as any other commit. A lane whose *content* genuinely fails now stays visibly red on
a fresh head every tick instead of hiding behind one stale red from hours ago, and the
`::warning` emitted on supersede says exactly that.

Probe **fails closed**: an unreadable answer routes to `under-test` (keep buffering), and
the default argument is the safe one, so a caller that cannot answer never acquires
force-push behaviour.

## Immediate action taken

`gh run rerun 32817753345 --failed` on #15276. The three lint shards passed on attempt 2 --
confirming the content was never at fault -- and the PR merged. **`c7b1b3398c` landed
`data/platform-drift.json` on `main` at 18:02Z**, 11h27m after the previous landing.

## Not fixed here, and deliberately named

The apt budget itself. On job 97709375940 the third attempt was *actively unpacking
packages* when the shared 420s budget killed it: earlier attempts had consumed all but 46s.
That is a real question -- whether a retry ladder should starve the attempt most likely to
succeed -- but raising `ZETA_APT_BUDGET_SECONDS` or `timeout-minutes` is a cost decision
that needs a sign-off and a measurement, not a reflex. Sibling item; do not fold it in.
