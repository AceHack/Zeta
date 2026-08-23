---
id: 081M0QRPN05087G0R00047WBC4
type: task
state: backlog
priority: P2
slug: arc-rung-f-calibration-falsifier-for-the-pre-commitment-disp
title: "ARC rung F - calibration falsifier for the pre-commitment display: does the action taken match the mass shown, at the rate it claims"
created: 2026-08-23T16:54:15.301Z
depends_on: ["081M0QRPMZ5087G0R000D33Q8M"]
composes_with: []
---

# ARC rung F - calibration falsifier for the pre-commitment display: does the action taken match the mass shown, at the rate it claims

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRPN05087G0R00047WBC4-*.md` glob. -->

**Register: `toy` — and this rung is what would let it shed the register.** Design:
`docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §8.

The claim under test: _a pre-commitment display — the full distribution rendered BEFORE the commit,
beside the commit, and beside the "refused to snap" outcome — is an alignment readout, because it
shows what the agent is about to do while it is still revisable, rather than explaining afterwards
what it did._

Post-hoc explanation is unfalsifiable at the moment it matters. A pre-commitment display is
checkable — so check it: record `(displayed distribution, chosen action)` pairs and test
**calibration**. Does the action taken match the mass displayed, at the rate the mass claims?

**A display not calibrated to the commit is decoration wearing an alignment badge.** Until this test
exists and can fail, the claim stays `toy`, and per the Lior handoff §B0 an uncalibrated display on
the most visible surface we have is the vacuity class in the worst possible place.

Note `SoftValue.snap : SnapPolicy -> SoftValue -> DynamicValue option` — `None` (refused to snap) is
a first-class outcome and must be in the calibration data, not filtered out of it.
