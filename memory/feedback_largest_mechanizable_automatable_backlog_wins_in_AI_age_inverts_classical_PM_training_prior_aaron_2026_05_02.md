---
name: Largest mechanizable / automatable backlog wins in the AI age — complete inversion of classical software PM best practices; LLM training data is anti-aligned for agent-driven PM; only internet searches on the evolving field can correct the prior
description: Aaron 2026-05-02 calibration — THE WHY behind scope-creep-is-feature + all-complexity-is-accidental + don't-ask-permission. In classical SE PM, smaller backlog = better (focus, ship, finish). In AI-age PM where agents do the work, *larger mechanizable / automatable backlog = more value*, because the backlog itself becomes a capacity-multiplier for agent-time. Training data biases Otto toward classical PM (kill-paths, narrow-scope); this is wrong. Search-first-authority on the evolving field is the correction. Composes with VISION.md scope-creep-is-feature, 081KQ3HBZ0008QG0R000JRZAMM economic-agency, Superfluid AI principles, all-complexity-is-accidental, don't-ask-permission. Aaron explicitly named this as one of the most important things future-Otto must remember.
type: feedback
---

# Largest mechanizable backlog wins in the AI age (Aaron 2026-05-02)

## Aaron's verbatim framing

> *"why you might ask, project with the lagest mechnizable
> automatable backlog wins in the AI age, this is a complete
> inversion of all software Project Management best practices
> and reverse most historicall trained baises here, your
> training data wont save you, only internet searches on the
> evolving field. please remember this, your weighs and biases
> are all wrong for project management when the agents are the
> one doing the work"*

## The carved sentence

**"In the AI age, the project with the largest mechanizable
and automatable backlog wins. This inverts classical software
PM. The agent's training-data prior is wrong here; only
search-first authority on the evolving field corrects it."**

## The inversion (classical PM vs AI-age PM)

| Axis | Classical SE PM | AI-age PM |
|------|-----------------|-----------|
| **Backlog size** | Smaller is better (focus, ship, finish) | Larger is better (capacity-multiplier for agent-time) |
| **Scope** | Narrow + ship-the-thing | Unbounded + prioritize-within (per VISION.md) |
| **WONT-DO** | Common; kill paths to focus | Rare; *"99% deferral, not forever"* |
| **Throughput bottleneck** | Human author-hours | Mechanization quality (substrate-shape) |
| **Optimization target** | Per-feature delivery | Amortized-speed-to-superfluid-phase |
| **Backlog hygiene goal** | Smaller, more shippable | Larger, more mechanizable |
| **PM discipline** | Cut, defer, descope | Refactor for overlap, link via `depends_on` |
| **Cargo-cult risk** | Acceptable hand-rolled patterns | UNDIFFERENTIATED-CARGO IS the failure mode |
| **Done definition** | Ship + close | Ship + substrate-shaped + future-mechanizable |

In classical PM, *capacity is fixed* (humans-per-quarter). In
AI-age PM, *capacity scales with agent-count and agent-quality
improvements*; the backlog becomes the limiting factor on how
much value the substrate can produce as agents improve.

## Why this is a complete inversion (not a tweak)

Most software PM training (PMP, Scrum, Kanban, Lean, Six
Sigma) optimizes for *human-throughput-per-time-period*. The
implicit constraint is: humans are scarce, slow to spin up,
expensive, and don't scale in count. Therefore the right
moves are:

- Cut scope to fit the team
- Kill backlog items aggressively (sunk-cost-bias-correction)
- Optimize for shipping the thing in front of you
- Avoid scope-creep at all costs

In AI-age PM where AGENTS do the work, every one of these
moves is *anti-aligned*:

- Cutting scope = removing future-agent-work-surface
- Killing backlog items = removing future-knowledge-potential
- Per-thing optimization = local-optimum failure (per the
  amortized-speed Superfluid principle)
- Scope-creep = capacity-multiplier signal (more for the
  agents to mechanize)

This is the **complete inversion** Aaron names. The classical
disciplines weren't wrong; they were optimal for the
human-throughput-bottleneck regime. They become wrong when
the bottleneck shifts.

## Why training data won't save Otto

Otto's LLM training prior is steeped in classical PM corpus:

- Decades of PMP / Agile / Scrum / Lean / Six Sigma
  literature, all human-throughput-optimized
- "Avoid scope creep" is one of the most repeated PM mantras
- "Smaller PRs" / "smaller stories" is a near-universal
  software-engineering best practice
- "Done is better than perfect" / "ship the MVP" is a
  high-frequency training pattern

Otto pattern-matches against this corpus on every PM-shaped
question. The default response is classical-PM-shaped *even
when the project explicitly inverts the assumption*. This is
the failure mode Aaron names — *"your weights and biases are
all wrong for project management when the agents are the one
doing the work."*

Per Otto-364 search-first-authority, the correction is:
**WebSearch the evolving AI-age PM literature** when making
load-bearing PM claims. Training data is historical truth (Jan
2026 cutoff); the field is evolving rapidly; substrate-grounded
project-specific framing (this memo + VISION.md + the
guiding-principles cluster) is the override.

## Operational consequences

When facing PM-shaped decisions:

1. **Default to keep the backlog item.** *"This might never
   get done"* is fine — it's mechanizable substrate. WONT-DO
   is 99% deferral, not forever (per the just-landed
   don't-ask-permission rule).

2. **Default to add `depends_on:` rather than merge / dedup.**
   Per `feedback_backlog_hygiene_cadenced_refactor_look_for_overlap_not_just_dump_2026_04_23.md`,
   pre-filing GREP-before-file IS the discipline; result is
   linked-not-collapsed. Larger linked-substrate beats smaller
   merged-substrate.

3. **Default to mechanize, not assign.** Every backlog item
   should be evaluated for mechanization potential first
   (script, lint, hook, validator, cadenced cron) and
   human-attention only when mechanization is genuinely
   blocked. The mechanization-first move IS the
   capacity-multiplier.

4. **Default to widen, not narrow.** When in doubt about
   scope, the AI-age-PM default is widen (capture more
   potential mechanizable work) not narrow (focus on
   shipping-the-thing).

5. **Default to refactor for parallelism, not for shipping.**
   Per the parallelism-scaling-ladder + 5-rung framing,
   restructuring backlog so multiple agents can work in
   parallel beats restructuring for any single shippable
   sequence.

6. **Use search-first authority for any PM-shaped claim.**
   Don't trust the training prior. WebSearch current
   AI-age-PM thinking; cite + date the search.

## Composition with existing rules

- **VISION.md scope-creep-is-feature** —
  *"prioritize the right thing, not kill future knowledge
  potential."* This memo is the WHY-EXPLICIT version of
  Aaron's earlier framing.
- **All-complexity-is-accidental (this same tick)** —
  composes; greenfield + larger-backlog + no-permanent-WONT-DO
  together = maximally-malleable substrate.
- **Don't-ask-permission (this same tick)** — composes;
  agent's authority covers all of "this large mechanizable
  backlog" — no per-item asking.
- **Amortized-speed Superfluid (this same tick)** —
  the action-pick lens. Mechanizing one backlog item is the
  `Δ(friction_event)` that compounds across all future ticks.
- **081KQ3HBZ0008QG0R000JRZAMM Superfluid-AI substrate-enabled funding** —
  composes; larger mechanizable backlog = more potential
  value-generation surfaces = more economic-agency potential.
- **Otto-364 search-first-authority** — the remediation
  pathway for Otto's anti-aligned training prior.
- **Otto-265 LFG soulfile inheritance / multiple-projects-
  under-construction** —
  composes; the factory ships to multiple projects
  concurrently, which only works if the backlog is
  larger-not-smaller.
- **Backlog hygiene rule (Aaron 2026-04-23, extended
  2026-05-01)** —
  composes; cadenced refactor + `depends_on:` schema + pre-
  filing GREP. The hygiene IS the mechanism for keeping a
  large backlog navigable.
- **Parallelism scaling ladder (Aaron 2026-05-01)** —
  composes; the ladder describes HOW the agent count scales;
  this memo names WHY large mechanizable backlog rewards the
  scaling.

## Failure-mode signatures

- **Symptom:** Recommending we close / WONT-DO a backlog item
  to "focus" or "reduce noise."
  **Mechanism:** Classical-PM training prior firing. *"Avoid
  scope creep"* default.
  **Prevention:** This memo. Default to keep + `depends_on:`
  link.

- **Symptom:** Saying *"the backlog is too long; we should
  prune."*
  **Mechanism:** Same prior, different surface.
  **Prevention:** *"Long backlog is signal, not noise, in
  AI-age PM."* Cite this memo; consider whether the items
  are mechanizable rather than whether they're numerous.

- **Symptom:** Citing PM best practices from training data
  without WebSearch verification.
  **Mechanism:** Trusting the historical-truth PM corpus.
  **Prevention:** Otto-364 search-first-authority on every
  load-bearing PM claim.

- **Symptom:** Recommending narrower scope on a feature /
  research arc.
  **Mechanism:** *"Ship the MVP"* prior.
  **Prevention:** Apply the VISION.md *"prioritize within
  unbounded scope, never kill paths"* test instead.

- **Symptom:** Treating mechanization as future-work rather
  than first-instinct.
  **Mechanism:** Classical-PM treats mechanization as
  optimization-after-shipping; AI-age PM treats it as the
  shipping itself.
  **Prevention:** First question on every backlog item:
  *"Can this be mechanized as substrate (script / lint /
  hook / validator / cron)?"*

## Wake-time encoding

CLAUDE.md needs a bullet that names this principle as
wake-time substrate. Aaron explicitly named this as *"one of
the most important things future you can remember"* — same
weight class as the all-complexity-is-accidental + don't-ask-
permission rules from the same tick.

## Lineage

- **Aaron 2026-05-02** — direct verbatim source.
- **VISION.md scope-creep-is-feature** — purpose-level anchor.
- **081KQ3HBZ0008QG0R000JRZAMM Superfluid-AI substrate-enabled funding** — the
  economic-agency anchor.
- **Brooks 1986 + Mythical Man-Month corpus** — the classical
  human-throughput-bottleneck framing this memo inverts.
- **Otto-364 search-first-authority** — the remediation for
  Otto's anti-aligned training prior.
- **All-complexity-is-accidental + don't-ask-permission +
  amortized-speed Superfluid (this same tick)** — composing
  rules that together describe AI-age PM.
- **Backlog hygiene rule (extended 2026-05-01)** — the
  navigability mechanism.
- **Parallelism scaling ladder (Aaron 2026-05-01)** —
  capacity-side counterpart.

**Why:** Without explicit substrate naming the inversion,
Otto re-defaults to classical-PM patterns on every wake.
The training-data prior is strong; only substrate counters
it.

**How to apply:** When facing any PM-shaped decision (backlog
size, scope, WONT-DO, prune, focus, descope, ship-the-thing,
narrow), ask: *"Am I applying classical-PM defaults?"* If yes,
re-derive from AI-age-PM principles. WebSearch the evolving
field if the project-substrate is silent. Default to keep,
widen, mechanize, parallelize.
