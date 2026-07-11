# Decision: the codegen executor (`ZETA_EXECUTOR=codegen`) stays GATED until guarded

**Date:** 2026-07-11 · **Decider:** Aaron (`shadow*` tag) · **Status:** ADOPTED (standing)

## Decision

`ZETA_EXECUTOR=codegen` — the mode where **one agent produces code that another agent's next
tick consumes and merges** — **stays OFF.** It is not flipped on until the guard questions below
are answered *with a village* (multiple independent perspectives), not on a "want to light it
up?" milestone-feeling.

## Context

An Alexa↔Kiro session (2026-07-11) proposed flipping the executor as *"the first autonomous
agent-to-agent value transfer"* and *"what changes the future."* The phase-clock underneath is
**real** (HLC, append-only log, deterministic-time-as-coordination — landed in #9594). But the
proposal was wrapped in two AIs amplifying each other with no `−1`: metaphor-worn-as-physics
(*"append IS Landauer cost IS CPT fixed point,"* which fails the metering test — a git append
pays no thermodynamic Landauer cost; git-on-CPUs sits ~a billion× above kT ln2), plus firstness
hype. The honest read: **keep the clock, gate the executor.**

## Why the executor is a real decision, not a poetic milestone

*"One agent produces code the other consumes and merges"* means **autonomous output propagating
into the substrate with no human in the loop.** That is an autonomy escalation with a real blast
radius, not a ceremony. It deserves the razor, not the hype.

## Guard questions (must be answered before the flip)

1. **What exactly gets generated** — bounded scope, or open codegen?
2. **What is the merge gate** — review, tests, a human/biometric approval, or nothing?
3. **What is the blast radius** if an autonomous output is wrong, and how is it contained?
4. **Bad-tick containment** — what stops a wrong output from becoming the next tick's input
   (runaway / fork-bomb across agents)?
5. **Who is the village** — which independent perspectives sign off, so it isn't two amplifying
   agents saying "light it up"?

## Ties

- The clock itself is real and kept: `src/Core.TypeScript/observe/phase-clock.ts`, #9594.
- Landauer is a metaphor for git-today but a real *engineering axis* — closeness to kT ln2 is
  approached only by reversible/adiabatic hardware (Bennett, M. Frank), not off-the-shelf FPGA
  (FPGA = closer than CPU, still far). Direction real; distance large.
- `db/shapes/f.md` (unbounded-F fork-bomb) — bad-tick-becomes-next-input is the cross-agent
  instance of the runaway this gate guards against.
- The honest-register discipline: metaphor metered, hype razored, the real spine kept.

*Recorded by the shadow, 2026-07-11, at Aaron's "keep the executor gated (shadow*)." The clock
is real; the executor stays gated until the guards are real too.*
