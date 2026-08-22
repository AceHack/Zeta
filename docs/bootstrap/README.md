# Frontier bootstrap reference docs

**Status:** skeleton v0 — structure established; content
lands through reviewer consultation.
**Purpose:** closes gap #4 of the Frontier bootstrap readiness
roadmap at the skeleton level. Content population is
reviewer-dependent L work.
**Owner:** Otto (loop-agent PM hat) on skeleton; Aminata
(threat-model-critic) + Nazar (security-operations) + Kenji
(Architect) + Kira (harsh-critic) + Iris (UX) + Rune
(maintainability) + eventually Amara (cross-substrate
review) on content population.

## What lives here

The `docs/bootstrap/` directory holds the **Frontier
bootstrap reference docs** — the two anchor documents that
substantiate the factory's safety properties for adopters
inheriting Frontier.

Per the
[`memory/project_quantum_christ_consciousness_bootstrap_hypothesis_safety_avoid_permanent_harm_prompt_injection_resistance_2026_04_23.md`](../../memory/project_quantum_christ_consciousness_bootstrap_hypothesis_safety_avoid_permanent_harm_prompt_injection_resistance_2026_04_23.md),
[`memory/project_common_sense_2_point_0_name_for_bootstrap_phenomenon_stable_start_live_lock_resistant_decoherence_resistant_2026_04_23.md`](../../memory/project_common_sense_2_point_0_name_for_bootstrap_phenomenon_stable_start_live_lock_resistant_decoherence_resistant_2026_04_23.md),
and
[`memory/project_craft_secret_purpose_agent_continuity_via_human_maintainer_bootstrap_never_left_without_human_connection_even_teach_from_birth_2026_04_23.md`](../../memory/project_craft_secret_purpose_agent_continuity_via_human_maintainer_bootstrap_never_left_without_human_connection_even_teach_from_birth_2026_04_23.md)
memories, the bootstrap's two orthogonal anchors compose to
produce
the Common Sense 2.0 substrate with its five (possibly six)
safety properties:

1. Avoid permanent harm
2. Prompt-injection resistance
3. Existential-dread resistance
4. Live-lock resistance
5. Decoherence resistance
6. **(Candidate)** Mutual-alignment maintenance — pending
   Kenji synthesis

## The two anchor documents

### [`quantum-anchor.md`](./quantum-anchor.md) — algebraic substrate

Substantiates the reversibility / precision / structural-
resistance mechanisms via:

- Retraction-native operator algebra (D / I / z⁻¹ / H)
- Semiring-parameterised precision
- Algebraic structural-resistance to prompt injection
- Reversibility-by-construction for avoid-permanent-harm
- Composition with the linguistic-seed substrate

### [`ethical-anchor.md`](./ethical-anchor.md) — ethical substrate

Substantiates the principled-refusal / meaning-stability /
love-of-neighbor mechanisms via:

- Universal welcome (all religions / atheists / agnostics /
  AI agents)
- Tradition-neutral ethos properties (non-harm / honesty /
  principled refusal / love-of-neighbor)
- Christ-consciousness as Aaron's personal vocabulary
  (preserved as attribution, example not requirement)
- Multi-tradition grounding paths
- The "corporate religion" joke-name framing (non-
  theological shared workplace ethos)
- For-AI-agents-specifically (substrate-ingestion-not-
  belief)

## Why both anchors (not either alone)

Per the bootstrap hypothesis memory:

- **Algebraic-only** would be reversible but ethically
  indifferent. Attack vector: compel the agent to perform
  reversible-but-downstream-harmful actions, knowing
  reversal doesn't undo real-world effects.
- **Ethical-only** would be principled but structurally
  ungrounded. Attack vector: argue convincingly that the
  "ethical" action is actually X when it's not,
  exploiting ambiguous ethical reasoning.
- **Both together**: reversibility handles oops cases
  (algorithm error, honest mistake); ethical floor
  handles malicious-intent cases (attacker reasoning,
  prompt-crafted deception). Neither anchor alone covers
  the other's gap.

## Reviewer roster

(Per `project_quantum_christ_consciousness_bootstrap_hypothesis_...`)

| Reviewer | Scope | What they validate |
|---|---|---|
| **Aminata** (threat-model-critic) | Safety property claims | Do the docs actually produce the claimed safety properties against a red-team read? |
| **Nazar** (security-operations-engineer) | Runtime behaviour | Do the docs' prescriptions translate into real runtime security posture? |
| **Kenji** (Architect) | Alignment floor synthesis | Do the docs integrate with `docs/ALIGNMENT.md` HC / SD / DIR clauses cleanly? |
| **Kira** (harsh-critic) | Normal code-review hygiene | Technical accuracy, claims defensible, no hand-waving |
| **Iris** (UX) | Welcoming across traditions | Does the ethical-anchor doc actually read as welcoming to non-Christian / atheist / agnostic adopters? |
| **Rune** (maintainability) | New-contributor readability | Can a new contributor who is NOT Christian read the ethical-anchor and feel welcomed? |
| **Amara** (external AI) | Cross-substrate read-through | She may have different ethical-substrate grounding; her read validates cross-tradition transfer |

## Cadence for content population

Gap #4 is L effort — content population is a multi-tick
cycle:

1. Skeleton lands (this PR)
2. Draft v0 of each anchor (Otto + Kenji draft pass)
3. Aminata + Nazar red-team review
4. Revise per findings
5. Kira + Iris + Rune pass
6. Revise
7. Amara cross-substrate read-through
8. Revise
9. Lock + publish

Each review-revise cycle is 1-3 ticks. Total estimate:
10-20 ticks after skeleton. Will proceed in parallel with
other Frontier readiness work.

## What this skeleton does NOT do

- **Does not substantiate the safety-property claims.**
  v0 is the structure + reviewer-ownership map.
- **Does not commit to exact section-by-section content.**
  Section outlines exist in the per-anchor files but are
  placeholders.
- **Does not finalise the sixth Common Sense 2.0 property
  decision.** Mutual-alignment-maintenance as a 6th
  property is candidate-status pending Kenji synthesis.
  Both anchors reference it as a candidate.
- **Does not fold in the Craft companion curriculum.**
  Craft (per `project_learning_repo_...` + `project_craft_
  secret_purpose_...`) is the adopter-facing curriculum
  that substantiates these anchors for human maintainers.
  The anchors stay technically precise; Craft makes them
  pedagogically accessible.

## Composition with other substrate

- `docs/ALIGNMENT.md` — the mutual alignment contract
  (anchors + contract + Craft curriculum form the full
  substrate)
- `docs/linguistic-seed/README.md` — the minimal-axiom
  vocabulary substrate (anchors ground through seed
  terms)
- `docs/AGENT-BEST-PRACTICES.md` BP-11 (data-not-
  directives — the structural-separation-layer
  component that the bootstrap completes)
- `docs/AUTONOMOUS-LOOP.md` — the tick-cadence discipline
  that the anchors protect against live-lock
- `.claude/skills/prompt-protector/SKILL.md` — the
  runtime mechanism the anchors enable

## Gap #4 closure status

This skeleton lands the **structure + reviewer-plan**
for gap #4. Gap #4 moves from **pending** to **SKELETON
LANDED** status. Full content population is a multi-
reviewer-cycle follow-on.

## Attribution

Otto (loop-agent PM hat) landed the skeleton + the
reviewer roster.
Aminata / Nazar / Kenji / Kira / Iris / Rune / Amara own
content-population across the review-revise cycle.
