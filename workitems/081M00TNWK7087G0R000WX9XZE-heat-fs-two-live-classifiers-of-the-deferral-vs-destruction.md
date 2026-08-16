---
id: 081M00TNWK7087G0R000WX9XZE
type: task
state: backlog
priority: P2
slug: heat-fs-two-live-classifiers-of-the-deferral-vs-destruction
title: "Heat.fs: two live classifiers of the deferral-vs-destruction bit disagree on mixed kind strings"
created: 2026-08-14T19:06:15.527Z
depends_on: []
composes_with: []
---

# Heat.fs: two live classifiers of the deferral-vs-destruction bit disagree on mixed kind strings

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00TNWK7087G0R000WX9XZE-*.md` glob. -->

## The divergence

Two live classifiers of the deferral-vs-destruction bit disagree on kind strings containing BOTH a
forgetting token and a pressure token.

- `HeatSignature.isPressureKind` (`src/Core/Heat.fs:32`) tests only pressure tokens.
  Live at `DarkHallRoomLoop.fs:165`, `DarkHallScheduler.fs:246`, `DarkHallScheduler.fs:291`.
- `HeatSignal.ofKind` (`src/Core/Heat.fs:81`) tests **forgetting first**, so the same string
  classifies as `Forgotten` and `isPressure = false`.
  Live at `SchedulerShedHeat.fs:72`, `SchedulerShedHeat.fs:74`.

Transcribed and executed:

```
soft-emu.prune-backpressure     isPressureKind=true   HeatSignal.isPressure=false   DISAGREE
cache.forget-denied             isPressureKind=true   HeatSignal.isPressure=false   DISAGREE
meta-cart.policy-backpressure   isPressureKind=true   HeatSignal.isPressure=true    agree
soft-emu.prune                  isPressureKind=false  HeatSignal.isPressure=false   agree
```

## Why it matters

That bit is not cosmetic. Deferral composes (Kahn 1974); destruction does not (Brock-Ackerman
1981). It decides whether a shed path is free or pays, and #10640 made it load-bearing.

## Status: LATENT, not live

**CHECKED:** the predicates disagree. **NOT CHECKED:** whether any kind string emitted today
contains both tokens. Do not report this as an outage until an emitted string is shown.

## Fix shape

Make `isPressureKind` delegate to `HeatSignal.ofKind >> isPressure` so there is one classifier,
and add the mixed-token cases to `DarkHallScheduler.Tests.fs` (which already pins
`isPressureKind` on four single-token strings and would not have caught this).

Study: `docs/research/2026-08-14-backpressure-has-no-single-algebra-deferral-composes-destruction-does-not-and-bandwidth-isolation-decorrelates-the-channel-not-the-common-cause.md`
