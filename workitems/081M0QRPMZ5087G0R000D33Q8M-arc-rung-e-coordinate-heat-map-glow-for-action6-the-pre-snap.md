---
id: 081M0QRPMZ5087G0R000D33Q8M
type: task
state: backlog
priority: P2
slug: arc-rung-e-coordinate-heat-map-glow-for-action6-the-pre-snap
title: "ARC rung E - coordinate heat-map glow for ACTION6: the pre-snap distribution drawn over the frame, not over a button"
created: 2026-08-23T16:54:15.269Z
depends_on: ["081M0QRP9JY087G0R00146V04J", "081M0QRP9MW087G0R003P83T6D"]
composes_with: []
---

# ARC rung E - coordinate heat-map glow for ACTION6: the pre-snap distribution drawn over the frame, not over a button

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRPMZ5087G0R000D33Q8M-*.md` glob. -->

**Register: `toy`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §8.

Lior's glow-as-predicted-button-press is live today (`btn-right=0.79` against a 0.2 floor, traced
from `BnnSocietyPredictor.predict` through real Student-t EP to `opacity = 0.2 + prob*0.8`). Seven of
ARC's eight actions are atoms and port as-is.

**`ACTION6` is the interesting one:** its probability mass is a distribution over a 64x64 FIELD, not
over a button, so it cannot be one button's brightness. Render it as a **heat-map over the frame** —
same arithmetic (luminance is additive exactly as probability mass is; RGB = unsnapped, CMYK =
snapped), different geometry, and strictly MORE legible: the viewer sees where the agent is about to
click, before it clicks.

**Precondition, measured at `6b3b739d2` rather than inherited from the handoff:** defects 2 (the
snap now ships as `keys` in the `chip8-frame` payload), 3 (all 16 keys now rendered) and the Google
Fonts violation are **fixed**. Defect 1 is **partly** fixed — `Math.random` is gone, replaced by an
LCG at `bnn-key-predictor.ts:29` seeded at a hardcoded `12345`, so runs replay — but the file
imports neither `phase-clock.ts` nor `COMMON_SEED`. Finish that before porting: two independently
seeded deterministic streams still fold to different evidence for two viewers, which is what §13
noninterference is actually about.
