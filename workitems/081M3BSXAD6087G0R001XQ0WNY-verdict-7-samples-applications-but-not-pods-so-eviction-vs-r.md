---
id: 081M3BSXAD6087G0R001XQ0WNY
type: task
state: backlog
priority: P2
slug: verdict-7-samples-applications-but-not-pods-so-eviction-vs-r
title: "Verdict 7 samples Applications but not pods, so eviction vs render-failure had to be separated by inference"
created: 2026-09-25T08:11:34.694Z
depends_on: []
composes_with: []
---

# Verdict 7 samples Applications but not pods, so eviction vs render-failure had to be separated by inference

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BSXAD6087G0R001XQ0WNY-*.md` glob. -->

## What the gap cost

WP11 verdict 7's first live run (36097310492, 081M3BEGSQR087G0R003610CGB)
measured Applications regressing: **25/35 Synced+Healthy at t=1214s down to
13/35 at t=3007s**, then flat for 723s. Two mechanisms predict that fall, and
they call for different repairs:

| mechanism | prediction |
|---|---|
| **eviction** — node under memory pressure, kubelet evicts BestEffort pods | the **pod** count falls with the Application count |
| **render failure** — repo-server cannot re-render inside its timeout | Applications flip to `sync=Unknown` while their pods **keep running** |

**They were separated, but only by INFERENCE.** ArgoCD's health field said 47 of
102 unconverged rows read `health=Healthy`, the eviction signature
`sync=Synced health=Missing` occurred **zero** times, and a grep for
`evicted|OOMKilled|MemoryPressure|oom-kill` across the whole 2857-line serial
found **nothing** (the one apparent hit was `PREEMPT_DYNAMIC` in the kernel
banner). That is good evidence. **It is not a measurement**, and it should not
have had to be one: verdict 6 counted pods exactly **once**, at t=152s, and
nothing looked again for the next hour.

A pod-count series would have answered it outright, and it is one line of
`kubectl`.

## What landed

Per-sample, beside the Application counts, on the serial and in the verdict
JSON (`podTotalAtLastSample` / `podRunningAtLastSample`):

    pods <running>/<total> Running/total

**Two numbers, because they answer different halves.** Eviction takes pods
*away* (total falls); a pod can also persist in a terminal phase while being
gone as far as a workload is concerned (running falls, total does not).

**A failed probe reports `-`, never `0`** — same discipline as
081M3BP768B087G0R0010C6GPR, which was this verdict being bitten at exactly this
layer: a probe that did not answer must never read as a cluster with no pods.
Both are carried as STRINGS in the JSON for that reason.

## The general lesson, which is the reason this is filed rather than just fixed

The verdict sampled the thing it was *named* for (Applications) and not the
thing that would **discriminate between causes** when it went red. A check that
can say *what* failed but not *why* forces the next reader into inference — and
inference is what this repo's whole falsifier discipline exists to replace.
When a verdict is designed, ask what the two competing explanations of a red
would be, and sample enough to tell them apart.

## Origin

081M3BEGSQR087G0R003610CGB (WP31). The competing explanation came from WP32's
independent measurement that ArgoCD's entire control plane renders **BestEffort**
— nine containers with no `resources.requests` at either pin site — which makes
the eviction pathway a live hypothesis rather than a theoretical one.
