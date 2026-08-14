---
id: 081KZZYEPP6087G0R002DRY1PD
type: task
state: backlog
priority: P2
slug: a-2-state-gilbert-elliott-cannot-capture-the-measured-802-11
title: "A 2-state Gilbert-Elliott cannot capture the measured 802.11 channel: 4-state HMM or Pareto-tailed successor"
created: 2026-08-14T10:52:59.974Z
depends_on: []
composes_with: []
---

# A 2-state Gilbert-Elliott cannot capture the measured 802.11 channel: 4-state HMM or Pareto-tailed successor

Filed 2026-08-14 on closing `081KZYP23HG087G0R000117H0K`, so that the calibration landing there
is not mistaken for sufficiency.

## The paper that supplies our calibration also refutes the model it calibrates

da Silva & Pedroso, *Sensors* 22(2), 2022 (PMC9696961) — the source of
`CALIBRATION.wifi2022` — concludes that a 2-state Gilbert–Elliott model **"cannot capture the
behavior of the real system"**, and uses a **4-state HMM** instead. Their measured burst lengths
are **Pareto Type II**: mean 5.37, sd 31.68, **max 8,853** — three orders of magnitude above the
mean. GE burst lengths are **geometric by construction** and have no such tail at any parameter
setting, and a block code's failure probability is dominated by exactly that tail.

Saying this out loud is the point of the item. We now have a *cited* 2-state point, which is a
real improvement over round numbers, and it is still the wrong shape.

## What exists after 081KZYP23HG087G0R000117H0K

`lomaxBurstTrace` — a renewal channel (geometric good runs, Lomax bursts) that is **richer than
GE and weaker than the paper's HMM**. Its `α = 2.0592, λ = 5.688` are **DERIVED by
moment-matching the reported mean and sd**, not the paper's own fit, and at α ≈ 2.06 the variance
is barely finite so the sd match is fragile (measured sd 12.2 against the reported 31.68). It is
adequate for "does the tail change a conclusion" and not for quoting figures.

## Proposed

1. Obtain the paper's actual Pareto Type II parameters (page-check it) rather than moment-matching.
2. Implement the 4-state HMM, or state why the renewal channel is sufficient for this transport.
3. Re-run the sweep on it and report whether any conclusion moves. If none does, that is a
   finding worth as much as a movement — and it retires this item honestly.

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts` — `lomaxBurstTrace`, `UCH-20`
- `docs/research/2026-08-14-the-chaos-harness-loss-model-was-anti-correlated-not-uniform-*.md` §3
