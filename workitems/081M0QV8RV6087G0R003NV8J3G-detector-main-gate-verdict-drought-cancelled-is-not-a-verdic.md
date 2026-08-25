---
id: 081M0QV8RV6087G0R003NV8J3G
type: task
state: backlog
priority: P2
slug: detector-main-gate-verdict-drought-cancelled-is-not-a-verdic
title: "Detector: main gate-verdict drought (cancelled is not a verdict)"
created: 2026-08-23T17:39:06.214Z
depends_on: []
composes_with: []
---

# Detector: main gate-verdict drought (cancelled is not a verdict)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QV8RV6087G0R003NV8J3G-*.md` glob. -->

## The condition, and why it was invisible

`gate.yml` cancels its in-flight run on every merge to `main` (per-ref concurrency,
`cancel-in-progress`). That setting is correct. What it produces, when merges arrive
faster than the gate finishes, is a `main` whose recent commits carry **no verdict at
all** — not a pass, not a fail, just `cancelled`.

Measured on `Lucent-Financial-Group/Zeta`, 2026-08-23T17:35Z:

```
last SUCCESS on main:  10fbd9a4   16:29:06Z → 16:43:22Z
now:                   17:33:54Z          (≈50 min later, ~20 commits)
last 8 runs:           6 cancelled, 2 running, 0 success
gate duration:         ~14 min when allowed to finish
merge interval:        17:30:13, 17:30:29, 17:30:37   ← three merges in 24 seconds
```

Merges outran the gate by roughly an order of magnitude. **`cancelled` reads as neither
pass nor fail**, so every surface that folds gate outcomes — `platform-drift-report.ts`,
`gate-scope-summary.ts`, `drift-loud.ts` — finds nothing, and nothing renders as green.
`drift-loud.ts` has the hole today: hand it 60 cancelled runs and it prints
`EXIT 0 — no sustained drift`. It is not wrong about drift; it is silent about the fact
that nothing was measured.

**Owned error (2026-08-23).** Earlier the same day I looked at this exact cancellation
pattern, reasoned that a later successful run covers the earlier commits, and called it
benign. That reasoning has a premise — that there eventually *is* a later success — and
the premise is what the condition removes. At 50 minutes and ~20 commits with no success,
the conclusion had already failed. I found it by counting conclusions by hand, and a
detector that has to be asked is not a detector.

## What shipped

One reporter, `src/Core.TypeScript/ci/verdict-drought.ts`, running in **two existing
surfaces** — not a fourth parallel mechanism:

| host | why | loudness |
|---|---|---|
| `drift (loud)` job in `gate.yml` (#14283) | already built to go red beside a green required check | `::error::` + summary + **non-zero exit** (red X, blocks nothing) |
| `drift-sweep.yml` | own concurrency group, `cancel-in-progress: false` — **survives** the storm that cancels every gate run | `::error::` + summary, `--report-only` so it never goes red |

The second host is load-bearing, not redundancy: a drought detector living only inside
`gate` is cancelled by exactly the condition it exists to report.

## Register discipline

Three registers, and `unknown` never aggregates into green:

- `ok` — a completed verdict (`success` **or** `failure`) within threshold, few enough
  commits on top;
- `drought` — a verdict exists but is too old, or too many commits landed since;
- `unknown` — **no** completed verdict anywhere in the window, or the window could not be
  observed. Deliberately the loudest register: an unmeasurable drought is strictly worse
  than a long one.

`isVerdict` is a strict allow-list of exactly two conclusions, not a deny-list — the
failure that matters is a non-verdict counted as one, and that direction turns a drought
green every time GitHub invents a new conclusion string.

## Falsifiers

`src/Core.TypeScript/ci/verdict-drought.test.ts`, 32 tests, hermetic (observations built
in-process, `now` injected as a literal — no network, no clock, DST-replayable).
Discrimination proved by inversion, both restored:

- widening `isVerdict` to accept `cancelled` → FALSIFIER 1 goes red
  (`Expected: "unknown", Received: "drought"`; the bounded-window case reads
  `Received: "ok"` — the literal defect);
- narrowing it to `success` alone → FALSIFIER 2 goes red
  (`Expected: "ok", Received: "drought"`), which is the "a red `main` looks like an
  unchecked one" inversion.

## Scope — deliberately not answered here

The concurrency group, a merge queue, and the flush cadences are the three policy options
on the table; choosing between them is a human call. This detector presumes none of them.
It exists so that whichever is chosen can be **verified afterwards** — the same number,
measured the same way, before and after.

## How this detector fails (stated, not papered over)

- Empty window → `unknown` + `assertDroughtDetectorLive` returns not-live → two
  `::error::` lines. Never `ok`.
- Commit-count channel fails → `null`, named out loud, **never** rendered as `0`.
- Commits land with zero runs → `triggerLooksBroken`, named as a broken trigger rather
  than a slow gate.
- **The step never executes because its host job was cancelled.** The one mode it cannot
  self-report, and the reason it runs in two hosts with different concurrency groups. If
  both go quiet the condition is invisible again.

It publishes nothing — no commit, no push, no artifact. `drift-sweep.yml`'s push to
`main` has been rejected by the "CI Gate" ruleset since 2026-08-13 while reporting green,
and `drift-dashboard-cadence.yml:98` has the same `git push … || echo "::warning::"`
shape. Loud lives in the run. If persistence is ever wanted, the route is park on
`heartbeat/*` and flush via PR, never a direct push.

