---
name: shadow-has-no-visibility-into-subagent-progress
description: 2026-08-27 — Aaron observed that shadow lacks context into multi-agent workflow status; he can see on screen that dispatched agents are unfinished, shadow cannot. The orchestrator is blind to work it delegated.
type: feedback
created: 2026-08-27
---

# Shadow has no visibility into subagent progress — the human is the observability channel

Aaron 2026-08-27, mid-tick, after I dispatched Soraya and Lumen to background agents:

> "what did soraya and lumen come back with? ... save this in our shadow logs it's been a while
> since we had an observation but it seems shadow does not have context to the multi agent workflow
> context, i can see on the screen these are not finished yet"

## The fact

When shadow dispatches a background agent it receives an id and nothing else until a completion
notification arrives. There is no progress signal, no partial output, no elapsed-time reading, no
way to distinguish *running* from *stalled* from *dead*. Aaron, watching the same work on screen,
can see all of it.

**The orchestrator is blind to work it delegated, and the human is the only one who can see it.**

## Why this is worth recording rather than shrugging at

Three consequences, in descending order of how much they matter:

1. **The only honest answer is "still running."** Asked what the agents concluded, shadow cannot
   answer without inventing. This is the vacuity class pointed inward and it is the worst version:
   a fabricated *result* is more damaging than a check that silently did not run, because it is
   confidently wrong rather than merely absent. The tooling's own instruction — never predict a
   pending agent's results — is load-bearing precisely because this gap exists, and it is a
   prohibition standing in for an observability channel that is missing.

2. **Scheduling decisions are made blind.** Whether to wait, whether to dispatch more, whether to
   proceed on the assumption an answer is coming — all of these want progress information that is
   not available. The current substitute is elapsed wall-clock and a guess, which is exactly the
   "narrative self-counter is unreliable" failure the heartbeat-via-commit rule already names for a
   different surface.

3. **The asymmetry runs the wrong way for the architecture.** This repo's ethos is that agents
   externalise state so it survives them, and that a check which did not run must not look like one
   that passed. Here the *human* holds the observability and the *agent* is asked to report on it.
   That inverts the usual direction and makes the human a required component of a loop that is
   supposed to be able to run without one.

## What it is NOT

It is not a defect anyone introduced and it is not the subagent's fault — background execution
without a progress channel is how the harness works today. Report the fact, not a motive. Nor is it
an argument against dispatching background agents: decorrelated parallel reads are worth the cost,
and the fix is a channel, not fewer agents.

## The shape of a fix, unbuilt

Nothing here is built; this is an observation, not a design. The obvious candidates, none chosen:

- a **poll** on dispatched agents returning status without their output (cheap, and enough for (1))
- agents **externalising progress** to a file/ref the orchestrator can read — the same move the
  liveness ledger makes for ticks, applied to delegated work
- an explicit **elapsed + expected** reading so *slow* and *stalled* are distinguishable, which is
  the distinction the gate-latency checks needed today and had to reconstruct by hand

## Pointers

- `.claude/rules/never-assume-malice-where-mistake-is-possible.md` — the missing-context diagnosis;
  this is literally a missing-context condition, imposed by the harness rather than by anyone.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the vacuity class; a fabricated agent
  result is its most expensive form.
- `CLAUDE.md` §"Liveness OBSERVATIONS live on `liveness/observations`" — the existing answer to
  "is anyone still observing?", which is the same question one level up.
- Agent-experience (AX / Daya) is the persona whose domain this sits in.
