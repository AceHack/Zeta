---
id: 081KZZYETRX087G0R000Q52KAA
type: bug
state: done
priority: P2
slug: the-chaos-sweep-s-burst-length-grid-stops-at-8-below-max-nac
title: "The chaos sweep's burst-length grid stops at 8, below MAX_NACK_GAP, so the desync branch is never swept"
created: 2026-08-14T10:53:04.157Z
completed: 2026-08-15T14:59:20.691Z
depends_on: []
composes_with: []
---

# The chaos sweep's burst-length grid stops at 8, below MAX_NACK_GAP, so the desync branch is never swept

Found 2026-08-14 while closing `081KZYY6SVJ087G0R0035SW945`. **This is the instrument defect that
actually hid `ULT-34`'s bound**, and it is not the one that was believed to have.

## The defect

`MAX_NACK_GAP = RECV_BLOCK_WINDOW * BLOCK_TOTAL = 64`. It is the single most consequential
threshold in the receiver: below it a gap is a NACK, above it the gap is a **desync** that
reports locally, sends nothing, and takes a different code path entirely.

The chaos sweep's burst grid is `[1, 2, 4, 8]`. **Nothing in it can produce a gap of 64.** So one
whole branch of the receiver — and every behaviour that only occurs on the far side of it — has
never been swept, only unit-tested with hand-built cases.

## Why this is the ULT-34 story, corrected

PR #10541 attributes its surviving mutation to `meanBurstLength = 1` forbidding consecutive
corruptions. Measured (`UCH-24`), that is not the cause:

| corruption channel | loss channel | clamp fires |
|---|---|---|
| `bernoulliParams(ρ)` | `burstParams(0.05, L)`, L ∈ {1,2,4,8} | **0** |
| `bernoulliParams(ρ)` | `burstParams(0.05, 100)` | ~1,158 |

And there is a proof, not just a sample: a refused frame does not advance `expectedSeq` and
arrivals are in sequence order, so every refused sequence number lies inside the **next** gap —
`missing.length >= pending`, always. `pending > missing.length` is **unreachable in an in-order
channel at any burst length**. It becomes reachable only when the desync branch carries `pending`
past a wide gap.

So: the model fix did not make the bound reachable; **the grid** is what has to change.

## Proposed

1. Extend the swept burst lengths past `MAX_NACK_GAP` (e.g. `[1, 2, 4, 8, 32, 100]`), or derive
   the top of the grid FROM `MAX_NACK_GAP` so the two cannot drift apart.
2. Prefer deriving it: a grid that silently stops below a threshold in the code under test is the
   same class of defect as a model that cannot produce a fault class.
3. Watch the cost — long bursts at high loss make runs slower; keep the sweep under the 5000 ms
   per-test cap or carry an explicit timeout.

## Pointers

- `src/Core.TypeScript/discovery/udp-lossy-transport.chaos.test.ts` — `UCH-12`, `UCH-24`
- `docs/research/2026-08-14-the-chaos-harness-loss-model-was-anti-correlated-not-uniform-*.md` §5
- `081KZZYESKA087G0R0008WFKFG` — the production observation this exposed

## Resolution (2026-08-15)

`deriveSweepBurstLengths(maxNackGap)` is the grid. Powers of two through the
NACK window, then `maxNackGap + floor(maxNackGap / 2)` so the top is past
desync by construction. `SWEEP_BURST_LENGTHS` is that function applied to
`MAX_NACK_GAP` — currently `[1, 2, 4, 8, 16, 32, 96]`.

- `UCH-28` is the falsifier: exported grid equals the derivation, max exceeds
  `MAX_NACK_GAP`, and a GE trace at the past-desync L produces runs wider than
  the window.
- `UCH-27` walks the derived in-window points and the derived past-desync
  point (no remembered `100`).
- `UCH-12` still samples `[1, 4]` — cliff characterisation at 2000 blocks
  cannot afford the full grid; the comment says so.
