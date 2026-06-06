---
id: B-0285
zetaid: 081KR2E4K0008QG0R0037MW8ET
priority: P2
status: closed
closed: 2026-05-08
closed_by: "Arena.fs landed — PR #2014"
title: "ARC-4 — adversarial self-play arena design"
created: 2026-05-08
parent: B-0252
depends_on: []
classification: buildable-now
decomposition: atomic
---

# B-0285 — Self-play arena design

Design the arena where the structure recognizer plays against
itself. Define: puzzle generation, move semantics, scoring,
turn limits (Hamiltonian constraint).

## Acceptance criteria

- Research doc with arena spec
- F# type definitions for Puzzle, Move, Score
