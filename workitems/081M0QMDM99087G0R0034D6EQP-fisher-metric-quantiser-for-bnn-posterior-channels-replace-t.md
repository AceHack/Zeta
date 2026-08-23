---
id: 081M0QMDM99087G0R0034D6EQP
type: task
state: backlog
priority: P2
slug: fisher-metric-quantiser-for-bnn-posterior-channels-replace-t
title: "Fisher-metric quantiser for BNN posterior channels — replace the equal-mass grid"
created: 2026-08-23T15:39:25.353Z
depends_on: []
composes_with: []
---

# Fisher-metric quantiser for BNN posterior channels — replace the equal-mass grid

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QMDM99087G0R0034D6EQP-*.md` glob. -->
**Register: `toy`.** Measured in `docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-*.md` §9:
an NF4-style **equal-mass quantile grid is 2.8x WORSE than plain per-channel uniform** when the error
metric is KL between posteriors (mean KL 10.88 vs 3.84 nats, 4096 Normal-Gamma weights, 8 bits/channel).

The diagnosis: quantile quantisation allocates resolution by **probability mass of the values**, while
KL between exponential-family members is governed by the **Fisher information metric**. Those are
different measures, and the sparse-but-sensitive region is where a density-matched grid starves.

**The experiment.** Build a quantiser whose levels are uniform in **Fisher-metric arc length** along
each natural-parameter axis (Amari, *Information Geometry and Its Applications*, 2016) and score it on
the same harness (`bun src/Core.TypeScript/bayesian/toy-bnn-rgba-roundtrip.ts`, section [5]).

**Falsifier.** Mean KL strictly below the per-channel-uniform baseline of 3.84 nats at 8 bits/channel,
AND zero texels decoding outside the validity cone (uniform produced 92/4096 invalid). Fails to beat
3.84 => the finding is that no 8-bit scheme is admissible, which is also a result: `rgba32float`
round-trips exactly at 1 fetch / 16 bytes per weight, so nothing is currently blocked on this.

**Not blocking.** Filed because the gap is real and named, not because the encoding needs it.
