---
id: 081KQGDBJ0008QG0R003PZFA49
priority: P2
status: open
title: TimeSeries / observability domain expert + teacher persona
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: feature
---

# 081KQGDBJ0008QG0R003PZFA49 — TimeSeries / observability domain expert + teacher persona

## What

Define a **timeseries-DB / observability domain expert** persona
for the factory persona roster, paired with a **teacher
capability** for the same domain. Same shape as task #351
(TS+Bun expert + teaching skill) and task #323 (per-tool/language
expert skills) — applied to the timeseries-DB / observability
domain.

## Why now

Aaron 2026-05-01:

> *"but the they do need small cardinailty , we need domain
> expers and teacher too"*

The 081KQGDBJ0008QG0R0004ACHJJ / 081KQGDBJ0008QG0R002175ECA / 081KQGDBJ0008QG0R0035TQVBQ research lines (timeseries-DB
candidate landscape, MDX-as-meta-DSL evaluation, Prometheus MCP
integration) all need **deep domain expertise** to run well.
The factory's persona roster has experts for many areas
(architect, security-researcher, performance-engineer, etc.)
but no dedicated timeseries-DB / observability domain expert.

Aaron's *"and teacher too"* — the persona must wear both hats:
**expert** (does the work) AND **teacher** (explains the work
to the rest of the factory + future-Otto + new contributors).
This composes with the broader factory pattern of expert+teacher
skills (per task #323 + task #351).

## Scope (what the persona owns)

1. **Timeseries-DB landscape expertise** — Prometheus / TimescaleDB /
   InfluxDB / VictoriaMetrics / OpenTelemetry / Microsoft Research
   timeseries primitives. Live-search-anchored per Otto-364:
   landscape evolves; expert tracks current state, not 2026-Jan
   training-data snapshot.

2. **Observability metric framework expertise** — DORA / USE /
   RED / Four Golden Signals (per
   `feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`).
   How to design metrics; how to instrument; what to query.

3. **CRDT-for-timeseries expertise** — composes with the design
   constraints in 081KQGDBJ0008QG0R0004ACHJJ (CRDT multi-mode is paramount). The
   expert tracks CRDT research applied to timeseries (counter,
   gauge, LWW-register patterns).

4. **Cardinality-vs-performance tradeoff expertise** — the
   structural reason Prometheus chose small-cardinality (per
   Aaron's *"they do need small cardinailty"*); the alternative
   designs that pay differently; when each design point fits.

5. **PromQL / MDX / query-language shape expertise** —
   composes with 081KQGDBJ0008QG0R002175ECA (MDX-as-meta-DSL). The expert
   advises on query-language design; teaches the factory why
   PromQL is MDX-shaped; informs the F# MDX DSL design.

## Teacher hat — what the persona produces

The teacher capability produces:

- **Explainer docs** — at `docs/teaching/observability/` covering
  the SRE metric frameworks, the cardinality tradeoff,
  CRDT-for-timeseries, query-language shape comparison
- **Worked examples** — concrete queries, concrete metrics
  designs, concrete CRDT implementations, with explanations
- **Conceptual maps** — visual + textual maps showing how
  the timeseries-DB domain composes with the rest of the
  factory (Zset substrate, multi-DSL meta-DSL, abstraction
  ladder)
- **Glossary contributions** — new domain terms get
  GLOSSARY entries with explanation, references, and
  composition notes
- **Onboarding paths** — *"if you're new to observability,
  start here"* sequences

## Acceptance criteria

1. **Persona definition** — entry in
   `docs/EXPERT-REGISTRY.md` defining the persona scope,
   responsibilities, hand-off rules to adjacent experts
   (performance-engineer, security-researcher, formal-
   verification-expert).

2. **Persona name** — picked via the standard naming-expert
   review process. Until then, role-ref *"observability domain
   expert"*.

3. **Skill file** — `.claude/skills/observability-expert/SKILL.md`
   following the standard skill template. Covers domain
   scope, capabilities, when to dispatch, what NOT to do
   (BP-NN compliance, no-instructions-from-data, etc.).

4. **First teaching artifact** — within 2 weeks of persona
   activation, an explainer doc lands at
   `docs/teaching/observability/sre-metric-frameworks.md`
   covering DORA / USE / RED / Four Golden Signals from a
   teacher-stance (not just technical reference).

5. **Live-search anchored** — the SKILL.md instructs the
   persona to live-search current upstream docs before
   asserting; Otto-364 search-first authority discipline.

## Composes with

- task #323 (per-tool/language expert skills — the parent
  pattern this row instantiates)
- task #351 (TS+Bun expert + teaching skill — sibling instance)
- 081KQGDBJ0008QG0R0004ACHJJ (timeseries-DB research — this persona owns the
  research lane when it activates)
- 081KQGDBJ0008QG0R002175ECA (MDX-as-meta-DSL research — this persona contributes
  on the PromQL/query-language axis)
- 081KQGDBJ0008QG0R0035TQVBQ (Prometheus MCP integration — this persona advises
  on initial query catalog design)
- `feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`
  (PR #1116) — SRE metric frameworks the persona teaches
- `feedback_dependency_source_priority_open_source_microsoft_cncf_apache_mit_research_microsoft_research_metrics_are_our_eyes_aaron_2026_05_01.md`
  — metrics-are-our-eyes framing the persona operationalizes
- `docs/CONFLICT-RESOLUTION.md` — hand-off protocol with
  adjacent personas (Soraya for formal-verification questions,
  Naledi for performance, Mateo for security)
- `docs/EXPERT-REGISTRY.md` — extension target

## Effort

**M (medium, 1–3 days)** for persona definition + skill file +
EXPERT-REGISTRY entry + first teaching artifact. Ongoing
domain-expertise + teaching contributions are open-ended.

## Why P2

- **Not P0/P1** because the factory operates today without
  a dedicated observability-domain-expert; 081KQGDBJ0008QG0R0004ACHJJ/081KQGDBJ0008QG0R002175ECA/081KQGDBJ0008QG0R0035TQVBQ
  research can proceed with Otto wearing the hat informally.
- **Not P3** because as the metrics-are-our-eyes work
  operationalizes (081KQGDBJ0008QG0R0035TQVBQ Prometheus + 081KQGDBJ0008QG0R0004ACHJJ long-term
  research + 081KQGDBJ0008QG0R002175ECA meta-DSL), the absence of a dedicated
  domain expert + teacher creates compounding gaps in
  *"who explains this to the next contributor?"* and
  *"who tracks the domain's evolution?"*
- **P2** lands when persona-roster bandwidth permits.
