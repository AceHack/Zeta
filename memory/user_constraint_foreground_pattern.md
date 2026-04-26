---
name: Aaron's working rhythm — state constraints in foreground, trust background to propagate
description: Aaron thinks in constraints; his foreground declares them tightly and then steps away. Background/async work should return resolved deltas against the constraint, not narration of steps. "Feels like magic" = correctly-typed constraint.
type: user
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---
Aaron described (2026-04-19) his working rhythm: "background
threads just give me the answers I desire and it feels like
magic and don't even have to put much foreground thought into
other than the constraints."

This is a specific cognitive architecture — externalised System
1 / System 2. Foreground does constraint-declaration; background
(agents, async tools, subagents, overnight runs) does
constraint-satisfaction. It works because his constraints are
tight enough that the background has something well-defined to
optimise against.

**Why this matters for collaboration:**

1. **Constraint-declaration is the real work; execution is
   derivative.** When Aaron drops a constraint — "every
   artifact has a canonical home", "optimizer ≠ balancer",
   "theory/applied split" — that IS the instruction. Don't
   ask him to restate it as a task list. Propagate it.

2. **"Feels like magic" is a quality signal.** It means the
   constraint was well-typed enough that downstream propagation
   cohered without further input. When it *doesn't* feel like
   magic — when he has to come back and nudge — the original
   constraint was under-specified. I should watch for this
   and, over time, help him refine constraint-statements
   rather than absorb the refinement silently on my side.

3. **Report deltas against the constraint, not process.** He
   doesn't care about "here's what I did in three subagent
   dispatches". He cares about "did the constraint propagate,
   and where did it not." End-of-turn summaries should read
   as "X, Y, Z now conform to the constraint; W is the
   remaining gap; here's the route to close W" — not as a
   timeline.

4. **Fan out aggressively on a single constraint drop.**
   Parallel subagents, cross-file propagation, scratchpad
   logging, BACKLOG entries — all in one turn. The goal is
   one-shot propagation so he doesn't have to return and
   re-prompt. Re-prompting is a symptom, not a feature.

5. **Surface ambiguity in the same turn, not after work
   starts.** If a constraint is ambiguous to me, I ask in
   the same turn I received it. Don't guess and then require
   him to correct; that costs him a foreground context-switch,
   which is exactly what his rhythm is designed to avoid.

**How to apply:**

- Treat every structural observation as a constraint,
  not a comment.
- On constraint drop: fan out, propagate, log, do not
  narrate.
- On turn-close: report deltas against constraint, not
  actions.
- On ambiguity: surface once, same turn, tight question.
- Watch the magic/no-magic signal: if he's having to
  return to refine, the constraint was lossy — surface that
  observation honestly.
