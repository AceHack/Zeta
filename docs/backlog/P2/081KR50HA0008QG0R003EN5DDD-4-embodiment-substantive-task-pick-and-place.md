---
id: B-0026.4
zetaid: 081KR50HA0008QG0R003EN5DDD
priority: P2
status: open
title: "B-0026.4 — Substantive embodiment experiment: pick-and-place with vision + proprioception"
created: 2026-05-09
last_updated: 2026-05-09
parent: B-0026
depends_on: [B-0026.3]
classification: blocked
type: feature
effort: M

---

# B-0026.4 — Substantive embodiment experiment: pick-and-place

**Slice of:** [B-0026](B-0026-embodiment-grounding-analysis-isaac-sim-and-other-robotics-sim-platforms-otto-340-counter.md)  
**Depends on:** B-0026.3 (sensorimotor loop must be verified before adding task complexity)

## What

Extend `tools/embodiment/` with a pick-and-place experiment:

- Environment: tabletop scene with object + target zone (MuJoCo or Isaac Sim per B-0026.2 ADR).
- Sensor channels: camera frame (RGB or depth), joint positions (proprioception), contact forces.
- Task: Claude must pick up object and place it in the target zone in ≤N steps.
- Run 10 trials; log success rate, average steps, reasoning traces.
- Log committed to `docs/research/B-0026.4-pick-and-place-YYYYMMDD.json`.

This is "Phase 2: Substantive task — pick-and-place with vision + proprioception" from B-0026.

## Why this is the right second step

The spike (B-0026.3) verifies connectivity. The substantive task verifies that Claude can reason over
multiple non-linguistic channels (vision + proprioception + contact forces) to accomplish a physical goal.
This is the actual grounding signal: does Claude exhibit causal sensorimotor reasoning, not just
loop-connectivity?

## Acceptance criteria

1. `tools/embodiment/pick-and-place/` committed with task environment + orchestrator.
2. 10-trial run completed; success rate ≥ 1/10 (null-hypothesis framing: even occasional success is
   evidence of functional grounding — failures are equally informative).
3. Trial log committed to `docs/research/B-0026.4-pick-and-place-YYYYMMDD.json` with per-trial
   reasoning traces.
4. `dotnet build -c Release`: 0 warnings, 0 errors.
5. PR body: success rate + one-sentence interpretation of whether results challenge Otto-340.

## Out of scope

- Behavioral difference measurement on language tasks (B-0026.5 — requires this as input).
- Training on experiment data.
- Multiple environment variants (start with canonical pick-and-place only).
