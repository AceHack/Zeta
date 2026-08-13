---
id: 081KZYN3B79087G0R0014ZKE3C
type: bug
state: backlog
priority: P2
slug: recoveradinkraerasure-uses-1-of-the-3-erasures-the-8-4-4-cod
title: "recoverAdinkraErasure uses 1 of the 3 erasures the 8,4,4 code can correct; shipped goodput is dominated by the XOR 7-of-8 fallback"
created: 2026-08-13T22:50:16.169Z
depends_on: []
composes_with: []
---

# recoverAdinkraErasure uses 1 of the 3 erasures the 8,4,4 code can correct; shipped goodput is dominated by the XOR 7-of-8 fallback

Found 2026-08-13 by the seeded chaos harness
(`src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts`).

## The defect — CHECKED

A linear code with minimum distance `d` corrects **any `d−1` erasures**: two codewords agreeing
on the `n−(d−1)` surviving positions would differ in at most `d−1 < d` positions, contradicting
the minimum distance. The Adinkra [8,4,4] extended Hamming code has `d = 4`, so it corrects
**any 3 erasures per block of 8** — and some 4-erasure patterns besides (any pattern whose
erased column set does not contain the support of a nonzero codeword).

`recoverAdinkraErasure` returns `null` at `erasedCount > 1`. It uses **1 of the 3** erasures the
code pays for. The module header states "corrects 1 erasure per block of 8" as if it were the
code's property; it is the decoder's limit, not the code's.

`UCH-7` enumerates all 56 three-erasure patterns: a GF(2) maximum-likelihood decoder recovers
**56/56** byte-exactly; `recoverAdinkraErasure` recovers **0/56**.

## The measured cost — CHECKED

Delivery ratio, 8-byte payloads, seeded Gilbert–Elliott channel (6000 blocks/point):

| loss | burst | shipped decoder | full-capability decoder |
|---|---|---|---|
| 5% | 1 (uniform) | 96.05% | **100.00%** |
| 10% | 1 (uniform) | 84.95% | **99.96%** |
| 10% | 4 | 85.84% | **93.31%** |
| 20% | 1 (uniform) | 52.03% | **99.35%** |
| 30% | 1 (uniform) | 19.72% | **95.68%** |

99%-delivery cliff: **~2% uniform loss shipped vs ~20% with the full decoder** — an order of
magnitude of headroom the wire format has already been paid for and is not collecting.

## The signal that something is wrong — CHECKED

The module header offers the XOR-only fallback (rate 7/8, 12.5% overhead) as the *low-bandwidth
compromise* for LoRa/BLE, and [8,4,4] (rate 4/8, 50% overhead) as the choice for high-bandwidth
UDP. Both correct exactly 1 erasure per 8 wire packets **as implemented**. Measured on goodput
(delivered data packets per wire packet — the only fair cross-rate comparison), the XOR fallback
**dominates the shipped [8,4,4] path at every loss rate in the useful operating range**:

| loss | burst | shipped [8,4,4] goodput | XOR-7/8 goodput |
|---|---|---|---|
| 0% | — | 0.500 | **0.875** |
| 2% | 1 | 0.497 | **0.869** |
| 5% | 4 | 0.464 | **0.788** |
| 10% | 4 | 0.429 | **0.705** |
| 20% | 4 | 0.361 | **0.557** |

Pinned as `UCH-13`. The [8,4,4] code only earns its 50% overhead above roughly **30–40% loss**,
and only with a full-capability decoder (at 40% uniform loss: ML 0.388 vs XOR 0.009).

## Proposed fix — PROPOSED, not implemented here

Replace `recoverAdinkraErasure`'s single-erasure special case with the GF(2) erasure solve
already written and tested in the harness (`mlDecodeBlock` + `invertGf2`). No wire-format
change: same generator, same 8 packets, same headers — decode side only. The harness reads the
generator **out of** `computeAdinkraParity` (`generatorFromModule`) so the two cannot drift.

Second, smaller item once that lands: revisit the header's rate guidance, which the measurements
above invert.

`UCH-13` pins CURRENT behaviour and is expected to FAIL when this is fixed.

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.test.ts` — `UCH-7`, `UCH-12`, `UCH-13`
- `docs/research/2026-08-13-udp-lossy-transport-burst-loss-cliff-gilbert-elliott-chaos-harness-and-why-foundationdb-dst-does-not-reach-this-fault-class.md`
- Sibling defects: `081KZYN37T4087G0R00181THA4` (AIMD estimator), `081KZYN3D53087G0R0036XZSYM` (spurious NACKs)
