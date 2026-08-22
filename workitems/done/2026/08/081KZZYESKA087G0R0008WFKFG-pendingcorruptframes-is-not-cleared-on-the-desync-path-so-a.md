---
id: 081KZZYESKA087G0R0008WFKFG
type: bug
state: done
priority: P2
slug: pendingcorruptframes-is-not-cleared-on-the-desync-path-so-a
title: "pendingCorruptFrames is not cleared on the desync path, so a corruption attribution leaks across a desync boundary"
created: 2026-08-14T10:53:02.954Z
completed: 2026-08-15T13:41:04.804Z
depends_on: []
composes_with: []
---

# pendingCorruptFrames is not cleared on the desync path, so a corruption attribution leaks across a desync boundary

Found 2026-08-14 while closing `081KZYY6SVJ087G0R0035SW945`, by asking whether the corrected
chaos instrument can reach `ULT-34`'s bound. **Observation about production transport code,
filed rather than fixed** — that pass was explicitly instrument-only.

**Targets PR #10541 (`fix-transport-integrity-check-crc32c`), which is OPEN, not merged.** If
that PR changes shape, re-check before acting.

## The observation — CHECKED against the branch, not inferred

In `udp-lossy-transport.ts` on that branch:

- a frame failing CRC-32C does `pendingCorruptFrames = Math.min(MAX_NACK_GAP, pending + 1)` and
  does **not** advance `expectedSeq` (~line 1327)
- a gap `> MAX_NACK_GAP` takes the **desync** branch: it reports a local `DesyncEvent` and
  returns without reaching the attribution block, so `pendingCorruptFrames` is **not spent**
- `expectedSeq` advances on **both** paths (`Math.max(this.expectedSeq, header.seq + 1)`)

So pending survives a desync and is spent against the **next narrow gap**, which is a different
region of the sequence space entirely. The NACK then re-labels as `corruption` some sequence
numbers that were never the rejected frames.

Blast radius is bounded and real: it cannot manufacture a loss (the clamp holds), but it can
**mis-attribute** one — and mis-attributed corruption is precisely the signal that tells the
sender **not** to back off. Reachable at ~1,158 events per 200k frames on a mean-burst-100
channel, and at a handful per 200k on the heavy-tailed channel at ~12% overall loss (`UCH-24`).

## Proposed — PROPOSED, not decided

Clear (or explicitly carry, with a stated reason) `pendingCorruptFrames` on the desync path. The
desync branch already argues that beyond the retention window the receiver *cannot evidence*
anything; the same argument applies to a corruption count accumulated before that boundary.

## Resolution (2026-08-15)

Cleared `pendingCorruptFrames` on the desync branch in
`LossyUdpChannel.handleIncoming`. The BDP model matches. ULT-35 is the
falsifier: corrupt frames, then a gap > MAX_NACK_GAP, then a narrow gap
emits only `unknown`. UCH-27's replay now zeros pending on desync and
asserts the clamp stays unreachable.

## Pointers

- `docs/research/2026-08-14-the-chaos-harness-loss-model-was-anti-correlated-not-uniform-*.md` §5
- `UCH-24` in `udp-lossy-transport.chaos.test.ts` — the standing measurement
- `081KZZYETRX087G0R000Q52KAA` — the sweep grid that stops below `MAX_NACK_GAP`
