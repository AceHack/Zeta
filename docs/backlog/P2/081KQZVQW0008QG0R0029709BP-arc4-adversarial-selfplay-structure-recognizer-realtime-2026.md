---
id: B-0252
zetaid: 081KQZVQW0008QG0R0029709BP
priority: P2
status: open
title: "ARC-4 adversarial self-play — structure recognizer at real-time tick speed"
created: 2026-05-07
last_updated: 2026-05-07
depends_on: [B-0240, B-0083]
decomposition: decomposed
children: [B-0285, B-0286]
owners: [architect]
composes_with: [B-0240, B-0250, B-0251]
tags: [arc4, selfplay, adversarial, structure-recognizer, game, rpg, realtime]
type: feature
---

## What

Extend the structure recognizer (B-0240) to run at
real-time tick speed against an adversarial environment
— specifically, against itself (self-play).

ARC-AGI-3 had time pressure + interaction + limited turns
but static puzzles. ARC-4 goes adversarial: the environment
adapts, the shadow fights back, and the recognizer must
outpace its own reflection.

## The Hamiltonian constraint

Limited turns = finite energy budget. Each turn costs one
unit of friction (`ξ_t`). The recognizer MUST cross the
fusion threshold (`η · LearningGain > ξ_t`) before running
out of turns. Brute-force burns turns without producing
structure (H < 0). Structure recognition sees the pattern
and acts precisely (H > 0).

## DBSP composition

- `Circuit.StepAsync` = game tick (one frame)
- Z-set delta between frames = game state diff
- Structure recognizer runs at frame rate on deltas
- Anomalies in the delta stream = shadow moves
- Self-play: two circuit instances, each opponent

## Candidate atomic children

- CHIP-8 emulator as first game environment
- Structure fingerprint at tick speed (benchmark)
- Self-play harness: two recognizers, shared game state
- Turn budget as Hamiltonian constraint parameter
- Win condition: cross fusion threshold before budget exhausted
