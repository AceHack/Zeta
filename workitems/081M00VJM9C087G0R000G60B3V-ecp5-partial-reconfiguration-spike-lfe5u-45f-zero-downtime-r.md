---
id: 081M00VJM9C087G0R000G60B3V
type: task
state: backlog
priority: P2
slug: ecp5-partial-reconfiguration-spike-lfe5u-45f-zero-downtime-r
title: "ECP5 partial reconfiguration spike: LFE5U-45F zero-downtime region swap via LSC_WRITE_ADDRESS"
created: 2026-08-14T19:21:57.292Z
depends_on: []
composes_with: []
---

# ECP5 partial reconfiguration spike: LFE5U-45F zero-downtime region swap via LSC_WRITE_ADDRESS

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00VJM9C087G0R000G60B3V-*.md` glob. -->

## What

Prove — or fail honestly — that **zero-downtime partial reconfiguration** works on a Lattice
ECP5 **LFE5U-45F** through the fully open toolchain (Yosys / nextpnr / Project Trellis).

This is the Class-B requirement from Aaron 2026-08-14: *"open bitstream runtime modifiable with
0 down time of the bitstream itself."* "Partial reconfiguration" is the standard term.

## Why 45F and not 85F

Project Trellis documents ECP5 frame addressing **only for the 45k device**:

> "It has only been fully documented for the 45k device."

Our existing wish list (`docs/inventory/hardware-to-buy.md` §1) leads with the 85F. For PR
specifically the documented part is `LFE5U-45F`.

## The documented mechanism (Project Trellis, "Partial Bitstreams")

> "LSC_WRITE_ADDRESS can be used to make partial bitstreams. Combined with background
> reconfiguration and the ability to reload frames glitchlessly; partial reconfiguration is
> possible on ECP5."

Requires the `BACKGROUND_RECONFIG` sysCONFIG option; then JTAG instruction `0x79` (no data) and
`0x74` followed by `0x00` before the partial bitstream data.

## Honest risk

There is **no `nextpnr` reconfigurable-partition feature**. A partial bitstream means
constraining a region, extracting its frames, and driving `LSC_WRITE_ADDRESS` ourselves. This
spike may fail. Failing is a valid result and should be recorded as one rather than retried
indefinitely.

## Done when

Either (a) a blinker in region A keeps running, uninterrupted and observably glitch-free, while
region B is swapped for different logic; or (b) a written negative result naming exactly where
the open flow stops.

## Composes with

- `081KR50HA0008QG0R0028HNZH0` — Toffoli vs AND/OR Z-set join (the reversible-logic payload).
- `src/Core.TypeScript/algebra/key-erasure-meter.ts` — the Landauer erasure side of the same physics.
- The `ace` zero-downtime update path: PR is that property one level down, in hardware.
