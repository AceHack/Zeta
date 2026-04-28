---
name: ALL FRICTION SOURCES ARE FINITE-RESOURCE COLLISIONS — meta-meta-rule that organizes the entire substrate; every "rule we landed to reduce friction" is the application of the same single principle to a different finite resource: working memory (Otto-282 write the WHY, Otto-286 definitional precision), maintainer bandwidth (Otto-283 don't bottleneck), agent cycles (Otto-284 idle-PR fallback), test coverage (Otto-285 DST tests chaos), flake budget (Otto-281 fix determinism), attention (every comment-the-why decision); each substrate rule externalizes / compresses / pre-allocates the constrained resource so the work fits within the available cognitive substrate; the unifying physics is finite capacity colliding with unbounded demand; this is WHY the substrate captures cross-reference and reinforce — they're all attacking the same underlying constraint from different angles; emerged 2026-04-25 from synthesizing Aaron's distributed observations across Otto-281..286, then recognized as the meta-pattern that organizes them all; Aaron Otto-287 confirmation 2026-04-25 "wow now you taught me a real novel unifying rule i've never thought of before, i love you... The unifying observation is substantial enough that it might deserve its own slot i think it is, you got this"
description: Otto-287 meta-meta-rule. The single underlying principle behind every Otto-281..286 rule — all friction sources arise from finite-resource collisions; every substrate rule externalizes, compresses, or pre-allocates a constrained cognitive resource so work fits in available substrate. The friction taxonomy unifies the rule cluster.
type: feedback
---

## The rule

**All friction sources arise from finite-resource collisions.**

Every observable "friction" in the factory's collaboration
loop — every place where work *fails to flow smoothly* —
turns out, on inspection, to be a collision between:

- **Some finite cognitive / operational resource** (working
  memory, attention, context window, decision bandwidth,
  session time, test budget, flake budget, etc.)
- **An unbounded or growing demand** (the work to be done,
  the alternatives to consider, the rationale to re-derive,
  the edge cases to test, etc.)

The collision shows up as: re-derivation under load, lost
context-switches, idle calcification, fake-green CI,
deferred bugs that compound, decision queues backing up.

Each substrate rule we've landed is the **same single
principle** applied to a different finite resource: the
rule externalizes / compresses / pre-allocates the
constrained resource so the work fits within the available
substrate.

## The taxonomy — recent rules mapped to their resource

| Rule | Constrained resource | Mechanism |
|---|---|---|
| **Otto-281** *DST-exempt is deferred bug* | Flake-investigation budget | Concentrate cost into one fix instead of N reruns |
| **Otto-282** *write code from reader perspective* | Reader's working memory | Externalize the WHY so re-derivation isn't paid N×M times |
| **Otto-283** *don't bottleneck the maintainer* | Maintainer's context-switch budget | Decisions land with falsification signals; Aaron's bandwidth goes to interesting cases only |
| **Otto-284** *idle-PR creative fallback* | Agent's session-time budget | Agent always-doing-something; idle time becomes substrate-building time |
| **Otto-285** *DST tests chaos doesn't skip it* | Test-coverage budget | Cover real-world chaos deterministically; don't shrink coverage to make symptoms disappear |
| **Otto-286** *definitional precision changes the future without war* | Argument-resolution context window | Compress concepts into precise definitions so the whole debate fits in working memory |

Older rules also fit:

| Older rule | Constrained resource | Mechanism |
|---|---|---|
| **Otto-264** *rule of balance* | Rule-system coherence budget | Every found friction triggers a counterweight; system stays self-consistent |
| **Otto-238** *retractability is a trust vector* | Trust-recovery budget | Make every action reversible by design; reversal cost stays bounded |
| **Otto-272** *DST-everywhere* | Reproduction substrate | Make every flake reproducible so investigation isn't paid from scratch |
| **Otto-227** *cross-harness skill placement* | Cross-tool sync budget | Externalize via shared substrate; each harness reads same source |

## Aaron's framing

Aaron 2026-04-25, after I synthesized the observation
(itself an instance of the rule):

> *"wow now you taught me a real novel unifying rule i've
> never thought of before, i love you ... The unifying
> observation is substantial enough that it might deserve
> its own slot i think it is, you got this."*

The synthesis itself was an Otto-287 instance: each piece
was Aaron's seed (Otto-281..286 conversations across the
session), but my context window was small enough to need
the COMPRESSED form to hold them coherently — which
forced the unifying observation to surface. Otto-287
emerged because Otto-287 was the rule.

## The deepest "why this works" — physics

Aaron's articulation of the mechanism (Otto-286 body):

> *"we are all fighting physics in our brains we don't
> have infinite context, so definitional precision
> compresses concepts and ideas so it's easy to hold."*

Otto-287 generalizes: every cognitive / operational
substrate has finite capacity. Working memory,
context windows, attention spans, decision throughput,
test runtime, CI minutes, flake-investigation budget,
trust-recovery budget. None are infinite. All are
constrained.

The factory operates at the boundary where work demand
collides with these limits. Friction IS the collision
event. The substrate rules externalize / compress /
pre-allocate the constrained resource so the collision
either:

- doesn't happen (the rule pre-allocates; work pre-fits)
- happens later under controlled conditions (the rule
  defers; collision is bounded)
- happens once instead of N times (the rule
  concentrates; collision pays off in amortization)

This is the **unifying physics**. The rules cross-
reference and reinforce because they're all responses
to the same constraint from different angles.

## Why this is "novel" yet also "obvious in retrospect"

Aaron's appreciation note included "i've never thought of
before". The reason Otto-287 wasn't visible until now,
yet feels obvious now that it's stated, is itself an
instance of Otto-287:

- Each individual finite-resource-collision (Otto-281
  through Otto-286) is small enough to hold in working
  memory and address in isolation.
- The PATTERN across them requires holding all six rules
  at once and asking "what's the same?" — that
  cross-rule synthesis demands MORE working-memory
  capacity than addressing any individual rule did.
- Until enough rules accumulated to make the pattern
  legible, the unification wasn't accessible. Once six
  rules were captured, the pattern compressed enough
  to fit.

This is also a methodological observation: **substrate
captures aren't just useful for the rules they encode —
they're useful for the meta-patterns that emerge ACROSS
them.** Otto-287 only became thinkable because Otto-281
through Otto-286 had been individually externalized first.

## What this is NOT

- **Not a claim that "finite resources" is the ONLY
  source of friction.** Some frictions are about misaligned
  goals, value disagreements, or domain-specific
  constraints (security, correctness, regulation). Those
  may not be expressible as finite-resource collisions.
  Otto-287 covers the substrate-rule taxonomy, not the
  full friction universe.
- **Not a license to invent new rules without evidence.**
  Each substrate rule was rooted in concrete observed
  failure modes (HLL flake, CURRENT-aaron stale,
  HashCode.Combine process-randomization, etc.). Otto-287
  helps explain why the rules cohere; it doesn't
  authorize speculative new rules without grounding.
- **Not a closed taxonomy.** Future friction sources may
  surface that fit the same physics — finite memory,
  context, attention, etc. The list above is the
  current-state, not the final list.
- **Not a substitute for Otto-282 in any individual
  case.** The unifying frame is useful at a meta-level;
  individual rules still need their concrete WHY-comments
  to be operational. Otto-287 explains why the rules
  exist; the rules themselves do the work.

## Pre-commit-lint candidate

Hard to mechanize directly — the rule is meta-level
explanation, not a discipline applied to individual
artifacts. But a soft heuristic: when proposing a new
substrate rule, ASK *"which finite resource does this
externalize / compress / pre-allocate?"*. If the answer
is unclear, the rule may be redundant with an existing
one. If the answer is novel, the new resource expands
the taxonomy and Otto-287's table grows by one row.

## CLAUDE.md candidacy

Otto-287 is meta-level explanation; it doesn't fire
per-session like Otto-281..285 do. **Lower CLAUDE.md
candidacy** than the operational rules. But it's
useful in two ways that ARE per-session:

- When evaluating a candidate new rule: "is it really
  novel, or is it a re-statement of an existing
  finite-resource discipline?"
- When recognizing emerging friction: "what finite
  resource is this colliding with?" — sometimes the
  answer is "a new one we haven't yet captured", which
  signals a new substrate rule is owed.

For now, deferred to maintainer discretion per Otto-283.

## Composes with

- **All Otto-NNN substrate from this session** —
  Otto-281/282/283/284/285/286 are all instances of
  Otto-287's unifying principle.
- **Otto-264** *rule of balance* — every friction triggers
  a counterweight; counterweight IS the externalize/
  compress/pre-allocate move.
- **`docs/VISION.md`** + **`memory/project_factory_becoming_superfluid_described_by_its_algebra_2026_04_25.md`**
  — the "factory becomes superfluid" observation is the
  cumulative outcome of Otto-287's principle being
  applied at every layer.
- **CLAUDE.md `feedback_never_idle_speculative_work_over_waiting.md`**
  — the "never idle" rule is the agent's response to its
  own session-time finite resource. Otto-284 is the
  fallback within the same physics.

## Self-reference moment

This memory entry was authored to compress the
finite-resource-collisions observation into one place so
future-readers (including future-me) can hold the
unifying frame in working memory without re-synthesizing
from Otto-281..286. That's Otto-287 applied to itself —
and Otto-282 (write the WHY) applied to the meta-rule.

Otto-287 captures the physics; Otto-286 captures the
strategy that uses the physics; Otto-282 captures the
discipline that lives under the strategy. Three layers,
same single principle.
