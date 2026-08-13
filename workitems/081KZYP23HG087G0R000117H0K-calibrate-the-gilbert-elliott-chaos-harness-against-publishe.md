---
id: 081KZYP23HG087G0R000117H0K
type: task
state: backlog
priority: P2
slug: calibrate-the-gilbert-elliott-chaos-harness-against-publishe
title: "Calibrate the Gilbert-Elliott chaos harness against published loss-trace fits: free k and h, sweep the measured 802.11 parameters, and add a heavy-tailed burst option"
created: 2026-08-13T23:07:04.112Z
depends_on: []
composes_with: []
---

# Calibrate the Gilbert-Elliott chaos harness against published loss-trace fits: free k and h, sweep the measured 802.11 parameters, and add a heavy-tailed burst option

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KZYP23HG087G0R000117H0K-*.md` glob. -->

Filed 2026-08-13 by Mateo (security-researcher) from the research sweep over PR #10417.

## The finding: the GE parameters are INVENTED, so every cliff number in #10417 is RELATIVE

This does not diminish PR #10417's result. It bounds it. The harness is a correct and
well-built *comparator*; it is not yet an *instrument*.

`burstParams(overallLossRate, meanBurstLength)` is a clean reparameterisation, but it:

1. **Fixes two of the four GE parameters by fiat.** `lossInGood = 0, lossInBad = 1` is hardcoded.
   In GE terms that is `k = 1, h = 0` — the **Gilbert** channel with a total outage in the bad
   state, not Gilbert-Elliott with `k` and `h` free. The harness's own docstring is candid
   ("Usually 0 … Usually 1"), and `GilbertElliottParams` does expose both fields — but every
   call site goes through `burstParams`, so no test ever varies them.
2. **Takes the remaining two from round numbers.** The swept values are
   `[0.005, 0.01, 0.02, 0.03, 0.05, 0.08, 0.12, 0.2, 0.3]` loss and `[1, 2, 4, 8]` mean burst.
   No measurement trace, no fit, no citation to a fit appears anywhere in the harness, the test
   file, or the research doc. "5% mean loss, mean burst 8" is a *choice*, not an observation.

So the numbers in #10417 are valid as **decoder-vs-decoder comparisons on a common channel**
(56/56 vs 0/56 is a property of the code and is parameter-independent; the XOR-7/8 goodput
dominance is measured on an identical drop trace and is sound). They are **not** claims about
802.11 mesh, LoRa, or satellite links. "The transport holds 99% delivery to ~2% loss" needs
"...under this synthetic channel" attached until this item lands.

## Real calibration anchors found

**802.11 (CHECKED — read the paper's numbers):** da Silva & Pedroso, *Packet Loss
Characterization Using Cross Layer Information and HMM for Wi-Fi Networks*, Sensors 22, 2022
(PMC9696961). 410 hours of indoor 802.11 UDP traces. Their fitted **Gilbert-Elliott** parameters
are `p = 0.0393`, `q(=r) = 0.1862`. Their measured per-state loss probabilities are **60.97% in
the bad state and 0.55% in the good state** — i.e. `h = 0.39`, `k = 0.9945`, **not** the
harness's `h = 0, k = 1`. Burst lengths: mean **5.37** packets, **max 8,853**, sd 31.68, fitted
with a **Pareto Type II** tail; the paper concludes the 2-state GE model "cannot capture the
behavior of the real system" and uses a 4-state HMM instead.

Three concrete consequences for the harness:

- `1/r = 1/0.1862 = 5.37` — the harness's mean-burst-8 sweep point is in the right neighbourhood
  and its mean-burst-1 point is not a real operating point at all.
- **`lossInBad = 1` is the wrong shape and it is the shape that matters most here.** A bad state
  that drops ~61% of packets leaves roughly 3 of 8 gone per block — sitting exactly on the
  [8,4,4] boundary — whereas `lossInBad = 1` makes bad-state bursts total. The harness is
  currently testing a strictly harsher and *differently-shaped* channel than the measured one.
- **Geometric burst lengths under-model the tail.** GE burst length is geometric by construction;
  the measured distribution is Pareto-tailed with a max three orders of magnitude above the mean.
  A block code's failure probability is dominated by that tail.

**LoRa and satellite/deep-space: UNRESOLVED — say so rather than fill the gap.** Searches
surfaced the right literature (Ferre, *Collision and Packet Loss Analysis in a LoRaWAN Network*,
EUSIPCO 2017; the LoRa multi-floor measurement study arXiv:1909.03900; T. Wang et al., *Packet
Loss Modeling and Forward Erasure Correction for LEO Satellite Networks*, IEEE Trans. Comm. 2026,
which states outright that "existing packet loss models fail to capture the unique dynamics of
LEO networks"; the CCSDS erasure-coding line) but **I did not obtain fitted numeric GE parameters
for either regime** — the LEO paper is paywalled and the LoRa studies report PDR/RSSI rather than
a two-state fit. This item should not pretend otherwise; acquiring those fits is part of the
work, not a precondition already met.

## Proposed

1. Add `gilbertParams(p, r, k, h)` alongside `burstParams`, and a named
   `CALIBRATION.wifi2022 = { p: 0.0393, r: 0.1862, lossInGood: 0.0055, lossInBad: 0.6097 }`
   carrying its citation in the code.
2. Re-run the #10417 sweep at that point and report the cliff there **as well as** on the
   synthetic grid. Expect the shipped decoder to look *better* (bad state is not a total outage)
   and the burst tail to look *worse*.
3. Add a heavy-tailed burst option (Pareto Type II) so the tail the block code actually fails on
   is representable.
4. Label the existing sweep numbers "synthetic channel, uncalibrated" in the research doc until 2
   lands. **This is the cheapest and most important step and needs no code.**
5. Open a follow-up to obtain LoRa and LEO fits; leave the regimes explicitly UNRESOLVED until
   then rather than extrapolating from the Wi-Fi fit.

**Cost, named honestly:** four free parameters make the sweep 4-dimensional, and a full grid is
not affordable. Pick 3-5 *named, cited* operating points instead of sweeping k and h — a
calibrated point beats a large uncalibrated grid, which is the whole lesson of this item.
