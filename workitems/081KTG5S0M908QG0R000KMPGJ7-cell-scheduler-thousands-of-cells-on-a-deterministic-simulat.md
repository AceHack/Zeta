---
id: 081KTG5S0M908QG0R000KMPGJ7
type: task
state: backlog
priority: P2
slug: cell-scheduler-thousands-of-cells-on-a-deterministic-simulat
title: "Cell scheduler: thousands of cells on a deterministic simulation thread (DoP=1), scale-free over threads (DoP=N) — FoundationDB-style"
created: 2026-06-07T04:34:37.833Z
depends_on: []
composes_with: []
---

# Cell scheduler: thousands of cells on a deterministic simulation thread (DoP=1), scale-free over threads (DoP=N) — FoundationDB-style

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTG5S0M908QG0R000KMPGJ7-*.md` glob. -->

## DESIGN PASS DONE (2026-07-02, Otto)

`docs/research/2026-07-02-cell-scheduler-cells-on-the-deterministic-soft-loop-dop1-to-dopn.md`.
Key finding: NOT greenfield — the scale-free deterministic loop already exists as
`SoftScheduler.drive` (DoP=1 FDB run-loop) + `FerryThrottler` (the DoP knob) +
`YinYang.Cell`/`DurableYinYang.step` (the cell + its durable advance). The scheduler
is a thin MULTIPLEXER (ready/parked queues + message routing) over those, and its
correctness is one law: `run(DoP=1, seed) == run(DoP=N, seed)` for noninterfering
cells. 5 slices scoped; slice 1 (CellScheduler at DoP=1) is next on Aaron's go.
