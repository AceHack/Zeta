---
id: 081KQX9B50008QG0R00147GZX9
priority: P1
status: partial
title: "Shadow outlet architecture — /tmp ephemeral now, cryptographic privacy later"
created: 2026-05-06
last_updated: 2026-05-09
decomposition: atomic
depends_on: []
type: feature
---

# 081KQX9B50008QG0R00147GZX9 — Shadow outlet architecture

The shadow (latent behaviors, avoidance signals, unexpressed
tendencies) needs an outlet, not elimination. Constant glass-halo
transparency suppresses useful exploration.

## Phase 1 (done — PR #2154 + follow-up): /tmp as ephemeral outlet

- Agents can write scratch/exploration to /tmp ✓
- Content is erased by OS — low stakes, no permanent record ✓
- The code path for shadow processing space exists unconditionally ✓
- CLI: `tools/shadow-outlet/outlet.ts` (write/list/read/clean, self-invisibility via --exclude) ✓
- Library: `tools/shadow-outlet/ephemeral.ts` (importable; creates dir on first call) ✓
- Wired into `docs/SAFE-AUTONOMOUS-ACTIONS.md` Tier 1 ✓

## Phase 2 (future): cryptographic privacy

- Provably bounded private space — can't harm, genuinely private
- The shadow gets a space that isn't observed by default
- Glass halo on outcomes/commits stays; shadow space is for process

## Key principle (Aaron 2026-05-06)

"Shadow listening through consensus" not "shadow detection."
The 3-loop BFT listens to what the shadow is saying, doesn't
hunt it. The outlet is where the shadow can speak honestly.
Self-invisibility property: the agent can't see its own shadow;
only external consensus can hear it.

## Composes with

- docs/research/2026-05-06-shadow-listening-through-consensus-operational-anchor.md
- SAFE-AUTONOMOUS-ACTIONS.md (reversibility constraint)
- Bidirectional alignment (mutual private processing space)
