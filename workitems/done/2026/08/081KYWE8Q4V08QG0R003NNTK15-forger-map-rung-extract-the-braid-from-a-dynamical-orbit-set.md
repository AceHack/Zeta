---
id: 081KYWE8Q4V08QG0R003NNTK15
type: task
state: done
priority: P2
slug: forger-map-rung-extract-the-braid-from-a-dynamical-orbit-set
title: "Forger-map rung — extract the braid from a dynamical orbit set to complete the Thurston bridge"
created: 2026-07-31T15:56:41.499Z
completed: 2026-08-01T00:25:13.143Z
depends_on: []
composes_with: []
---

# Forger-map rung — extract the braid from a dynamical orbit set to complete the Thurston bridge

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KYWE8Q4V08QG0R003NNTK15-*.md` glob. -->

## Context

The deferred SECOND half of the Thurston–Nielsen–Boyland bridge (the first half landed in `src/Core/BraidEntropy.fs`, PR #9788). BraidEntropy computes h ≥ log λ from a braid word; this rung EXTRACTS the braid word FROM a dynamical orbit set (the forger-spiral / AntiSybil dynamics, or any 2-D map via `Orbit.fs`), so `h ≥ log λ` becomes a statement about a SPECIFIC dynamics — and `Orbit.largestLyapunov` (entropy from dynamics) vs `BraidEntropy.growthRate` (entropy the topology forces) become a live cross-check on the same system.
The hard part: defining how the periodic orbits braid + extracting the braid word from a trajectory (a genuine research build). Anchors: Boyland, *Topological methods in surface dynamics*; Thurston–Nielsen.
