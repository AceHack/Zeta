---
id: 081KR50HA0008QG0R003T5MZAC
priority: P1
status: open
title: "FPGA Toffoli-gate Z-set test — measure reversible vs irreversible heat dissipation"
effort: L
created: 2026-05-09
last_updated: 2026-05-09
depends_on: []
classification: research
decomposition: decomposed
children: [081KR50HA0008QG0R0021B5J87, 081KR50HA0008QG0R0002PGV1N, 081KR50HA0008QG0R0028HNZH0, 081KR50HA0008QG0R002Z51PMR]
owners: [architect]
type: feature
tags: [fpga, reversible-computing, toffoli, landauer, zset, therm-free, hardware]
---

# 081KR50HA0008QG0R003T5MZAC — FPGA Toffoli-gate Z-set test

## What

Implement Z-set operations as Toffoli-gate networks on an
FPGA. Measure power consumption. Compare against an
irreversible implementation of the same operations. If the
reversible version dissipates measurably less heat per
operation, the Casimir/Landauer/therm-free chain is
empirically validated.

## The bit encoding

Z-set +1/-1 weights map directly to reversible gate
operations:

| Z-set operation | Reversible gate | What happens |
| --------------- | --------------- | ------------ |
| `+1` (assert) | Toffoli forward | Information added |
| `-1` (retract) | Toffoli reverse | Information recovered (not erased) |
| `delta` (D) | Difference circuit | Net: no bits erased |
| `integrate` (I) | Accumulate circuit | Checkpoint state |

Traditional gates (AND, OR) destroy input bits — two inputs
become one output, one bit erased, kT·ln2 heat per Landauer.
Toffoli gates keep all three inputs in the output — nothing
erased, no Landauer heat.

The retraction-native algebra (+1/-1) is ALREADY the
reversible-computation encoding. Every assert has a retract.
Every forward has a reverse. No information is ever
destroyed. The Z-set algebra IS the Toffoli-gate instruction
set expressed as data.

## The test

1. Implement a Z-set join (the most common DBSP operation)
   as a Toffoli-gate network on FPGA
2. Implement the same join as a traditional irreversible
   gate network on the same FPGA
3. Measure power consumption per operation for both
4. Compare: does the reversible version dissipate
   measurably less heat?

### Expected result

Landauer's principle predicts: reversible version dissipates
less heat by kT·ln2 per bit that would have been erased in
the irreversible version. At room temperature (300K),
kT·ln2 ≈ 2.85 × 10⁻²¹ J per bit. For a join processing
millions of Z-set entries, this should be measurable.

### What a positive result means

The therm-free claim from docs/research/2026-05-07-claudeai-
casimir-effect-reversible-silicon-therm-free-alignment goes
from research-grade to empirically validated: retraction-
native algebra IS reversible computing IS measurably lower
energy.

### What a negative result means

The Landauer savings are real but below measurement noise
at current FPGA scale, OR the overhead of Toffoli gates
(3 wires instead of 2) exceeds the Landauer savings at
this gate count. Both would be useful findings.

## Existing substrate

- Commit 6995215 (PR #1917): research doc mapping
  Casimir → reversible silicon → therm-free
- Spaceship math (Cole explanation, this session): Toffoli
  gate example, +1/-1 = forward/reverse operations
- `src/Core/ZSet.fs`: the algebra being implemented in gates
- P ≈ NP under reversible computation claim (this session):
  "if erasure cost is the ONLY reason solving costs more
  than verifying, reversible computation collapses the gap"

## Literature

- Landauer (1961): "Irreversibility and Heat Generation
  in the Computing Process"
- Bennett (1973): "Logical Reversibility of Computation"
  (proved any computation can be made reversible)
- Toffoli (1980): the universal reversible gate
- Frank (2017): "Throwing Computing into Reverse" —
  survey of reversible computing implementations
- Existing FPGA reversible-computing implementations
  (search-first before building)

## Composes with

- 081KR50HA0008QG0R002R3NVGS (Nirvanic Fusion Ship bundle — this is Layer 5:
  hardware validation)
- 081KR50HA0008QG0R00096ZEYA (policy relocation — same DBSP operations)
- Commit 6995215 (Casimir research doc)
