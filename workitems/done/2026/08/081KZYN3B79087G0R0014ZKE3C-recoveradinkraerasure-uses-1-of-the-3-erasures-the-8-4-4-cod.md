---
id: 081KZYN3B79087G0R0014ZKE3C
type: bug
state: done
priority: P2
slug: recoveradinkraerasure-uses-1-of-the-3-erasures-the-8-4-4-cod
title: "recoverAdinkraErasure uses 1 of the 3 erasures the 8,4,4 code can correct; shipped goodput is dominated by the XOR 7-of-8 fallback"
created: 2026-08-13T22:50:16.169Z
completed: 2026-08-14T01:30:24.878Z
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

| loss | burst       | shipped decoder | full-capability decoder |
| ---- | ----------- | --------------- | ----------------------- |
| 5%   | 1 (uniform) | 96.05%          | **100.00%**             |
| 10%  | 1 (uniform) | 84.95%          | **99.96%**              |
| 10%  | 4           | 85.84%          | **93.31%**              |
| 20%  | 1 (uniform) | 52.03%          | **99.35%**              |
| 30%  | 1 (uniform) | 19.72%          | **95.68%**              |

99%-delivery cliff: **~2% uniform loss shipped vs ~20% with the full decoder** — an order of
magnitude of headroom the wire format has already been paid for and is not collecting.

## The signal that something is wrong — CHECKED

The module header offers the XOR-only fallback (rate 7/8, 12.5% overhead) as the _low-bandwidth
compromise_ for LoRa/BLE, and [8,4,4] (rate 4/8, 50% overhead) as the choice for high-bandwidth
UDP. Both correct exactly 1 erasure per 8 wire packets **as implemented**. Measured on goodput
(delivered data packets per wire packet — the only fair cross-rate comparison), the XOR fallback
**dominates the shipped [8,4,4] path at every loss rate in the useful operating range**:

| loss | burst | shipped [8,4,4] goodput | XOR-7/8 goodput |
| ---- | ----- | ----------------------- | --------------- |
| 0%   | —     | 0.500                   | **0.875**       |
| 2%   | 1     | 0.497                   | **0.869**       |
| 5%   | 4     | 0.464                   | **0.788**       |
| 10%  | 4     | 0.429                   | **0.705**       |
| 20%  | 4     | 0.361                   | **0.557**       |

Pinned as `UCH-13`. The [8,4,4] code only earns its 50% overhead above roughly **30–40% loss**,
and only with a full-capability decoder (at 40% uniform loss: ML 0.388 vs XOR 0.009).

## The fix — SHIPPED 2026-08-14

`recoverAdinkraBlock` solves the erasure system directly over the code's parity checks:
`H = [Aᵀ | I₄]` derived from `ADINKRA_G` (not re-declared), then Gauss–Jordan over GF(2) with
byte-vector right-hand sides. Recovers every erased position at once, returns null exactly when
the erased columns of `H` are dependent — the code's limit, not the decoder's.
`recoverAdinkraErasure` keeps its signature as a projection onto the first erased position.
`addToBlock` now attempts recovery on **every arrival from the 4th onwards** rather than only at
7-of-8; that seam was half the defect, since it discarded blocks the decoder could already solve.
No wire-format change: same generator, same 8 packets, same headers.

Measured after (same seed `0x5eed`, same harness), shipped decoder vs the ML reference:

| loss | burst | shipped, before | shipped, after | ML ceiling |
| ---- | ----- | --------------- | -------------- | ---------- |
| 5%   | 1     | 96.15%          | **100.00%**    | 100.00%    |
| 10%  | 1     | 84.93%          | **99.95%**     | 99.95%     |
| 10%  | 4     | 85.80%          | **93.17%**     | 93.17%     |
| 20%  | 1     | 52.03%          | **99.35%**     | 99.35%     |
| 30%  | 1     | 19.72%          | **95.68%**     | 95.68%     |

The shipped path is now equal to the ML ceiling at every measured point, to all printed digits.
3-erasure census: **0/56 → 56/56**, byte-exact.

## The rate guidance — the prediction in this item was WRONG

This item expected `UCH-13` to fail once a full decoder landed. **It does not.** Re-measured
after the fix, XOR-7/8 still dominates [8,4,4] on goodput at every point `UCH-13` tests:

| loss (uniform)    | 0%    | 5%    | 10%   | 20%   | 30%   | 40%   |
| ----------------- | ----- | ----- | ----- | ----- | ----- | ----- |
| [8,4,4] after fix | 0.500 | 0.500 | 0.500 | 0.497 | 0.479 | 0.388 |
| XOR-7/8           | 0.875 | 0.833 | 0.722 | 0.409 | 0.125 | 0.010 |

The reason is rate, not capability: at low loss goodput → rate, and 7/8 > 4/8 by construction, so
**no decoder improvement can close that gap** — it can only raise [8,4,4] toward its own 0.5
ceiling. Erasure capability starts paying only once loss breaks the 7/8 code often, i.e. once its
block-failure probability exceeds `1 − 0.5/0.875 ≈ 0.43`. The fix moves the crossover from
roughly **33% → 18%** uniform loss (and from beyond 40% to roughly **31%** at mean burst
length 4) without abolishing it. So the header's guidance is still inverted for the ordinary
operating range; what changed is the size of the inversion and the reason for it. `UCH-13` keeps
its assertions and carries the wrong prediction on the record; `UCH-13b` pins the crossover so
the range claim cannot be read as a verdict against the code.

Caveat on all "uniform" rows: the harness's `meanBurstLength = 1` is **not** i.i.d. Bernoulli —
it forbids consecutive losses, so these numbers are optimistic. Filed as
`081KZYY6SVJ087G0R0035SW945`, deliberately not bundled.

## Standing falsifiers added

- `ULT-22` — all **256** erasure patterns, verdict checked against the code's own algebra
  (codeword supports enumerated through `computeAdinkraParity`, never a remembered table):
  `0:1/1 · 1:8/8 · 2:28/28 · 3:56/56 · 4:56/70 · 5+:0`.
- `ULT-23` — property test, any 3 losses in any arrival order, through the receiver state machine.
- `ULT-4` — replaced: the old "two erasures → unrecoverable" was the decoder's limit stated as the
  code's. Now an erased weight-4 codeword support, with the ambiguity demonstrated.
- `ULT-25/26`, `UCH-7`, `UCH-17` — symbol-length sizing, block-length precondition, and the
  end-to-end statement that the live receiver loses nothing against the ML ceiling under loss +
  reorder + duplication.

Mutation-tested: 13 mutants of the fix, 12 killed. The survivor (transposing `H`) is unobservable
because `A` is symmetric for this code, and is documented in place rather than chased.

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.test.ts` — `UCH-7`, `UCH-12`, `UCH-13`
- `docs/research/2026-08-13-udp-lossy-transport-burst-loss-cliff-gilbert-elliott-chaos-harness-and-why-foundationdb-dst-does-not-reach-this-fault-class.md`
- Sibling defects: `081KZYN37T4087G0R00181THA4` (AIMD estimator), `081KZYN3D53087G0R0036XZSYM` (spurious NACKs)
