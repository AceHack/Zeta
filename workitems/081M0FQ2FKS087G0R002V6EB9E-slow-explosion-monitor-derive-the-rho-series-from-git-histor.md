---
id: 081M0FQ2FKS087G0R002V6EB9E
type: task
state: backlog
priority: P2
slug: slow-explosion-monitor-derive-the-rho-series-from-git-histor
title: "slow-explosion monitor — derive the rho series from git history and watch the derivative, not the level"
created: 2026-08-20T13:51:50.393Z
depends_on: []
composes_with: []
---

# slow-explosion monitor — derive the rho series from git history and watch the derivative, not the level

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0FQ2FKS087G0R002V6EB9E-*.md` glob. -->

## The gap

`src/Core.TypeScript/society/effective-agent-count.ts` computes rho on **every CI run** and the
number is **thrown away**. The three-point series (0.400 -> 0.439 -> 0.4647) exists only in a
code comment and three PR descriptions. **Nothing computes `drho/dt`.**

We have the sensor and no monitor. Aaron 2026-08-20: *"this is our slow explosion warning system
for explosions that are too hard to see in real time."* It is not one yet.

## Why a threshold cannot do this job

A slow explosion is one whose timescale exceeds any single observation window: every individual
sample looks fine, and the information lives in the *sequence*. Each of the three rho values
passed the old `(0.35, 0.45)` band at the time it was taken, until one did not.

So a threshold on the level **fires at detonation, not during it** — a post-mortem with an alarm
bell attached. And the tempting repair (re-centre the band when it fires) is *normalization of
deviance*: Vaughan, `The Challenger Launch Decision` (1996), where every individual O-ring
erosion fell inside accumulated experience and the pattern that was the disaster was never
represented anywhere. #12733 refused to re-centre; this item is the other half of that refusal.

## Design — and the load-bearing constraint

1. **Watch the derivative, not the level.**
2. **The series must exist** — you cannot fit a trend to one sample.
3. **DO NOT STORE THE SERIES. RECOMPUTE IT FROM GIT HISTORY.**

Point 3 is the design. `rho` is a pure function of `db/mutation-findings/`, and that corpus is in
git — so the series is *derivable* by walking commits that touched it and recomputing rho at
each. That makes the monitor idempotent, replayable under DST, and structurally incapable of
disagreeing with the thing it describes.

Appending rho to a running file each CI run would recreate **exactly** the bug fixed this
morning in `081M0DY68KN087G0R002MQ1BDR`: a stored artifact that drifts from its source, where
the check reports on the artifact rather than the property. A stored series is a second surface.

## Statistical honesty required of the alarm

Monotonicity alone is weak evidence and the item must not overstate it:

| samples | P(strictly increasing) under exchangeable ordering |
|---|---|
| 3 | 1/6 ~ 0.17 |
| 4 | 1/24 ~ 0.042 |
| 5 | 1/120 ~ 0.008 |

The current three-point rise is **suggestive, not significant**. Worse, the samples are strongly
autocorrelated — each rho is computed over a corpus that *contains* the previous one — so the
naive p-value is optimistic rather than conservative. The alarm should use a differenced series
or a trend test that models the dependence, and should report its own confidence rather than
emitting a bare red.

## Scope beyond rho

The generalisation is the real value: **any quantity sampled per-run and discarded is a slow
explosion we have chosen not to see.** Already observed and thrown away:

- Actions cache size — 11.58 -> 8.73 -> 10.18 GB inside one hour, never trended
- heartbeat cron delay — 18, 22, 26, 28, 31 minutes across one night. That IS a rising series and
  nobody plotted it
- count of `stale` skill path refs (218 -> 81 after #12723)
- `blocking + derived` in the cluster-tree roster (the deletion-safety counter, currently 9)
- CI wall-clock per job

The monitor should be **general over a declared list of series-producing measurements**, not
special-cased to rho.

## Done when

A monitor that (a) derives at least one series from git history rather than storage, (b) reports
a trend with a stated confidence rather than a threshold verdict, and (c) has a falsifier: a
synthetic flat series must not alarm, and a synthetic rising one must.
