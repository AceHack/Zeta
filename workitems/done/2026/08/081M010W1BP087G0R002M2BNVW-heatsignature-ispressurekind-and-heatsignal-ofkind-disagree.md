---
id: 081M010W1BP087G0R002M2BNVW
type: bug
state: done
priority: P2
slug: heatsignature-ispressurekind-and-heatsignal-ofkind-disagree
title: "HeatSignature.isPressureKind and HeatSignal.ofKind disagree on kinds carrying both a forgetting and a pressure token"
created: 2026-08-14T20:54:28.470Z
completed: 2026-08-15T15:05:22.306Z
depends_on: []
composes_with: []
---

# HeatSignature.isPressureKind and HeatSignal.ofKind disagree on kinds carrying both a forgetting and a pressure token

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M010W1BP087G0R002M2BNVW-*.md` glob. -->

**Filed, not fixed** — found while fixing the non-injective heat encoders
(081M00TYT8N087G0R003MPMRX9); out of that PR's path, so it is recorded rather than repaired.

## Two live classifiers of the same bit

`src/Core/Heat.fs` decides "is this kind pressure?" twice, by two different routes:

- `HeatSignature.isPressureKind` (`:32`) — `isBackpressureKind || isDeniedKind`, a direct
  substring test.
- `HeatSignal.ofKind` (`:81`) — an ordered `if/elif` chain that tests `isForgettingKind`
  **first**, then `HeatSignal.isPressure` (`:110`) reads pressure off the resulting signal.

A kind string carrying **both** a forgetting token and a pressure token takes the forgetting
branch, so the second route says "not pressure" while the first says "pressure".

## Measured, against the built `Zeta.Core.dll` (this branch)

```
kind                     | isPressureKind | ofKind          | isPressure(ofKind) | DISAGREE
backpressure             | true           | backpressure    | true               | false
forget-backpressure      | true           | forgotten       | false              | true
prune-rejected           | true           | forgotten       | false              | true
forgotten                | false          | forgotten       | false              | false
bounded-forget-denied    | true           | forgotten       | false              | true
rejected                 | true           | denied          | true               | false
```

3 of 6 probed kinds disagree.

## Why it matters

`TemperatureReadout.ofHeatSignature` (`src/Core/Heat.fs:274`) sets
`pressure = MaxPpm` iff `HeatSignal.ofSignature signature |> HeatSignal.isPressure`. It
therefore takes the route that answers **false** for a dual-token kind, so such a signature
reports **zero pressure** — and since `thermalPpm` is a `max`, the temperature can read
cold for a room that is under genuine backpressure. Same fail-dangerous direction as the
`temperatureBand(NaN) -> "cold"` defect fixed in 081M00TYT8N087G0R003MPMRX9.

## Liveness — NOT established

The **mechanism** is confirmed by measurement above. Whether any kind string actually emitted
in the running system carries both tokens was **not surveyed** (out of path). Previously
reported as latent. Do not promote this to "live" without enumerating the emitted kind strings
— that enumeration is the first task here.

## Shape of the fix (not prescribed)

The defect is *two* classifiers, not the ordering of either. Deriving one from the other —
`isPressureKind kind = ofKind kind |> isPressure`, or the reverse — makes disagreement
unrepresentable. A test that asserts the two routes agree on a generated kind corpus is the
falsifier; note that an ordered chain must then decide dual-token kinds explicitly rather
than by accident of branch order.

## Resolution (2026-08-15)

Both routes now read `HeatSignature.classifyKind`. Dual-token kinds are
**pressure** — missing a pressure signal is fail-dangerous
(`TemperatureReadout` would otherwise read cold). The order is the
decision, not an accident of `if/elif` listing.

Live kinds (L7 corpus in `ShedDisposition.Property.Tests`) all carry one
token class; none change. The falsifier constructs dual-token kinds by
concatenation (so a kind-literal lint does not fire) and asserts the two
routes agree on the live corpus and the product of forget × pressure
tokens. `forget-backpressure` now reports `PressurePpm = MaxPpm`.

## Standing guard (2026-08-17)

The resolution above is now enforced, not just recorded:
`src/Core.TypeScript/hygiene/lint-heat-kind-classifier-agreement.ts`, wired into the
`lint (no empty dirs)` gate job.

- **PART A** — no emitted heat-kind literal may carry both a forgetting and a pressure token.
  The ordered chain resolves those by branch *position*, not meaning, so the honest guard keeps
  the ambiguous input class **empty** rather than pretending the ordering is a decision. Under
  this work-item's chosen order a dual-token kind reads `Backpressure => Deferred`, so a kind
  literally named `*.prune-backpressure` would claim a composition law it does not satisfy.
- **PART B** — the classifier is **discovered, never named**: exactly one binding in `Heat.fs`
  may consume the raw substring probes. It also refuses an inline `kindContains` probe, an
  orphan token predicate nothing reads, and a membership split between the two remaining
  pressure tables (`isPressureKind` over `KindClass`, `isPressure` over `HeatSignal`), including
  a miswired `ofKind` arm.

All of it demonstrated failing against the real `src/Core/Heat.fs` — eight mutants including
this work-item's original defect restored verbatim (`isPressureKind = isBackpressureKind ||
isDeniedKind`), all eight caught.

**Not closed by that lint:** the pressure bit is still enumerated in two agreeing tables rather
than one. Filed as `081M07Z23EX087G0R003N676FT`.
