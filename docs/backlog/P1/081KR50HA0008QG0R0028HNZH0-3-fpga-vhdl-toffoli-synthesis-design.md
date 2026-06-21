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
