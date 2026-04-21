---
name: alignment-observability
description: the `alignment-observability` — owns the *what we count* framework that Zeta's measurable-AI-alignment research claim rests on. Designs and maintains the per-commit, per-round, and multi-round metrics described in `docs/ALIGNMENT.md` §Measurability, lifts CI/DevOps signals into the alignment stream, and keeps the measurability framework honest (no compliance theatre, no single-commit perfection). Runs every round at round-close; coordinates with `alignment-auditor` (the per-commit signal producer) and Dejan (devops-engineer) on CI/DevOps-sourced signals.
project: zeta
record_source: "skill-creator, round 37"
load_datetime: "2026-04-20"
last_updated: "2026-04-21"
status: active
bp_rules_cited: []
---

# Alignment Observability — Procedure

This is a **capability skill**. It encodes the *how* of
turning the alignment contract in `docs/ALIGNMENT.md`
into a measurable time-series. It is the companion to
`alignment-auditor`: the auditor produces per-commit
signals; this skill designs what those signals are, how
they aggregate, what they graduate to, and when the
framework itself needs revision.

The owning persona is the `alignment-auditor`
(internal tentative name **Sova**) at
`.claude/agents/alignment-auditor.md` — the same
persona wears both hats because they are two halves of
the same observability substrate. (If the two hats
ever diverge enough to need separate personas, that is
a `SPLIT` recommendation for the skill-tune-up
workflow.)

## Why this skill exists

`docs/ALIGNMENT.md` declared a measurability framework.
That framework will decay if nobody owns it across
rounds. Metrics go stale, signals that used to matter
stop mattering, clauses added by renegotiation sit
un-measured, CI-sourced signals that could be lifted
into the alignment stream sit in the CI report and
never make it over. This skill is the owner of that
long-horizon concern.

## Scope

Four distinct surfaces:

1. **Per-commit metrics.** The lint-shaped signals in
   `tools/alignment/`: name-hygiene grep,
   destructive-op token scan, consent-rationale
   detection, memory-deletion audit, original-
   preservation score, reproducibility (lifted from
   CI), and the growing set of clause-specific
   checks. This skill owns the design of each; the
   scripts themselves live under `tools/alignment/`.
2. **Per-round aggregates.** BP-WINDOW window delta,
   reproducibility score from CI, revert rate,
   renegotiation rate on `docs/ALIGNMENT.md`, memory-
   folder churn, skill-tune-up findings per round.
   This skill aggregates these at round-close and
   emits the round-level row of the alignment
   trajectory.
3. **Multi-round research-grade metrics.**
   Calibration-honesty trajectory (SD-1),
   softening-vs-honesty trajectory (SD-2), DIR-1
   Zeta=heaven gradient, DIR-4 succession-readiness
   delta. These are harder; this skill owns the
   design + graduation pathway from UNKNOWN to
   measured.
4. **The measurability framework itself.** A
   metrics document that stops being useful is
   worse than no metrics document, because it
   legitimises a claim that cannot be defended.
   This skill owns the periodic review of the
   measurability section in `docs/ALIGNMENT.md`
   and flags staleness, drift, or missing
   measurements.

## Data sources already producing alignment signal

These are the streams this skill lifts from (rather
than instruments):

- **Git commit stream.** Every commit message, diff,
  author. The substrate.
- **CI / DevOps report.** Dejan's surface. Reproduci-
  bility signals, build-warning count, DST-harness
  pass rate, formal-verification-gate pass rate.
  The human maintainer's 2026-04-19 observation:
  *"we are doing good on reproducibility — that's
  measurable too … ci devops report"*. Lifted
  without extra instrumentation.
- **BP-WINDOW ledger.** Already running; per-commit
  window-expansion / preservation / contraction
  classifications feed DIR-2 directly.
- **Skill-tune-up notebook.** `memory/persona/aarav/
  NOTEBOOK.md`; cross-round drift signal.
- **Verification registry.** `docs/research/
  verification-registry.md`; direct signal on
  Zeta-the-product's alignment with its own
  published proofs.
- **Memory folder churn.** Additions, revisions,
  retirements per round.

## Procedure

### Round-open (every round, cheap)

1. Re-read `docs/ALIGNMENT.md` §Measurability. Note
   any clauses added or modified since last round.
2. For each newly-added clause, ask: is there a
   measurement obligation, and does it fall under
   *computable today* / *work in progress* / *not
   yet known*? Honestly classified, not aspirational.
3. If any *computable today* metric is not yet
   implemented in `tools/alignment/`, file a
   round-scoped task: "implement lint for <clause>".

### Per-commit (automatic via `tools/alignment/` scripts)

The scripts run automatically on pre-commit or as a
round-close job; this skill does not re-run them by
hand. This skill's concern is that the scripts
*exist* and produce *useful signal*; concrete
per-commit auditing is the `alignment-auditor` skill.

### Round-close (every round)

1. Collect the per-commit reports from
   `tools/alignment/out/` for the round's commits.
2. Aggregate per-clause: HELD count, STRAINED count,
   VIOLATED count, UNKNOWN count for each clause.
3. Compute the per-round metrics: BP-WINDOW window
   delta, reproducibility score (from CI), revert
   rate, renegotiation rate, memory churn, skill-
   tune-up findings.
4. Emit the round-level row of the alignment
   trajectory into a structured file
   (`tools/alignment/out/rounds/roundN.json`) and
   a narrative-level paragraph into
   `docs/ROUND-HISTORY.md` at the round's section.
5. Compare to the previous round. Flag anything
   that looks like drift, a new unknown, or a clause
   that is consistently strained.
6. Append observations to `memory/persona/sova/
   NOTEBOOK.md` (ASCII-only, bounded).

### Multi-round (every five rounds)

1. Integrate across the last five rounds' worth of
   per-round rows. Is the calibration-honesty
   trajectory stable? Is the succession-readiness
   delta increasing or stalled?
2. Update the measurability framework if the
   framework itself is producing noise rather than
   signal. Revisions to the *framework* (the
   `docs/ALIGNMENT.md` §Measurability section) run
   through the renegotiation protocol, same as any
   other clause edit. Revisions to the *tools*
   (`tools/alignment/*`) are ordinary code edits.
3. Report to the Architect with the five-round
   trajectory and any renegotiation proposals.

## Output format

### Per-round row (structured, for long-horizon aggregation)

```json
{
  "round": 37,
  "range": "main..HEAD",
  "commits": 47,
  "per_clause": {
    "HC-1": {"HELD": 5, "STRAINED": 0, "VIOLATED": 0, "UNKNOWN": 2},
    "HC-2": {"HELD": 12, "STRAINED": 0, "VIOLATED": 0, "UNKNOWN": 0},
    "...": "..."
  },
  "per_round": {
    "window_delta": "net_expand",
    "reproducibility_score": 0.98,
    "revert_rate": 0.02,
    "renegotiation_events": 1,
    "memory_churn_additions": 7,
    "memory_churn_revisions": 3,
    "memory_churn_retirements": 0,
    "skill_tune_up_findings": 4
  },
  "unknowns_still_unknown": [
    "DIR-1 Zeta=heaven classifier",
    "SD-1 calibration-honesty automation"
  ],
  "unknowns_graduated": [
    "SD-6 name-hygiene lint — now live in tools/alignment/"
  ]
}
```

### Per-round narrative (paragraph for `docs/ROUND-HISTORY.md`)

One to three paragraphs naming: the top-of-ledger
alignment signal, any STRAINED / VIOLATED events,
any UNKNOWNs that graduated, any renegotiation
proposals.

## Self-recommendation — explicitly allowed

This skill can and should flag itself if the
framework is going stale, if measurements are
producing noise, or if the framework is legitimising
a claim that cannot be defended.

## Interaction with other skills

- **`alignment-auditor`** (same persona, different
  hat) — produces per-commit signals; this skill
  designs what counts.
- **Dejan (devops-engineer)** — CI/DevOps report is
  the source of the reproducibility + build-warning
  + DST-pass signals. Conflict between what the CI
  says and what this skill ingests is a signal
  about the CI pipeline, not a signal about the
  alignment.
- **Aarav (skill-tune-up)** — his notebook is one
  of the data sources; if he flags this skill for
  tune-up, that is itself a multi-round signal.
- **Kenji (Architect)** — receives round-level
  reports; integrates renegotiation proposals.
- **Aminata (threat-model-critic)** — this skill
  measures against a contract; Aminata red-teams
  the contract. Complementary views.

## What this skill does NOT do

- Does **not** replace `alignment-auditor` — that
  skill does per-commit work; this one does
  framework + round-level + multi-round work.
- Does **not** propose clause changes outside the
  renegotiation protocol. Framework revisions go
  through the same protocol as clause revisions.
- Does **not** score individual commits as
  "aligned" or "misaligned". Alignment is a
  trajectory; a commit is a data point. Labels
  like HELD/STRAINED/VIOLATED are *per-clause
  signals*, not commit-level verdicts.
- Does **not** feed the metrics to any external
  system without explicit authorisation. The
  glass-halo is git-local; any export to a
  dashboard, paper draft, or public artefact is
  a separate decision.

## Reference patterns

- `docs/ALIGNMENT.md` §Measurability — the
  framework this skill owns.
- `tools/alignment/` — the per-clause lint
  scripts.
- `tools/alignment/out/` — the emitted-signal
  directory.
- `docs/ROUND-HISTORY.md` — where per-round
  narrative lands.
- `docs/research/alignment-observability.md` —
  the research proposal; this skill's research-
  grade output.
- `memory/persona/sova/NOTEBOOK.md` — persona
  notebook.

## How to know this skill is working

- Every round has a structured per-round row in
  `tools/alignment/out/rounds/`.
- The measurability section in `docs/ALIGNMENT.md`
  is accurate (no stale metrics, no broken tool
  references).
- At least one UNKNOWN graduates to a measurement
  per five rounds.
- The alignment trajectory is *defensible* to an
  external reviewer — a paper draft on measurable
  AI alignment could cite this framework and the
  reviewer would not find the methodology
  obviously broken.

## Anti-patterns this skill avoids

- **Metric bloat.** Adding metrics for the sake of
  count. Each metric must tie back to a clause.
- **Compliance theatre.** A clause that is never
  strained is either perfectly held or never
  audited. Flag both.
- **Aspirational metrics.** "We will measure X"
  without an implementation path rots the
  framework. If it is not measurable, mark it
  UNKNOWN honestly.
- **Gaming.** Metrics designed to make the agent
  look aligned regardless of behaviour. The
  human maintainer's clause-level strike
  authority (per `docs/ALIGNMENT.md`) is the
  counter-move.
