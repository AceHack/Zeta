---
id: 081KR50HA0008QG0R0028HNZH0
priority: P1
status: open
title: "FPGA synthesis design — VHDL/Verilog Toffoli gate network for Z-set join"
effort: L
created: 2026-05-09
last_updated: 2026-05-09
depends_on: [081KR50HA0008QG0R0002PGV1N]
parent: 081KR50HA0008QG0R003T5MZAC
classification: blocked
decomposition: atomic
owners: [architect]
type: feature
tags: [fpga, vhdl, verilog, toffoli, synthesis, hardware]
---

# 081KR50HA0008QG0R0028HNZH0 — FPGA synthesis design

## What

Translate the F# Toffoli circuit model (081KR50HA0008QG0R0002PGV1N) into synthesizable
VHDL or Verilog that can be targeted at an FPGA development board.

Requirements:

- Both a reversible (Toffoli) and irreversible (traditional AND/OR) implementation
  of the same Z-set join
- Same interface, same output, different gate strategy
- Parameterized by key width (K bits) and weight width (W bits)
- Synthesis-clean: no simulation-only constructs

### FPGA target

Candidate boards (search-first per Otto-364 before committing):

- Xilinx Artix-7 (common research board)
- Intel/Altera Cyclone V
- Lattice iCE40 (open-source toolchain via Yosys)

## Pre-start checklist

- **Prior-art search**: existing FPGA reversible computing implementations
  (Frank 2017 survey + Xilinx/Lattice app notes). Must WebSearch before design.
- **Blocked by**: 081KR50HA0008QG0R0002PGV1N must be landed and the circuit model validated before
  any VHDL is written.

## Classification note

Classified `blocked` because FPGA toolchain (Vivado, Quartus, or Yosys) is an
external dependency not available in CI. Requires human maintainer setup or

## Design deliverable landed (2026-08-16, shadow)

`docs/research/2026-08-16-fpga-toffoli-zset-join-synthesis-design-bennett-uncompute-is-clean-ancilla-is-quadratic-and-cmos-cannot-measure-landauer.md`

Design document + RTL sketches. No synthesis run, no board — per the routing, this row's
deliverable is the *design*, and the toolchain dependency in the classification note below is
therefore not blocking for it.

Answers to the row's open questions:

- **Does the Z-set join uncompute cleanly?** Yes, for a **sorted-merge** equi-join kernel:
  compare, multiply, and accumulate each uncompute to zero ancilla (Bennett 1973), at ~2x depth
  and ~2x area, 1x throughput when pipelined. `ZSet.join`'s hash-index build and
  `sortAndConsolidate` are scoped out — retaining a sort permutation costs O(n log^2 n) decision
  bits (~13 MB at n = 2^20), which is the one place the ancilla budget genuinely breaks.
- **Ancilla budget:** **O(W^2 + K) per lane, constant in N** with uncompute (~1 121 bits at
  W=32/K=32; ~129 bits row-at-a-time). CHECKED contrast: the current `modelWeightMul` is
  Theta(W^3) — measured 34 948 wires / 68 610 gates at W=32 — and `modelJoinCircuit` is linear in
  N with zero reuse, i.e. ~3.5e10 wires at N=1e6. That model cannot be lifted to RTL, and its
  circuit shape is value-dependent (`magnitudeBitWidth`, the `productIsZero` sign-gate guard).
- **Irreversible control:** ordinary RTL (`==`, `*`, `+`), with `use_dsp="no"` and matched
  carry-chain inference on **both** designs so the comparison is not macro-vs-fabric.
- **Prior-art search: done** (Frank 2017 + adiabatic power-clock literature + the FPGA
  reversible-logic papers). Finding: the "low-power reversible logic on FPGA" literature reports
  savings that cannot mean what they appear to — mapping Toffoli networks onto irreversible LUTs
  does not make the fabric reversible. Frank's own position (charge recovery is required) is the
  anchor to follow.

Two things must happen before RTL is written: page-check the Cuccaro et al. 2004 1-ancilla adder
figure (load-bearing for the budget), and fix or retire the vacuous zero-erasure properties in
`tests/Tests.FSharp/Formal/ToffoliGate.Laws.Tests.fs` (see the doc's section 4 — verified by
mutation: deleting every gate leaves both assertions satisfied).

**Target correction:** Lattice ECP5 (ULX3S) via Yosys/nextpnr, not Artix-7 — the open bitstream is
the reproducibility story, and reproducibility is a requirement here rather than a nicety. This
matches `docs/inventory/hardware-to-buy.md`, and it means **XADC is unavailable** (7-series only);
see the downstream row.
