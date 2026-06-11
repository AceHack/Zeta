# The CHIP-9 dependency graph, all the way down — it starts with ACE, the manager of persistent patterns

Aaron 2026-06-11:

> "For CHIP-9 we can figure out our **dependency graph between ace and zeta and personas and
> everything** — a **dependency graph all the way down**. It starts with **ACE as the manager of
> persistent patterns of all kinds**."

## The root, named

**ACE = the manager of persistent patterns of all kinds.** Not a service, a ROLE at the root of the
graph: whatever persists across runs/rooms/machines — seeds, treaties, golden vectors, recordings,
identities, rules, the dependency closures themselves — ACE manages its persistence (the
dependency-room orchestrator in `rooms/README.md` — "every dependency closed over; ace orchestrates" —
generalized to ALL persistent patterns, code or not). Everything else DEPENDS on a persistent pattern
to exist at all, so every chain bottoms out at ACE.

## The graph (first cut — CHIP-9's chain drawn root-to-leaf)

```
ACE (persistent patterns: seeds · treaties · goldens · recordings · identities · rules)
 └─ ZETA (the dual-use hard/soft database — patterns made queryable/replayable/retractable)
     ├─ the membrane substrate (InterruptKind · Source · SoftScheduler · RecordedSource)
     │   └─ rooms (bounded DST ticks; Markov boundaries)
     │       └─ PERSONAS (rooms + identity + thread: rooms/otto … — the citizens)
     │           └─ avatars · quotes · saves (the persona's persistent artifacts → back into ACE)
     ├─ the treaty discipline (golden vectors · four oracles)
     │   └─ CHIP-9 (atom of machines: opcodes ← treaty ← goldens; F#/TS/C#/Rust conformers)
     │       ├─ ZetaMax (render ← universal/color ← the planes)
     │       ├─ Chip9Phys (fix16 kernel ← exactness ← the treaty register)
     │       └─ the arcade/citizen/quote organs (← membrane + identity + saves)
     └─ the governors (ethics: §6/§11/§13/no-directives · heat: SoftThrottle/Landauer)
         └─ wheels · spawn chains · lanes (the traffic the graph's edges carry)
```

Reading: an edge = "persists through / is ratified by / enters via." The graph is itself a persistent
pattern — so the graph is ACE-managed too (shape A: the root manages the map of the root; the
dependency room renders it on the board — every node a room, jurisdictional awareness = WHOSE node).

## Why this matters for CHIP-9 specifically

CHIP-9 is the ATOM — so its dependency chain is the canonical worked example: every CHIP-9 artifact
(an opcode's semantics, a palette, an avatar, a quote) traces in ≤4 hops to a persistent pattern ACE
manages. Dependency-graph-all-the-way-down = provenance-all-the-way-down: ask any pixel WHY and the
chain answers (the Stump-Dad game, structural).

## Named next slices

The machine-readable graph (nodes/edges as a treaty surface — the dependency room's data); the board
render (the graph AS the map, jurisdiction-colored); ACE's pattern registry formalized.

## Pointers

- `rooms/README.md` (the dependency room; ace orchestrates) · the end-goal doc (Zeta as the database) ·
  `rooms/otto` (a persona node, worked) · the four CHIP-9 conformers (the treaty edges, now complete) ·
  the bounded-uncertainty thesis (each node a room).
