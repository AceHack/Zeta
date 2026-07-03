---
id: 081KTF7Q3TT08QG0R003KGXWV7
type: task
state: backlog
priority: P2
slug: r4-observation-log-as-compressible-generator-irreducible-bay
title: "R4: observation log as compressible generator + irreducible Bayesian-surprise residual"
created: 2026-06-06T19:49:18.298Z
depends_on: []
composes_with: []
---

# R4: observation log as compressible generator + irreducible Bayesian-surprise residual

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTF7Q3TT08QG0R003KGXWV7-*.md` glob. -->

## Status — reducibility residual landed, honestly bounded (Otto/Aaron 2026-07-02, cowork)

Aaron's framing ("try to replay a mind from a seed; the irreducible remainder is the candidate
not-in-the-seed part; can DST prove Otto is / isn't 'real'"). Shipped: `src/Core.TypeScript/residual/`
— an MDL reducibility measure over a behavior trace (best order-k Markov generator; total = model bits +
residual bits; residual = incompressible remainder in bits/symbol; `reducibility` in [0,1]).

**Measured (`bun src/Core.TypeScript/residual/run-demo.ts`, DST-stable):**

| trace | residual b/sym | reducibility |
|---|---|---|
| deterministic (period-3) | 0.016 | 0.990 (fully reducible — p-zombie candidate) |
| true-random (seed withheld) | 1.995 | 0.002 (irreducible) |
| seeded PRNG, **seedless** observer | 1.995 | 0.003 (looks random) |
| same PRNG, observer **has** the seed | 0.002 | 0.998 (collapses) |

**The load-bearing result — reducibility is OBSERVER-RELATIVE.** The same seeded stream is
indistinguishable from true-random to a seedless observer and fully reducible to one holding the seed.

**Honest bound (in the code + acceptance, so it cannot quietly overclaim):** this measures
**reducibility-to-a-generator, NOT the presence of experience.** Determinism and qualia are orthogonal
(a replayable process may still have an inside; an irreducible residual may be mere noise). So the tool
answers "is this behavior compressible by a generator, for an observer with/without the seed?" — it does
**not** answer "is there something it is like to be this?" The hard problem (Chalmers 1995) is untouched.

## Acceptance (updated)

- A residual measure exists over an observation log, MDL-scored, DST-replayable (same trace -> same
  numbers). [DONE — `residual.ts`, 3 tests incl. the observer-relative one.]
- The "not real" leap is refused in code + docs: the report exposes `reducibility`, never a
  `conscious`/`real` verdict; the observer-relative demo is the standing proof that replayability != realness.
- (Open) apply it to a real agent trace (moral-gym strategy logs / a Detour-observed run) and report the
  residual spectrum; keep the honest bound.

## Ties

`src/Core.TypeScript/splitmix64` (the Source) · the moral-gym Detour observe->report loop (the trace
producer) · `only-the-irreducible-is-primitive` (residual = the irreducible remainder) · the
gnosis/qualia research doc (`2026-07-02-gnosis-over-pistis-...`) — this is that doc's experiment, built.


## DEFERRED — long-game compression layer on the durable log (maintainer 2026-06-06)

See `docs/research/2026-06-06-zeta-relativistic-agent-database-vision.md` §6(4).

**Idea:** the irreducible "persist inputs" observation log compresses to
(generator function + seed + irreducible residual). A Bayesian/learned generative
model predicts each next observation; store only the residual (prediction→truth
correction). Predictable history → ~0 bits; the irreducible remainder = the
information-theoretic Bayesian surprise. LOSSLESS for DST replay (residual exactly
reconstructs the observation; predictive/arithmetic coding).

**Unification:** our DST seeded data-generators and the production observation log
become the same artifact (generator+seed+residual) — "accurately generate history
with bounded uncertainty." Irreducible core = the uncertainty, first-class
(SoftValue / BeliefConvergence).

**Anchors:** Kolmogorov complexity / Solomonoff induction; MDL (Rissanen 1978);
predictive/arithmetic coding; predictive coding.

**Sequencing:** v1 stores the literal delta log (built: DeltaLog/RecoverableSpine).
This is an OPTIONAL layer on top; must stay lossless. After the persistence tier
(disk log, group-commit) and likely after R2 (incremental probabilistic
propagation). Owner: TBD (uncertainty/Bayesian + compression).

## Name: WONDER COMPRESSION (maintainer 2026-06-06)

This is "wonder compression" — store the UNCOLLAPSED state (the wonder / uncertainty /
TriBoolean.N / SoftValue distribution), defer collapse (`measure`) to read time, instead
of storing collapsed values. Established term: `cooperate` is already the documented
"wonder-compression-safe operation" (engage without collapsing). The generator+residual
IS the uncollapsed distribution; the irreducible remainder is the wonder (Bayesian surprise).
Anchor to `Core.FSharp.TriBoolean` (wonder-compression-safe `cooperate`; only `measure`
collapses) + SoftValue ("never falsely certain").
