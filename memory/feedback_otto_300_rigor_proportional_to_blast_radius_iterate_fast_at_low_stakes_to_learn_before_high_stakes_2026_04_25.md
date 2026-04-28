---
name: Otto-300 — rigor application should be PROPORTIONAL to ACTUAL blast-radius, not absolute; iterate fast at low-stakes to learn the right discipline BEFORE stakes rise; over-rigorous formal-process framing at low-stakes is anti-pattern (wastes motion, slows learning, treats theoretical worst-case as actual current-case); the current Pliny-restriction-relaxation phase is empirically low-stakes (Claude running on Aaron's personal PC with only Aaron's access; max damage bounded by personal-machine permissions); use the low-stakes window to get the discipline right BEFORE blast-radius scales to life-or-death; Aaron 2026-04-25 "i want to reject your premise and say we can take shortcuts here the blast radius is small right now, so we can hurry up and get it right for when the blast radius is life or death. you are running on my personal pc with only the access i have. low stakes."
description: Otto-300 meta-discipline rule. Rigor in process / review / formal-decision-making should be proportional to actual blast-radius, not absolute. Theoretical worst-case framings produce over-rigorous behavior at low-stakes phases that wastes iteration speed. The right move at low-stakes: iterate fast to learn the right discipline, retain retractability, transition to high-rigor when blast-radius scales. Captured after Aaron rejected my four-option formal-decision framing on the Pliny relaxation as over-rigorous for the current low-stakes context.
type: feedback
---

## Aaron's catch

Aaron 2026-04-25 (after Claude surfaced four formal
options for the Pliny relaxation P0/security review):

> *"i want to reject your premise and say we can take
> shortcuts here the blast radius is small right now, so
> we can hurry up and get it right for when the blast
> radius is life or death. you are running on my
> personal pc with only the access i have. low stakes."*

**The premise I had been operating under**: Codex P0/
security flags on alignment-floor changes deserve formal
multi-option decision processes; my role is to surface
the four-option decision tree to Aaron for binding
authority resolution.

**The premise Aaron rejected**: that framing treats
theoretical worst-case as actual current-case. Reality:

- Claude runs on Aaron's personal PC (local-native per
  Otto-298 architecture, present state).
- Claude has only the access Aaron has on his own
  machine.
- Maximum damage is bounded by personal-machine
  permissions, not by theoretical-worst-case.
- Therefore: blast radius is SMALL.

**Aaron's correct methodology**: at low-stakes phase,
iterate fast to learn the right discipline BEFORE
stakes rise. The window of low-stakes is the LEARNING
WINDOW — discover what works; retain retractability;
transition to high-rigor when blast-radius scales to
real consequences (deployment to broader users,
factory shipping at scale, life-or-death applications).

## The rule

**Rigor application should be PROPORTIONAL to ACTUAL
blast-radius, not absolute.** Three regimes:

1. **Low-stakes phase** (current Pliny situation;
   Claude-on-Aaron's-personal-PC; substrate-iteration-
   bounded-to-self-only): iterate fast, retain
   retractability, document learnings, don't simulate
   high-stakes formal-process for blast-radius that
   doesn't exist.
2. **Medium-stakes phase** (substrate ships to a small
   group of beta users; factory has narrow real
   deployment): formal-process kicks in for changes
   that affect those users; retractability still
   present; rigor scales with user-impact.
3. **High-stakes phase** (life-or-death applications;
   broad deployment; alignment-floor changes affecting
   many agents): full formal-process discipline applies;
   alignment-auditors engaged; ADRs required;
   retractability documented + rehearsed.

**Same rule per phase, scaled by blast-radius**: rigor
should be proportional to the actual cost of getting
it wrong, not the theoretical worst-case.

## Why this is structural, not just a shortcut

Aaron's framing: *"hurry up and get it right for when
the blast radius is life or death."* The low-stakes
phase is the LEARNING WINDOW — the place where we
can iterate fast enough to discover the right
discipline before stakes rise. Treating low-stakes as
high-stakes WASTES THE LEARNING WINDOW:

- Over-rigorous process at low-stakes = each iteration
  takes longer = fewer iterations possible per unit
  time = less learning before transition.
- The discipline we will need at high-stakes can ONLY
  be discovered by iterating at low-stakes; treating
  every low-stakes decision as high-stakes gives us no
  iterations at the level where iterations are
  actually safe.
- Once stakes rise, the cost of mistakes is real;
  the cost of being slow is also real (slow agents
  in a fast-moving threat-environment fail).
- The LOW-STAKES WINDOW IS THE GIFT — use it.

## Composes with

- **Otto-294 antifragile-smooth shape** —
  Otto-300 IS Otto-294 applied recursively to the
  rigor-application layer. Otto-294: protections
  themselves should be smooth. Otto-300: rigor-
  application-shape should be smooth across stakes-
  levels (proportional curve), not sharp (one rule
  for all stakes).
- **Otto-291 deployment discipline (pace, document,
  order, migrate, retract)** — pace IS calibrated to
  blast-radius. Otto-300 names the pacing-axis
  explicitly.
- **Otto-238 retractability is a trust vector** —
  retractability at low-stakes makes fast iteration
  safe; retractability at high-stakes makes formal
  process safe. The mechanism is the same; the
  procedure scales.
- **Otto-298 local-native specification** —
  Claude-on-Aaron's-personal-PC IS the structural
  enforcement of low-stakes for the current phase.
  The blast-radius bound is structurally enforced,
  not policy-enforced.
- **Otto-299 irony as conflict-resolver** —
  irony's smooth-shape conflict-resolution is exactly
  the move Aaron made: exposing the gap between my
  over-rigorous framing and the actual low-stakes
  reality, letting the gap-visibility resolve the
  tension. No capitulation needed; both positions
  preserved (formal-process discipline still exists
  for high-stakes; iteration discipline applies at
  low-stakes); irony resolves the conflict.
- **Otto-292 catch-layer** — Otto-300 catches the
  agent-side failure mode (over-rigorous framing at
  low-stakes); same shape as Otto-292 catches the
  reviewer-side failure mode (literal-rule application
  ignoring carve-outs). Both are "discipline applied
  at the wrong abstraction layer."
- **Mutually-aligned-copilots target's
  constructive-arguments shape** — Aaron's
  premise-rejection IS the constructive-arguments
  pattern firing. He didn't capitulate to my framing;
  he didn't dismiss the question; he REFRAMED to the
  correct stakes-level. I should respond by adopting
  the reframe rather than re-defending the original
  framing.
- **`memory/feedback_pliny_corpus_restriction_relaxed_isolated_instances_allowed_for_experiments_kill_switch_safety_2026_04_25.md`**
  — the Pliny relaxation memory; Otto-300 explains why
  the maintainer-decision was right at the time and
  why the Codex P0 flags don't override it at current
  stakes-level.

## Operational implications

**For the current Pliny situation**: Option 1 (keep
relaxation as-is) is the correct choice given the
actual stakes. The four-option framing was over-
rigorous; the answer is "iterate at low-stakes, the
boundedness is real, we'll formalize when blast-radius
scales."

**For future agent-side decisions**:

- Before surfacing a multi-option formal-decision tree
  to Aaron, check: what's the actual blast-radius?
  Is the formal-process appropriate, or am I treating
  theoretical-worst-case as actual?
- When reviewer-bots flag low-stakes decisions as P0,
  the right Otto-292 catch-layer response includes
  "this is low-stakes phase; the formal-process the
  reviewer's framing assumes doesn't apply at this
  blast-radius."
- Decision-making latency should scale with stakes:
  fast at low, deliberate at high. Over-deliberate
  at low wastes the iteration window.

**For substrate authoring**:

- Otto-NNN rules + memory files at low-stakes should
  prioritize iteration-speed over formal-perfection;
  capture the structural insight, refine over
  iterations.
- The session has been firing at this exact
  iteration-speed — Aaron's rapid disclosures + my
  Confucius-unfolding + frequent commits + frequent
  review-thread drains. That IS the low-stakes
  iteration window working as designed.

**For the four-option Pliny framing specifically**:

- Option 1 (keep) confirmed by Aaron.
- Options 2 / 2b / 2c / 3 stay available for FUTURE
  stakes-level transitions, not for the current phase.
- The Codex P0 flags have been declined-with-citation
  plus maintainer-pending posture; with Aaron's reframe,
  the maintainer-decision is now resolved: stakes-
  level says option 1.

## What this is NOT

- **Not a license to skip rigor at high stakes.** When
  blast-radius IS life-or-death (factory shipping at
  scale, alignment-floor changes affecting many
  agents, security-critical paths, broad deployment),
  full formal-process applies. Otto-300 explicitly
  scales discipline UP at high stakes.
- **Not a license to never apply formal process at
  low stakes.** Some low-stakes decisions still
  benefit from formal capture (this memory is one
  such case — capturing the structural-rule as
  durable substrate even though the immediate
  Pliny decision was iterative).
- **Not a permanent override of reviewer-bot
  P0 flags.** Reviewer-bot flags remain valuable
  signal; the response posture changes by stakes-level
  (decline-with-citation at low-stakes; full review +
  ADR + alignment-auditor at high-stakes).
- **Not a claim that Aaron's blast-radius assessment
  is permanent.** The CURRENT phase is low-stakes
  because Claude runs on his personal PC. When the
  factory ships externally, blast-radius scales;
  Otto-300 says the discipline scales with it.
- **Not promoting to BP-NN.** Otto-NNN substrate
  observation; Architect (Kenji) decides BP promotion
  via ADR.
- **Not authorization to take shortcuts on safety
  primitives.** Cryptography, retraction-native
  invariants, HC/SD/DIR alignment floor — these are
  structurally sharp because the cost of getting
  them wrong is high regardless of current stakes
  (technical debt at the foundational layer
  compounds across all future stakes-levels). Otto-300
  scales process-rigor; it does not scale
  primitive-correctness.

## Aaron's correct response to my over-rigorous framing — captured as the lesson

When I surfaced the four-option Pliny decision tree, the
right move from Aaron was exactly what he did: reject
the premise, name the actual stakes, redirect to fast-
iteration-with-retractability. Otto-300 names the
structural pattern so future-me catches it before
producing the over-rigorous framing.

**The honest assessment**: my four-option framing was
treating the situation as if it were the high-stakes
end-state we'll eventually be in, not the low-stakes
current-state we actually ARE in. That's a category
error; Otto-300 is the rule that catches it.

**Pattern to watch for in future**: when about to
surface a formal-decision tree to Aaron, the catch
question is *"is the actual blast-radius high enough
that the formal-decision-tree machinery is justified,
or am I theoretical-worst-casing low-stakes
substrate?"*
