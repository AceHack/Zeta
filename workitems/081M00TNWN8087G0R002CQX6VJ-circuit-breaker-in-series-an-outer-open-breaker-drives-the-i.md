---
id: 081M00TNWN8087G0R002CQX6VJ
type: task
state: backlog
priority: P2
slug: circuit-breaker-in-series-an-outer-open-breaker-drives-the-i
title: "Circuit breaker in series: an outer open breaker drives the inner error rate to zero"
created: 2026-08-14T19:06:15.592Z
depends_on: []
composes_with: []
---

# Circuit breaker in series: an outer open breaker drives the inner error rate to zero

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00TNWN8087G0R002CQX6VJ-*.md` glob. -->

## The instrument failure

Circuit breakers do not compose, and the reason is a blind instrument rather than a missing
theorem: **when an outer breaker opens, the inner breaker stops seeing traffic, so its error rate
falls to zero and it reads healthy.** The outer breaker's protective action blinds the inner
breaker's only sensor.

Two breakers in series have a 9-state joint space with no stated dynamics. The failure is
one-directional and quiet: the composite looks healthier the more of it is broken.

This is the same class as the eleven instruments found this month, most recently the service-status
adapter where a job with 1,508 successful runs reads `installed-stopped` while a job crashing every
invocation reads `not-installed`.

## Why this is filed rather than fixed

The repo does not currently ship a circuit breaker, and this work-item exists so that one is not
added without an answer. Any breaker landed here must state how it reads when an upstream breaker
is open. Candidate answers:

- report `no-traffic` as a distinct state from `healthy` — the honest minimum;
- feed the breaker a **derived** input (`081M00TNR8S087G0R00245QH02`), since an error RATE with a
  zero denominator is exactly the correlated-input failure;
- prefer a conservative deferral operator, which composes (Kahn 1974), over a breaker, which does
  not.

Study: `docs/research/2026-08-14-backpressure-has-no-single-algebra-deferral-composes-destruction-does-not-and-bandwidth-isolation-decorrelates-the-channel-not-the-common-cause.md`
