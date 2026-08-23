---
id: 081M0QMDMC7087G0R000W6QRCV
type: task
state: backlog
priority: P2
slug: round-trip-a-real-minimalbnn-layer-not-synthetic-posteriors
title: "Round-trip a REAL MinimalBnn layer, not synthetic posteriors — widen the range check"
created: 2026-08-23T15:39:25.447Z
depends_on: []
composes_with: []
---

# Round-trip a REAL MinimalBnn layer, not synthetic posteriors — widen the range check

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QMDMC7087G0R000W6QRCV-*.md` glob. -->
**The stated weak point of the round-trip result.** `docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-*.md`
§4 reports max KL **4.0e-8** at `rgba32float` over 4096 **synthetic** Normal-Gamma posteriors whose
parameter ranges were chosen to look like a trained layer (1..400 observations, means ~N(0, 0.5^2)).

That is honest scaffolding, and it is exactly where the result could be wrong: **the whole conclusion
is a function of the parameter ranges.** Two bounds in the doc are range-dependent:

- the `beta` decode cancels catastrophically at `|m| ~ 1e4` (total loss of `beta` at `lambda = 50`);
- `rgba16float` overflows the precision channel above `tau = 65504`, and the measured synthetic range
  already reached `tau = 129836`.

**The work.** Take a real `MinimalBnn.State` / `MultilayerBnn.Network` after actual observations
(`src/Bayesian/MinimalBnn.fs`, `MultilayerBnn.fs` — already `(PrecisionMean, Precision)` natural
parameters), export the posteriors, and re-run sections [1]-[3] of
`src/Core.TypeScript/bayesian/toy-bnn-rgba-roundtrip.ts` against them.

**Falsifier.** Real `|m|` and `tau` ranges fall inside the bounds the doc states => the round-trip
result stands as measured. Outside => the doc's §4 numbers are re-stated and the `rgba32float`
recommendation is re-derived, possibly to a two-plane hi/lo layout (costed at 2 fetch / 32 bytes per
weight in §10).

Note the F#-to-TS export is the only new scaffolding needed; the codec and the KL are already written.
