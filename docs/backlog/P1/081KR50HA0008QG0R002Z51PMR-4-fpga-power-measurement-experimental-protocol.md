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

## CORRECTION — this protocol is not well-posed as written (2026-08-16, shadow)

Raised by the design deliverable of the blocking row (081KR50HA0008QG0R0028HNZH0):
`docs/research/2026-08-16-fpga-toffoli-zset-join-synthesis-design-bennett-uncompute-is-clean-ancilla-is-quadratic-and-cmos-cannot-measure-landauer.md`.

The original text above is preserved. Three defects, each with a fix:

1. **"Expected signal" treats Toffoli overhead as a competitor to the Landauer saving.** It is not
   a competitor; it is ~1e8 times larger, and on an FPGA the saving is not present at all. An
   FPGA's core supply is a **DC rail**, so every LUT output node dissipates ~CV^2 regardless of
   whether the function it computes is invertible. Charge recovery requires a ramped/resonant
   power-clock as the *supply*, which no bitstream can create. Logical reversibility removes the
   kT*ln2 term (2.871e-21 J/bit) and leaves the switching term (~1e-14 J/transition) untouched —
   and the reversible design has strictly *more* transitions, because uncompute is a second pass.
   Predicted outcome: reversible measures ~2x **worse**, and that is CMOS physics behaving
   correctly, not a negative result about Landauer.

2. **The Analysis section licenses an invalid inference.** "If reversible < irreversible: Landauer
   saving is measurable" — no. A lower reading would be a *switching-activity* difference, never a
   Landauer measurement. This is the accounting-vs-measurement conflation that
   `src/Core.TypeScript/algebra/key-erasure-meter.ts` exists to make untypeable, appearing in a
   backlog row.

3. **XADC is the wrong instrument, on either vendor.** It measures **voltage**, not power
   (~0.73 mV resolution, no known load impedance), and it is Xilinx-7-series-only, so it does not
   exist on the ECP5 target the blocking row now specifies.

### Rescope

From *"is the Landauer saving detectable"* to:

> **What does reversibility COST on isoenergetic CMOS, and what charge-recovery efficiency would a
> custom substrate need to pay it back?**

Measure `R = E_op(REV) / E_op(IRR)` by the differential three-bitstream method (REV / IRR / NUL
common-mode), shunt on the isolated V_core rail + SMU, and the **slope** method (`P(f) =
P_static + E_op * N_op * f`, sweep f, fit) rather than any absolute reading. Then report the
required adiabatic recovery efficiency: reversible wins on a charge-recovery substrate iff
`eta > 1 - 1/R`. That table is the deliverable — it converts an FPGA measurement that cannot see
Landauer into a hard engineering requirement on a custom-silicon program.

**The honesty clause that must travel with any outward-facing use:** adiabatic recovery reduces the
CV^2 term and does **not** approach the Landauer floor either. The Landauer floor is the asymptote
of electronic computing, not a near-term target for any substrate we could build. Putting a measured
number next to kT*ln2 implying proximity would be checkable-false by anyone with a calculator.

What the row already gets right and should keep: same clock, same data, same output consumed. The
design doc strengthens that with a third (NUL) bitstream so clock tree, I/O, leakage and regulator
loss cancel as common mode.
