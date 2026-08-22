# The chaos harness's loss model was anti-correlated, not uniform: a falsifier, a calibration, and what really disarmed ULT-34

**Date:** 2026-08-14
**Closes:** `081KZYY6SVJ087G0R0035SW945` (the model defect), `081KZYP23HG087G0R000117H0K` (the calibration)
**Touches:** `udp-lossy-transport.chaos.ts`, `udp-lossy-transport.chaos.test.ts`, and a comment-only
correction to `udp-lossy-transport.ts`. **No production transport behaviour changed.**

---

## 0. The one-sentence version

The harness's "uniform loss" channel forbade consecutive losses, which is the *opposite* of
uniform; every headline number it produced was measured on a channel that spaces its losses out,
and — the reason this stopped being a footnote — a model that cannot produce a fault class cannot
kill a mutant in that class, so the instrument was silently disarming mutation tests on
security-relevant bounds.

---

## 1. The defect — CHECKED

`burstParams(ρ, meanBurstLength)` documented `meanBurstLength = 1` as reducing to "i.i.d.
Bernoulli loss — the degenerate case". With `lossInGood = 0`, `lossInBad = 1` and `r = 1/L = 1`,
the chain leaves BAD after **exactly** one packet, always.

Measured over 400,000 packets at ρ = 0.1, seed `0xabcd`:

| quantity | `burstParams(0.1, 1)` | `bernoulliParams(0.1)` | i.i.d. expectation |
|---|---|---|---|
| observed loss rate | 0.10016 | 0.10049 | 0.1 |
| `P(drop \| previous drop)` | **0.00000** | 0.10334 | 0.1 |
| mean loss-run length | 1.00000 | 1.11525 | `1/(1−ρ)` = 1.1111 |
| longest run in 400k | **1** | 6 | — |

Per block of 8 — the distribution the `[8,4,4]` code is actually decided by:

| k | `burstParams(0.1,1)` | `bernoulliParams(0.1)` | `Binomial(8, 0.1)` |
|---|---|---|---|
| 0 | 0.392180 | 0.427900 | 0.430467 |
| 1 | 0.434680 | 0.383600 | 0.382638 |
| 2 | 0.153840 | 0.150680 | 0.148803 |
| 3 | 0.018300 | 0.032860 | 0.033067 |
| 4 | 0.001000 | 0.004420 | 0.004593 |
| 5 | **0.000000** | 0.000520 | 0.000408 |
| 6 | **0.000000** | 0.000020 | 0.000023 |

The tail — the only part an erasure code cares about — was understated **1.8× at k=3**, **4.6× at
k=4**, and **infinitely at k ≥ 5**, which was not merely rare but *impossible*.

### Why `L = 1` cannot be Bernoulli, structurally

A two-state chain is memoryless exactly when `P(bad next)` is the same from either state:
`p = 1 − r`. Its mean sojourn in BAD is then `1/r = 1/(1−p) > 1`. **A mean burst length of exactly
1 is unattainable for any channel with nonzero loss.** `L = 1` is not the origin of the
correlation axis, it is the far end of it.

`burstParams(ρ, 1)` is **kept**, unchanged, and still used. An anti-correlated bound is a
legitimate thing to measure against. It is simply no longer called uniform.

---

## 2. What was built

1. **`bernoulliParams(ρ)`** — the GE point where the chain is memoryless. `r = 1 − ρ` is *forced*
   by demanding independence, and `L = 1/(1−ρ)` **falls out** rather than being asserted.
2. **`gilbertElliottParams(p, r, lossInGood, lossInBad)`** — all four parameters reachable. The
   type always had `lossInGood`/`lossInBad`; no *call site* did, so what ran was **Gilbert's**
   1960 channel (`k=1, h=0`), never **Elliott's** 1963 generalisation the harness is named for.
   A free field with no caller is not a capability.
3. **`CALIBRATION.wifi2022`** — `p = 0.0393, r = 0.1862, lossInGood = 0.0055, lossInBad = 0.6097`.
4. **`analyticLossRunLength`** — the third closed-form falsifier, and the one that was missing.
5. **`lomaxBurstTrace`** — a Pareto Type II renewal channel for the tail GE cannot represent.
6. **`UCH-5b`** — the falsifier: it **FAILS if consecutive losses are impossible**. Verified by
   mutation: all five of its assertions fail when pointed at `burstParams(ρ, 1)`.

### `1/r` was standing in for two different quantities

`1/r` is the mean sojourn in the **BAD state**. The mean run of consecutive **drops** equals it
only when `lossInBad = 1`. Under the measured 802.11 fit they differ by **2.8×** (5.37 vs 1.92),
and it is the drop run, not the state sojourn, that an erasure code experiences. `UCH-18` pins the
closed form against measurement on all four channel families; it agrees to within 0.15 packets on
each.

---

## 3. The calibration — CITED, not page-checked

da Silva & Pedroso, *Packet Loss Characterization Using Cross Layer Information and HMM for Wi-Fi
Networks*, **Sensors 22(2), 2022** (PMC9696961); 410 hours of indoor 802.11 UDP traces. The
numbers are carried from the audit in `081KZYP23HG087G0R000117H0K`, which reports reading them
from the paper. **I did not open it on this pass** and the register is recorded rather than
rounded up.

The sharpest consequence is that `lossInBad = 1` is not merely pessimistic — it is **mis-shaped**.
A 61%-loss bad state leaves ~3 of 8 gone per block, sitting on the `[8,4,4]` correction boundary.
Measured at a matched overall rate ρ = 0.1108, mass on the k = 3..5 boundary:

| channel | k=3 | k=4 | k=5 | boundary mass |
|---|---|---|---|---|
| calibrated 802.11 (4-param) | 0.05794 | 0.04146 | 0.02680 | **0.12620** |
| total-outage GE, L = 5.37 | 0.03652 | 0.03068 | 0.02158 | 0.08878 (1.42× less) |
| anti-correlated L = 1 | 0.02502 | 0.00132 | 0.00000 | 0.02634 (**4.79× less**) |

Same mean loss rate in all three rows, so the difference is **shape, not severity**. The harness
had been testing a differently-shaped channel, not merely a harsher one.

**LoRa and LEO satellite remain UNRESOLVED.** Searched, not found, deliberately not extrapolated
from the Wi-Fi fit. Filed rather than filled.

### Say what the paper says

The same paper concludes a 2-state Gilbert–Elliott model **"cannot capture the behavior of the
real system"** and uses a 4-state HMM instead. Burst lengths are Pareto Type II with mean 5.37,
sd 31.68 and **max 8,853** — three orders of magnitude above the mean, against a geometric
distribution that has no such tail at any parameter setting.

So `CALIBRATION.wifi2022` is **the best 2-state point available, not a sufficient model**, and
this document does not pretend otherwise. `lomaxBurstTrace` is a renewal process — richer than GE,
still weaker than the paper's HMM. Its `α = 2.0592, λ = 5.688` are **DERIVED** by moment-matching
the reported mean and sd, not read from the paper, and the honest limit is stated in the code: at
α ≈ 2.06 the variance is barely finite, so the sd match is fragile (a 400k run reproduces mean
5.98 against 5.37, sd 12.2 against 31.68). Use it to see whether the tail **changes a conclusion**,
not to quote a second decimal. **The 4-state HMM is the honest next step and is filed as one.**

---

## 4. The deltas — every headline number, re-run

All at seed `0x5eed`. **No assertion was weakened to accommodate a worse number.**

### 4.1 The 99% delivery cliff — moves in by a full grid step

| decoder | anti-correlated `L=1` (published as "uniform") | genuine i.i.d. Bernoulli |
|---|---|---|
| `impl-adinkra` | 0.20 | **0.12** |
| `ml-adinkra` | 0.20 | **0.12** |

The claim "holds 99% delivery to ~20% uniform loss" was **only ever true of an anti-correlated
channel**. It is wrong as stated, and `UCH-22` now carries the honest number. `UCH-12` keeps its
assertions — the channel it describes has not changed, only its name.

### 4.2 Delivery curve, `impl-adinkra`, blocks = 3000

| rate | `L=1` anti-corr | i.i.d. Bernoulli | Δ |
|---|---|---|---|
| 0.05 | 1.00000 | 0.99967 | −0.00033 |
| 0.12 | 0.99900 | 0.99767 | −0.00133 |
| 0.20 | 0.99433 | 0.98367 | −0.01066 |
| 0.30 | 0.95933 | 0.91333 | **−0.04600** |

Monotone: the anti-correlated model **never** reported worse than the honest one. `UCH-21` pins
all four rows.

### 4.3 The decoder's 56/56 — UNCHANGED, and it could not have moved

`UCH-7` enumerates all 56 three-erasure patterns exhaustively and combinatorially. It never runs a
loss process, so no channel defect could have touched it. 56/56 stands. The same holds for
`UCH-17` (the live receiver matching the ML ceiling) — it compares two decoders on an *identical*
drop trace, and a shared trace cancels out of a comparison.

### 4.4 The XOR-7/8 crossover — barely moves, and the direction of bias REVERSES

| rate | `[8,4,4]` anti | `[8,4,4]` i.i.d. | XOR-7/8 anti | XOR-7/8 i.i.d. |
|---|---|---|---|---|
| 0% | 0.500 | 0.500 | 0.875 | 0.875 |
| 5% | 0.500 | 0.500 | 0.834 | 0.825 |
| 10% | 0.500 | 0.499 | 0.725 | 0.714 |
| 20% | 0.497 | 0.492 | 0.413 | 0.445 |
| 30% | 0.480 | 0.457 | 0.126 | **0.229** |
| 40% | 0.388 | 0.387 | 0.010 | **0.092** |

Crossover: **~18% anti-correlated → ~19% i.i.d.** It essentially does not move, because both
curves shift together.

**But `081KZYY6SVJ087G0R0035SW945`'s own claim that "every uniform-loss row is optimistic in the
code's favour" is FALSE, and this is the correction.** It holds for the `[8,4,4]` delivery curve
and fails for XOR-7/8 at high loss, where the old model was *pessimistic* by **9×**.

The mechanism: **anti-correlation suppresses variance.** At high loss a rate-7/8 code needs a
lucky block (≤1 erasure in 8), and luck is variance. Forbidding runs also forbids the clean
stretches, so the anti-correlated model under-reports the low-redundancy code. A model error is a
**distortion, not a bias with a fixed sign** — which way it points depends on which tail the
consumer of the number lives in. `UCH-23` pins this, and `UCH-13b`'s `xor.goodput < 0.05` at 40%
is now explicitly labelled a property of the anti-correlated channel (it is 0.092 on an i.i.d.
one). The module header's "at 40% uniform: 0.388 vs 0.010" is **withdrawn**.

### 4.5 Corruption separation in #10541 — NOT affected

PR #10541's chaos-harness corruption rows draw per-packet on the declared entropy channel, not
through the GE chain, so they are genuine i.i.d. Bernoulli already and stand unchanged. Its **BDP**
rows do run `burstParams(rate, 1)`; that caveat is carried in its own body and the fix here does
not retroactively move those numbers, because the BDP sweep's corruption arm is a separate call
site left for that PR to rebase onto.

---

## 5. `ULT-34`: the stated cause was wrong — CHECKED

The premise handed to this work was that `meanBurstLength = 1` forbidding consecutive corruptions
is *why* mutating `Math.min(pendingCorruptFrames, missing.length)` left 75 tests green.

**The first half is a fact. The causal half does not survive measurement.**

Replaying the receiver's own arithmetic — **read** from #10541 `udp-lossy-transport.ts` lines
1327/1406, not inferred — over 200k–400k frames:

| corruption channel | loss channel | clamp fires |
|---|---|---|
| `burstParams(ρ,1)` | none | 0 |
| `bernoulliParams(ρ)` | none | **0** |
| `bernoulliParams(ρ)` | `burstParams(0.05, L)`, L ∈ {1,2,4,8} | **0** |
| `bernoulliParams(ρ)` | `burstParams(0.05, 100)` | ~1,158 |
| `burstParams(ρ,1)` | `burstParams(0.05, 100)` | ~896 |
| `bernoulliParams(ρ)` | heavy-tail Lomax | ~5 |

**Confirmed against the real code, not only by model.** PR #10541 merged while this branch was in
CI, so the mutation was re-run for real: replacing `Math.min(...)` with the bare
`this.pendingCorruptFrames` leaves **all 30 tests in the corrected chaos file GREEN** — genuine
Bernoulli channel and all — and only the hand-built `ULT-34` goes red. The corrected loss model
does not kill this mutant.

**Fixing the Bernoulli defect changes nothing here.** And there is a proof, not just a sample:

> A refused frame does not advance `expectedSeq`, and arrivals are in sequence order, so every
> refused sequence number still lies inside the **next** reported gap. Therefore
> `missing.length ≥ pendingCorruptFrames`, always, at every burst length and every loss rate.
> `pending > missing.length` is **unreachable in an in-order channel**.

Consecutive corruption is neither necessary nor sufficient. What actually reaches the bound is the
**desync branch**: a gap wider than `MAX_NACK_GAP` (= 64) is reported locally and never runs the
attribution block, so `pendingCorruptFrames` **survives the wide gap** and the next narrow gap
satisfies the condition. That needs a loss burst > 64 packets — and **the sweep's burst grid stops
at 8.**

So the instrument defect that hid `ULT-34` was **the grid, not the model**. Two things follow, and
both are filed rather than fixed here:

- **`ULT-34`'s bound is now instrument-reachable**, via the burst-length axis — including at a
  realistic overall loss rate on the heavy-tailed channel, with no artificial `L = 100`. `UCH-24`
  is the standing measurement.
- **A production observation for `udp-lossy-transport.ts`:** `pendingCorruptFrames` is not cleared
  on the desync path, so a corruption attribution can leak *across* a desync boundary and be spent
  against an unrelated later gap. Filed, not fixed — this pass does not touch transport behaviour.

This is the most valuable thing in the work-item and it is a correction to the brief that
commissioned it. Recorded that way deliberately: a wrong causal story that goes unremarked is how
the next one gets believed.

---

## 6. Register summary

| claim | register |
|---|---|
| `L = 1` forbids consecutive loss; `P(drop\|prev) = 0` | **CHECKED** — measured, 400k packets, + closed form |
| `L = 1` is unattainable for any i.i.d. channel | **CHECKED** — proof, two lines |
| Cliff 20% → 12% under i.i.d. | **CHECKED** — `UCH-22` |
| k≥5 impossible under `L=1`, 4.6× understated at k=4 | **CHECKED** — `UCH-5c` |
| The bias has no fixed sign (XOR-7/8 under-reported 9×) | **CHECKED** — `UCH-23` |
| `pending > missing.length` unreachable in-order | **CHECKED** — proof + `UCH-24` |
| 802.11 GE parameters `p, r, k, h` | **CITED, not page-checked** — Sensors 22 (2022) |
| Lomax `α = 2.0592, λ = 5.688` | **DERIVED** from reported moments, not the paper's fit |
| LoRa / LEO satellite GE fits | **UNRESOLVED** — searched, not found, not invented |
| A 2-state GE is sufficient | **REFUTED by the cited paper** — 4-state HMM filed as follow-up |

## 7. Anchors (Beacon)

- E. N. Gilbert, *Capacity of a Burst-Noise Channel*, BSTJ 39(5), 1960 — CITED, not page-checked.
- E. O. Elliott, *Estimates of Error Rates for Codes on Burst-Noise Channels*, BSTJ 42(5), 1963 —
  CITED, not page-checked. The `k`/`h` generalisation this harness claimed and did not run.
- I. da Silva & J. Pedroso, *Packet Loss Characterization Using Cross Layer Information and HMM
  for Wi-Fi Networks*, Sensors 22(2), 2022 — CITED, not page-checked.
- K. S. Lomax, *Business Failures: Another Example of the Analysis of Failure Data*, JASA 49(268),
  1954 — the Pareto Type II distribution. CITED, not page-checked.
- Salmon, Moraes, Dror & Shaw, *Parallel Random Numbers: As Easy as 1, 2, 3*, SC'11 — the
  counter-based PRNG that makes all of the above O(1)-replayable.
