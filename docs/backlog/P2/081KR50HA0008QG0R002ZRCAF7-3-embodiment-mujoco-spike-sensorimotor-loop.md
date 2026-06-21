---
id: 081KR50HA0008QG0R002ZRCAF7
priority: P2
status: open
title: "081KR50HA0008QG0R002ZRCAF7 — MuJoCo spike: wire Claude API tool-use to sensorimotor loop"
created: 2026-05-09
last_updated: 2026-05-09
parent: 081KQ0YZ80008QG0R001WZ4JE8
depends_on: [081KR50HA0008QG0R0008PPTEK]
classification: blocked
type: feature
effort: M

---

# 081KR50HA0008QG0R002ZRCAF7 — MuJoCo spike: sensorimotor loop via Claude API + tool-use

**Slice of:** [081KQ0YZ80008QG0R001WZ4JE8](081KQ0YZ80008QG0R001WZ4JE8-embodiment-grounding-analysis-isaac-sim-and-other-robotics-sim-platforms-otto-340-counter.md)  
**Depends on:** 081KR50HA0008QG0R0008PPTEK (platform ADR specifies environment and config)

## What

Implement `tools/embodiment/mujoco-spike/` (Bun/TS orchestrator + Python MuJoCo process):

- TS harness that starts a MuJoCo process (cartpole or push-block, per 081KR50HA0008QG0R0008PPTEK ADR).
- Claude API tool-call interface: `observe_state(env_id)` → joint positions + sensor readings,
  `apply_action(env_id, action)` → executes in sim + returns next observation + reward.
- One complete sensorimotor loop: Claude receives observation, reasons, sends action, receives feedback.
- Loop runs for N steps; output logged to `docs/research/081KR50HA0008QG0R002ZRCAF7-spike-run-YYYYMMDD.json`.

Goal: verify the loop works at all — that Claude can receive sensor data, form a plan, execute an action,
and receive physical-consequence feedback. No performance target; correctness-of-loop is the gate.

## Why this is the minimal first code step

081KQ0YZ80008QG0R001WZ4JE8 explicitly notes: "Phase 1: Spike — wire Claude (via Claude API + tool-use) to a MuJoCo cartpole
or simple-manipulation environment. Verify the sensorimotor loop works at all." This is that phase, no
more and no less.

## Acceptance criteria

1. `tools/embodiment/mujoco-spike/` committed (TS harness + Python sim process + README).
2. Running `bun tools/embodiment/mujoco-spike/run.ts` completes 10+ steps without error.
3. Spike run log committed to `docs/research/081KR50HA0008QG0R002ZRCAF7-spike-run-YYYYMMDD.json`.
4. Claude's tool-call trace visible in the log (action taken, observation received, reasoning summary).
5. `dotnet build -c Release`: 0 warnings, 0 errors.
6. Rule 0: orchestrator is TS; Python process is the sim host only (not a bash script).
7. PR body: spike run summary + build result.

## Out of scope

- Pick-and-place (081KR50HA0008QG0R003EN5DDD — separate task).
- Performance optimization.
- Training on sim data (separate architectural decision not in Scope 1).
- Real-robot connection (Scope 2 — separate decision).

## Retractability (Otto-238)

Sim process is kill-able; no persistent state outside `docs/research/` log file; zero real-world
consequences. Fully retractable per Scope 1 framing in 081KQ0YZ80008QG0R001WZ4JE8.
