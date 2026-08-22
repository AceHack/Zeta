---
id: 081KR50HA0008QG0R002Z51PMR
priority: P1
status: open
title: "FPGA empirical power measurement — experimental protocol for Landauer validation"
effort: L
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R0028HNZH0]
parent: 081KR50HA0008QG0R003T5MZAC
classification: blocked
decomposition: atomic
owners: [architect]
type: research
tags: [fpga, power-measurement, landauer, empirical, experimental-protocol]
---

# 081KR50HA0008QG0R002Z51PMR — FPGA empirical power measurement

## What

Define and execute the experimental protocol for measuring power consumption
of the reversible vs irreversible Z-set join implementations on FPGA hardware.

### Measurement setup

- **Hardware**: FPGA board with on-chip power monitors (Xilinx XADC or equivalent)
- **Load**: N iterations of Z-set join with identical key/weight distributions
- **Metrics**: dynamic power (W), energy per operation (J/op), heat dissipation (°C rise)
- **Controls**: same clock frequency, same data input, same output consumed

### Expected signal

At room temperature (300K), kT·ln2 ≈ 2.85×10⁻²¹ J per bit erased.
For a join over 10⁶ entries with 32-bit weights, ~32 bits erased per output entry:
```
Expected saving ≈ 32 × 2.85×10⁻²¹ × 10⁶ ≈ 9.1×10⁻¹⁴ J total
```

This is below current FPGA power meter resolution (~µW range). The experiment
tests whether Toffoli overhead is small enough for the saving to be detectable
at scale.

### Analysis

- If reversible < irreversible: Landauer saving is measurable at FPGA scale (POSITIVE)
- If reversible ≈ irreversible: Toffoli overhead masks the saving (INFORMATIVE)
- If reversible > irreversible: overhead dominates at this gate count (ALSO INFORMATIVE)

All three outcomes are publication-grade findings per the research doc.

## Pre-start checklist

- **Blocked by**: 081KR50HA0008QG0R0028HNZH0 (FPGA synthesis) must complete first.
- **External dependency**: physical FPGA board + power measurement equipment.
