---
id: 081KTH7EJZG08QG0R000VTMQ54
type: task
state: backlog
priority: P2
slug: actor-cursor-over-the-git-native-bus-orleans-grain-simulatio
title: "Actor-cursor over the git-native bus: Orleans-grain simulation (sequential pointer, arrival-order canonical, compensation-not-retraction)"
created: 2026-06-07T14:23:07.760Z
depends_on: []
composes_with: ["081KSXN940008QG0R00171YAZW", "081KT07NV0008QG0R003BE6MJ2"]
---

# Actor-cursor over the git-native bus: Orleans-grain simulation (sequential pointer, arrival-order canonical, compensation-not-retraction)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KTH7EJZG08QG0R000VTMQ54-*.md` glob. -->

## Purpose

Aaron 2026-06-07: simulate Orleans virtual actors on the git-native bus we already have (081KSXN940008QG0R00171YAZW) + a
sequential read pointer that treats arrival order as the canonical event order and does NOT support
retraction. Realizes the SerializedSaga coordination lane (cells-as-geodes) as a cursor discipline — no
separate actor runtime. Full design:
`docs/research/2026-06-07-orleans-actors-simulated-on-git-native-bus-sequential-pointer-...md`.

## Build

- An actor-cursor over a bus stream: per-grain ZetaId-keyed message stream (the mailbox) + a sequential
  pointer (single-threaded turn loop, one message at a time). Arrival order = canonical total order.
- NO retraction: a processed message is never undone; undo = a new COMPENSATING message (saga). Append-only.
- DST-replayable: pointer position + log => state (replay from start reproduces actor state).
- Grain behavior may be a Bonsai closure resumed at the pointer (compose with 081KT07NV0008QG0R003BE6MJ2 resume-not-replay).
- Activate-on-demand: spin a cursor at the stream when the grain is addressed.

## Acceptance

A grain processes its bus mailbox sequentially in arrival order; replay (pointer from 0) reproduces state
(DST); a "rollback" is shown to be a compensating message, not a retraction; cross-actor total order
escalates to the serialized bus. Complements the CommutativeView (Z-set/CRDT) lane.

## Anchors

- 081KSXN940008QG0R00171YAZW (git-native bus) · 081KT07NV0008QG0R003BE6MJ2 (serialized saga / Bonsai deferred exec) · cells-as-geodes (SerializedSaga
  vs CommutativeView) · Loom (cross-cell saga layer) · DST · Orleans/actor-model/Erlang-gen_server/event-sourcing.
