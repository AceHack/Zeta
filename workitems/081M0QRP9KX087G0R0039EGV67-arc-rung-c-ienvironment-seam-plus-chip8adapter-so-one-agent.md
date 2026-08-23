---
id: 081M0QRP9KX087G0R0039EGV67
type: task
state: backlog
priority: P2
slug: arc-rung-c-ienvironment-seam-plus-chip8adapter-so-one-agent
title: "ARC rung C - IEnvironment seam plus Chip8Adapter, so one agent drives CHIP-8 and ARC with only a scheme id changed"
created: 2026-08-23T16:54:03.645Z
depends_on: ["081M0QRP3XR087G0R001NCFG83", "081M0QRP9JY087G0R00146V04J"]
composes_with: []
---

# ARC rung C - IEnvironment seam plus Chip8Adapter, so one agent drives CHIP-8 and ARC with only a scheme id changed

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRP9KX087G0R0039EGV67-*.md` glob. -->

**Register: `proposed`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §7.2.

The abstraction test Aaron set: _if adding Atari later means rewriting the ARC bridge, the
abstraction is in the wrong place._ The seam is `IEnvironment` (`reset` / `step` / `frame` / `info`)
plus `ControlScheme`, NOT the ARC REST client — so a third environment costs one adapter and one
scheme and touches no ARC code.

Do: define `IEnvironment`, implement `Chip8Adapter` (in-proc) against the existing `Chip8Cow.step`,
and make `ArcRestAdapter` from rung B satisfy the same interface. Commit the frame type ONCE as
`{ W; H; Palette; Cells }` — CHIP-8 is 64x32x1bit, ARC is 64x64x4bit, Atari is 160x192; committing
to `bool[2048]` forces exactly the rewrite this rung exists to prevent.

**Falsifier:** the same agent code drives `Chip8Adapter` and `ArcRestAdapter` with only a scheme id
changed. If it cannot, the seam is in the wrong place — say so then; do not move it quietly.
