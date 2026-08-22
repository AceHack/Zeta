---
id: 081M00TNWM8087G0R0027ACGKY
type: task
state: backlog
priority: P2
slug: make-deferral-vs-destruction-a-typed-field-not-a-substring-m
title: "Make deferral-vs-destruction a typed field, not a substring match on a free-form kind"
created: 2026-08-14T19:06:15.560Z
depends_on: []
composes_with: []
---

# Make deferral-vs-destruction a typed field, not a substring match on a free-form kind

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00TNWM8087G0R0027ACGKY-*.md` glob. -->

## The problem

Whether a backpressure operator **defers** (hands the tail back) or **destroys** (annihilates it)
is the single fact that decides whether it composes:

- conservative operators form a monoid; their deferred sets join as a semilattice (idempotent,
  order-independent, replay-safe). This is a Kahn process network (Kahn 1974) and is why DST
  replays the throttle path at all.
- lossy operators compose into nothing — the composite depends on application order, and the
  input-output relation is not a compositional semantics (Brock-Ackerman 1981).

Today that bit is recovered at runtime by `kind.Contains("backpressure")` on a free-form string.
The most structurally important bit in the shed path is **inferred from a name**, and
081M00TNWK7087G0R000WX9XZE is what that costs.

## Fix shape

Carry it as a field the emitter sets, because the emitter is the only party that knows whether it
handed the tail back:

```fsharp
type ShedDisposition =
    | Deferred      // the tail is with the caller; a retry reconstructs it. Free.
    | Annihilated   // nothing retains a seed. It pays.
```

on `HeatSignature`, with `isPressure` reading the field. Keep the string classifiers as a
**fallback for legacy emitters only**, and make them delegate rather than reimplement.

Additive, not a rewrite. `SchedulerShedHeat.fs` (#10640) already carries the vocabulary; this
moves it from inference to declaration.

Study: `docs/research/2026-08-14-backpressure-has-no-single-algebra-deferral-composes-destruction-does-not-and-bandwidth-isolation-decorrelates-the-channel-not-the-common-cause.md`
