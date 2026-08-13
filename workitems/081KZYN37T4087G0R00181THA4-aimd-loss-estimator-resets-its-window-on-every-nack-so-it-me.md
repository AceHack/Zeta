---
id: 081KZYN37T4087G0R00181THA4
type: bug
state: backlog
priority: P2
slug: aimd-loss-estimator-resets-its-window-on-every-nack-so-it-me
title: "AIMD loss estimator resets its window on every NACK, so it measures 1-per-packets-since-last-NACK and saturates at MAX_GAP above ~1% loss"
created: 2026-08-13T22:50:12.676Z
depends_on: []
composes_with: []
---

# AIMD loss estimator resets its window on every NACK, so it measures 1-per-packets-since-last-NACK and saturates at MAX_GAP above ~1% loss

Found 2026-08-13 by the seeded chaos harness
(`src/Core.TypeScript/discovery/udp-lossy-transport.chaos.ts`), driving the controller with a
Gilbert–Elliott loss process rather than with hand-arranged arithmetic.

## The defect — CHECKED

`src/Core.TypeScript/discovery/udp-lossy-transport.ts`:

- `onNack` calls `updateAimd` **immediately**, and `updateAimd` **resets `sentCount` and
  `nackCount` on every evaluation** (line ~317).
- So the loss estimate is never "NACKs per 64 packets" as `LOSS_WINDOW = 64` and the module
  comment both state. It is **1 NACK per packets-since-the-previous-NACK**.
- Consequence: a single NACK arriving within **19 sends** computes a loss rate above the 5%
  `HIGH_LOSS_THRESHOLD` and doubles the gap. 20 sends is exactly the boundary and does not.
  Both boundaries pinned in `UCH-14`.
- `AimdState.windowStart` is **written at lines 289 and 317 and read nowhere in the repo** —
  the time window the field names does not exist.

## The measured effect — CHECKED

Driven by a 20,000-packet Gilbert–Elliott trace (`UCH-15`):

| true loss | mean burst | gap trajectory |
|---|---|---|
| 0% | — | pinned at `MIN_GAP_MS` = 1ms (correct) |
| 0.5% | 1 | 1–2ms (correct) |
| **1%** | 1 | **478–500ms — already saturated** |
| 2% | 1 | 492–500ms |
| 10% | 4 | 500ms in 9 of 10 samples |

The controller is designed to back off above 5% and speed up below 1%. Measured, it is a
bang-bang switch with its transition between 0.5% and 1% true loss, saturating at
`MAX_GAP_MS` = 500ms — a ~2 packet/second floor — at loss rates **five times below** its own
backoff threshold. There is no fixed point tracking the loss rate.

Also: `lossRate(state)` reads 0.000 immediately after any evaluation, because the window was
just reset. As an exported telemetry value it reports near-zero regardless of channel state.

## Why ULT-8/9/10 do not catch it — CHECKED

They test AIMD *arithmetic* on a pre-arranged whole window: ULT-8 does 30 sends then a single
`onNack(state, 5)`; ULT-9 does 64 sends with zero NACKs; ULT-10 hand-constructs the state
object. None of them interleaves NACKs with sends the way a channel does, which is the only
condition under which the reset is observable.

## Proposed fix — PROPOSED, not implemented here

Accumulate over a genuine window and evaluate at the window boundary, not on arrival:
`onNack` should add to `nackCount` and return; `updateAimd` should fire only when
`sentCount >= LOSS_WINDOW`. Either use `windowStart` for a time-based window or delete the
field. Note this changes live transport behaviour, so it wants its own PR and its own
before/after run of `UCH-15`.

`UCH-14` and `UCH-15` pin CURRENT behaviour and are expected to FAIL when this is fixed —
that is deliberate, and the failure is the signal the fix landed.

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.test.ts` — `UCH-14`, `UCH-15`
- `docs/research/2026-08-13-udp-lossy-transport-burst-loss-cliff-gilbert-elliott-chaos-harness-and-why-foundationdb-dst-does-not-reach-this-fault-class.md`
- Sibling defects from the same run: `081KZYN3B79087G0R0014ZKE3C` (erasure capability),
  `081KZYN3D53087G0R0036XZSYM` (spurious NACKs under reordering — the input that drives *this*
  controller to its floor with no packet loss at all)

---

## ⚠ ORDERING WARNING — this defect is LATENT. Do NOT fix it first. (2026-08-13)

Measured by the bandwidth-delay-product harness (`udp-bdp-link.ts`, PR #10440). Read that research doc
before touching this item.

**`gapMs` is computed and never read.** `LossyUdpChannel.flushBlock` broadcasts all 8 packets of a
block in a tight loop and calls `onSend` after each; it **never consults `gapMs`**. Repo-wide, `gapMs`
is written in `updateAimd` and read only by `updateAimd` itself and two unit-test assertions — by **no
send path anywhere**. **CHECKED**, pinned by `UBL-14`.

So the shipped transport has **no rate control at all**. The AIMD controller is an open-loop estimator
whose output is discarded, and this window bug is therefore **latent**: it produces a wrong number that
nothing acts on.

### Why fixing it first is actively harmful

Wiring the pacing — or repairing the estimator so its output becomes trustworthy enough to wire —
**activates** the erasure-vs-congestion conflation before the signals are separated. Measured cost,
relative to each arm's own clean-channel throughput, with congestion **structurally zero** (asserted,
`UBL-10`):

| corruption | shipped (open-loop) | AIMD paced |
|---|---|---|
| 2% | 0.981 | **0.139** |
| 10% | 0.905 | **0.010** |

**7.1× worse than a corruption-blind sender at 2% loss; 90× worse at 10%** — with no congestion
anywhere. One spurious backoff costs **4016 s ≈ 66.9 minutes** of recovery on a clean link (the
simulator matches an independent closed form to 0.0%).

There is also a hard ceiling that no estimator fix reaches: `MIN_GAP_MS = 1` caps any link at
**1000 pkt/s**, which is a 16.8% utilisation ceiling at C=5000.

### The correct order

1. **`081KZYQ8KNB087G0R000G8QPRE` (P1) — separate the loss signals.** Erasure-loss and congestion-loss
   must be distinguishable before any controller acts on either. RFC 4653 names the class.
2. Then this item (the estimator window).
3. Then `081KZYQ8Q9V087G0R0013XR3ZX` (wire `gapMs`, and the 1000 pkt/s ceiling).

**The control that keeps this honest:** under loss that genuinely *is* congestion, two paced flows reach
**Jain 0.973 at 79% utilisation**. The controller is not broken *as a congestion controller* — it fails
specifically when the loss is not congestion. That is why the fix is signal separation and not threshold
tuning: no threshold distinguishes 5% corruption from 5% congestion when the estimator does not carry
the distinction.
