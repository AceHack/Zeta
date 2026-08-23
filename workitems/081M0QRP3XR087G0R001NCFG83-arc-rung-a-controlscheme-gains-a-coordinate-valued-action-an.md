---
id: 081M0QRP3XR087G0R001NCFG83
type: task
state: backlog
priority: P2
slug: arc-rung-a-controlscheme-gains-a-coordinate-valued-action-an
title: "ARC rung A - ControlScheme gains a coordinate-valued action and arcAgi3/atari2600 schemes; the non-embedding is recorded, not papered over"
created: 2026-08-23T16:53:57.816Z
depends_on: []
composes_with: []
---

# ARC rung A - ControlScheme gains a coordinate-valued action and arcAgi3/atari2600 schemes; the non-embedding is recorded, not papered over

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QRP3XR087G0R001NCFG83-*.md` glob. -->

**Register: `proposed`.** Design: `docs/design/2026-08-23-arc-agi-3-integration-design-chip8-chip9-atari-and-the-arena.md` §2.

`src/Core/ActionGrammar.fs` is a 16-bit held-key set over a 4x4 grid; ARC-AGI-3's action space is
`RESET` + `ACTION1..ACTION7` where **`ACTION6` carries `{x,y}` over a 64x64 field** (4096 points).
A 16-cell alphabet does not contain it, and forcing it in would be a false universal.

Do: add exactly one case to `ControlScheme.Action` — `| Point of x: int * y: int` — and register
`arcAgi3` and `atari2600` schemes beside `chip9Pad` / `keyboardWasd` / `gamepadStandard`. Atari's
18-action ALE set embeds cleanly with no new constructor; ARC does not, and that asymmetry is the
result, not a defect.

**Falsifier (this is the point of the rung, not a nicety):** `translate` must return `None` for every
ARC input the grammar cannot hold, and a test must assert a `Point` never round-trips through a
16-cell `GridBinding` without loss. A grammar that accepts everything is the vacuity class.

No Python, no network, no dependency on any other rung. Cheapest real start.
