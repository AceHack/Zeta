---
id: 081KR50HA0008QG0R0008PPTEK
priority: P2
status: open
title: "081KR50HA0008QG0R0008PPTEK — Platform ADR: MuJoCo vs Isaac Sim vs Genesis for embodiment grounding experiment"
created: 2026-05-09
last_updated: 2026-05-09
parent: 081KQ0YZ80008QG0R001WZ4JE8
depends_on: [081KR50HA0008QG0R000C6N7CJ]
classification: blocked
type: research
effort: S

---

# 081KR50HA0008QG0R0008PPTEK — Platform ADR: starting platform selection

**Slice of:** [081KQ0YZ80008QG0R001WZ4JE8](081KQ0YZ80008QG0R001WZ4JE8-embodiment-grounding-analysis-isaac-sim-and-other-robotics-sim-platforms-otto-340-counter.md)  
**Depends on:** 081KR50HA0008QG0R000C6N7CJ (lit review determines whether tool-use or training matters — affects platform constraints)

## What

Produce a formal decision record `docs/DECISIONS/081KR50HA0008QG0R0008PPTEK-embodiment-platform-ADR.md` that:

1. States the decision question: which platform for the Scope 1 (sim-only, retractable) experiment?
2. Re-evaluates the 081KQ0YZ80008QG0R001WZ4JE8 recommendation matrix (MuJoCo for lightweight start; Isaac Sim for perceptual
   richness) against the lit-review's verdict on tool-use-vs-trained-embodiment.
3. Documents the hardware requirements of each candidate (MuJoCo: CPU-OK; Isaac Sim: CUDA+VRAM; Genesis: GPU).
4. States the chosen platform with rationale and the conditions under which the choice would change.
5. Specifies the exact environment (cartpole / push-block / pick-and-place) for 081KR50HA0008QG0R002ZRCAF7 spike.

## Why depends on 081KR50HA0008QG0R000C6N7CJ

If lit review shows tool-use-via-sim cannot challenge Otto-340 (only training-on-sim matters), the platform
selection criteria shift: rich visual fidelity for tool-use planning becomes less important than whether
the platform can serve as a training-data source. Isaac Sim's photorealism becomes more relevant; MuJoCo's
speed becomes more relevant for training loops. The platform ADR must account for which mode is being
targeted.

## Acceptance criteria

1. `docs/DECISIONS/081KR50HA0008QG0R0008PPTEK-embodiment-platform-ADR.md` committed with decision + rationale.
2. Hardware requirements for chosen platform verified (search-first-authority: current docs).
3. Specific environment for spike named (not "TBD").
4. Retractability analysis included (Scope 1: fully retractable, references Otto-238).
5. `dotnet build -c Release`: 0 warnings, 0 errors.
6. PR body: decision one-liner + build result.

## Out of scope

- Actual platform setup / installation (081KR50HA0008QG0R002ZRCAF7 spike does that).
- Multi-platform comparison at runtime (decide one first).
