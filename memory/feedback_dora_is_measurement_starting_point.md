---
name: DORA 2025 is the starting point for Zeta's measurement frame — Aaron 2026-04-20 "the DORA stuff is like our starting point for measurements"
description: Aaron 2026-04-20 promotion of DORA 2025 from external-anchor to measurement-frame-starting-point. The ten DORA outcome variables (throughput, delivery instability, individual effectiveness, valuable work, friction, burnout, team performance, code quality, product performance, organizational performance) become Zeta's measurement columns. Task #112 (skills-runtime audit) and any follow-on observability dashboards start from these, not from invented axes.
type: feedback
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron 2026-04-20: *"the DORA stuff is like our starting
point for measurements"*

## The rule

When building Zeta observability / audit / dashboard /
skills-runtime-audit / persona-runtime-audit /
factory-balance-auditor output, **start from DORA 2025
outcome variables**. Don't invent measurement axes.

The ten DORA outcome variables (`p9 Figure 1` of
`docs/2025_state_of_ai_assisted_software_development.pdf`):

1. Organizational performance
2. Team performance
3. Product performance
4. Software delivery throughput
5. Software delivery instability (lower = better)
6. Code quality
7. Individual effectiveness
8. Valuable work
9. Friction (lower = better)
10. Burnout (lower = better)

## Why

Composes with
`feedback_data_driven_cadence_not_prescribed.md` —
DORA gives the **columns** (what to measure), Aaron's
empirical-cadence rule gives the **tuning law** (how to
interpret what we measure). Without the columns, the
tuning law has no substrate. Without the tuning law,
the columns stay static.

Also: using DORA's measurement vocabulary IS the
vocabulary-first discipline
(`user_vocabulary_first_aspirational_stance.md`)
applied to measurement. Cheaper than inventing Zeta-
native measurement names; more legible to external
audiences (including the ServiceTitan dual-architect
pitch).

## How to apply

- **When designing Task #112** (skills-runtime audit —
  gitops third artefact), the output shape starts
  from DORA's ten outcome axes, adapted to
  skill-scope. E.g. "skill-invocation throughput" =
  DORA throughput applied to `.claude/skills/*`;
  "skill-friction" = rounds-elapsed-since-last-
  invocation for stale skills.
- **When the factory-balance-auditor runs** (5-10
  round cadence, now formally empirical per
  data-driven rule), the output compares current
  factory state to the seven team profiles from DORA
  p4, adapted to agent-team shape.
- **When writing ADRs / research docs for the
  CI-meta-loop + env-parity P1 BACKLOG entries**,
  cite the specific DORA outcome variable the
  architecture is optimizing. "Retractable CD reduces
  `software delivery instability` (DORA outcome #5)."
- **Don't treat this as a full DORA-isomorphism** —
  Zeta has measurement axes DORA doesn't (retraction
  count per round, Z-linearity discipline violations,
  BP-WINDOW ledger expansion per commit, ontology
  drift rate, vocabulary-first violations). These
  extend DORA, they don't replace it.
- **When DORA 2026 lands**, re-anchor. The starting
  point is the latest DORA, not the frozen 2025
  version.

## Where DORA ends and Zeta-specific measurement begins

DORA measures *outcomes of software-delivering teams*.
Zeta measures *outcomes of an agentic software factory*.
The overlap is large but not total. Zeta-specific
extensions that don't map cleanly to DORA:

- Retraction-density per round (Zeta-native)
- Z-linearity violations per commit (Zeta-native)
- BP-WINDOW ledger per-commit alignment expansion
- Ontology drift rate (vocabulary-first violations)
- Persona-runtime staleness histogram
- Skill-runtime staleness histogram
- OpenSpec coverage delta per round

These sit *alongside* the DORA ten, not instead of.

## Cross-references

- `reference_dora_2025_reports.md` — the substrate
  (two PDFs in `docs/`).
- `feedback_data_driven_cadence_not_prescribed.md` —
  the tuning rule that DORA columns feed into.
- `user_vocabulary_first_aspirational_stance.md` —
  using DORA vocabulary IS the vocabulary-first
  discipline.
- `feedback_precise_language_wins_arguments.md` —
  shared vocabulary beats invented vocabulary for
  argument-level precision.
- Pending Task #112 (skills-runtime audit) — the first
  instrumentation deliverable that will apply this
  rule.
