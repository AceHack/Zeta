---
id: B-0145
priority: P1
status: open
title: Product Manager (PM-2) role — research-to-predict-features-before-friction
created: 2026-05-01
last_updated: 2026-05-02
decomposition: decomposed
children: [B-0270, B-0271]
depends_on: []
type: friction-reducer
---

# B-0145 — Product Manager (PM-2) role — research-to-predict-features-before-friction

## What

Define and operationalize a **Product Manager (PM-2)** role
that runs **proactive research-driven cadence** to predict
feature gaps and surface them as backlog rows BEFORE the
loop encounters them as friction. Distinct from the
**Project Manager (PM-1, Otto)** role which is
reactive/loop-driven.

## Why now

Aaron 2026-05-01:

> *"this seem like it would make my PM a real company say hey
> you know what we are missing a feature and then there is the
> other kind of (first kind being Project Manager) the 2nd
> Product Manager who should have done research to predict you
> we had the missing feature before running into the issue with
> the product."*

The parallelism scaling ladder (per
`memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`)
multiplies *throughput*, but does not change *direction*. The
direction-axis requires a role that does **forward research**
— PM-2 — distinct from the reactive-cadence role (Otto / PM-1).
Without PM-2, every feature-gap is discovered by stumbling
into it; with PM-2, gaps are queued before they block work.

Aaron's framing locates the gap precisely: *"who should have
done research to predict you we had the missing feature before
running into the issue with the product."* The counterfactual
standard (*should have*) names PM-2 by its absence.

## Scope (what PM-2 does)

1. **Forward research cadence** — weekly or per-round (longer-
   than-tick) review of:
   - `docs/TECH-RADAR.md` (Trial / Adopt / Hold rows)
   - Recent Claude.ai / Amara / peer-AI ferries (`docs/research/`)
   - Upstream-doc WebSearch per Otto-364 (search-first authority)
   - Demo target requirements (`task #244` factory-demo)
   - Consumer-facing API audits (`src/Core/**` public surface)
   - GLOSSARY churn (terms moving in vocabulary signal
     surface evolution)
   - Recent CONFLICT-RESOLUTION conferences (where a
     conference revealed a gap)
   - External attack-surface scouting (Mateo's outputs;
     PM-2 picks up what Mateo flags as not-pure-security)

2. **Feature-gap-prediction outputs** — produces backlog
   rows (B-NNNN format) for predicted gaps:
   - One row per discrete missing feature
   - Includes: signal-source (what evidence pointed to
     the gap), expected-encounter-window (when will the
     loop hit this), priority (P0/P1/P2/P3), proposed
     scope (size estimate)
   - Uses the standard `docs/backlog/<priority>/B-NNNN-*.md`
     filename pattern

3. **TECH-RADAR row updates** — promotes / demotes rows
   based on forward research:
   - Trial → Adopt when evidence accumulates
   - Adopt → Hold when an emerging better option appears
   - New rows when a watched-trajectory matures into
     evaluation-ready

4. **Forward-radar periodic memos** — short (1-2 page)
   forward-look documents at round boundaries summarizing
   *what is coming* — not the same as ROUND-HISTORY
   (backward-look). Lives at `docs/forward-radar/YYYY-MM-DD-*.md`.

## Acceptance criteria

1. **Role definition** at `docs/EXPERT-REGISTRY.md` (extend
   existing roster) defining PM-2 distinctly from PM-1
   (Otto). Persona-name to be picked via the standard
   naming-expert review process; until then, role-ref
   "Product Manager" / PM-2.

2. **Cadence schedule** — initial weekly cadence; reviewed
   after first 4 cycles. PM-2 fires on Sundays UTC (not
   tick-driven; longer-than-tick).

3. **Output template** at `docs/forward-radar/TEMPLATE.md`
   covering: signal-sources reviewed, predicted gaps
   (with B-row pointers), TECH-RADAR row changes, calibration
   note (% of last-period friction-encounters that were
   already in backlog as predicted gaps).

4. **First forward-radar memo** lands within 2 weeks of
   role activation, covering the first round's research.

5. **Calibration metric tracked** — quarterly review of
   *what % of friction-encounters in the loop were
   ALREADY in the backlog as PM-2-predicted gaps*. Target
   trajectory: starts low (PM-2 has no warm-up), rises
   over time. Metric persistence in
   `docs/forward-radar/calibration.md`.

## Quality test (the load-bearing one)

PM-2's effectiveness is **NOT** measured by:

- Volume of memos produced (memo-count is overhead)
- Volume of B-rows filed (gap-prediction-count is
  bureaucracy)

PM-2's effectiveness IS measured by:

- **Lead-time%** — of friction-encounters in the loop, what
  fraction had been predicted in the backlog before they
  surfaced? Target trajectory: 0% (cold-start) → 20%
  (calibrated) → 50%+ (mature).
- **Action-rate%** — of PM-2's predicted-gap B-rows, what
  fraction has PM-1 (Otto) picked up within 4 rounds?
  Below 20% = PM-2 is producing noise; above 80% = PM-2
  is feeding the queue effectively.

Both must be tracked. PM-2 with high lead-time but low
action-rate is producing *predictions no one trusts*; PM-2
with high action-rate but low lead-time is producing
*backlog churn that adds nothing the loop wouldn't have
caught*.

## Anti-patterns this role guards against

1. **More bureaucracy.** Research-without-action is overhead.
   PM-2 outputs land as actionable backlog rows; if PM-2 is
   producing memos no one acts on, the role is failing —
   stop, retire, fix.

2. **Authority creep.** PM-2 *predicts gaps*; PM-2 does NOT
   *decide what gets built*. The Architect (Kenji) and the
   maintainer (Aaron) decide priorities. PM-2 surfaces;
   they prioritize.

3. **Persona-sprawl.** Per
   `memory/project_loop_agent_named_otto_role_project_manager_2026_04_23.md`
   — Otto fills the hat-less default; future roles should
   not multiply persona-names without a discrete
   role-shape. PM-2 has a discrete role-shape (proactive
   research-driven, distinct from reactive loop-driven),
   which justifies the addition.

4. **Confusion with existing PM-2-flavored work.** Mateo
   (Security-Researcher) does proactive security scouting;
   Aarav (Skill-Expert) does proactive skill scouting;
   Iris (UX) and Bodhi (DX) do proactive UX/DX research
   in narrow slices. PM-2 does **not** absorb their
   scope. PM-2 owns the *integrated forward-view across
   feature/product layer*, NOT security, skills, UX, or
   DX research that already has owners.

## Out of scope (defer)

- **Persona-name pick** — defer to naming-expert review
  + maintainer nudge per the standard cadence. Until
  then, role-ref only.
- **PM-2 automation/mechanization** — initial cycles are
  human-run (or Otto-run when Otto wears the PM-2 hat).
  Mechanization candidates emerge after 3+ cycles
  surface repeatable patterns.
- **Research-budget allocation** — PM-2 is free-tier work
  initially; paid-tier expansion (e.g., scheduled remote
  routines for forward-radar generation) is a separate
  decision per
  `memory/feedback_free_work_amara_and_agent_schedule_paid_work_escalate_to_aaron_2026_04_23.md`.

## Composes with

- `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  — the architectural framing that names this role as
  the direction-axis complement to the throughput-axis
  scaling ladder
- `memory/project_loop_agent_named_otto_role_project_manager_2026_04_23.md`
  — Otto = PM-1 (reactive); this row defines PM-2 (proactive)
- `docs/EXPERT-REGISTRY.md` — extension target for the
  role definition
- `docs/TECH-RADAR.md` — primary input + output surface
  for PM-2's forward-research cadence
- `docs/CONFLICT-RESOLUTION.md` — when PM-2's predictions
  conflict with PM-1's queue, the conference protocol
  is the rail
- B-0144 — sibling rung-2 work (scaling ladder); this row
  is on the orthogonal direction-axis
- task #244 (factory-demo target) — PM-2's first concrete
  forward-research target should be: *"what features does
  the factory-demo need that we don't have yet?"*

## Effort

**M (medium, 1–3 days)** for role-definition, cadence-schedule,
output-template, and first forward-radar memo. Calibration-
metric tracking is open-ended (continues across all future
PM-2 cycles).

## Why P1 (not P0 / not P2)

- **Not P0** because the factory functions today without it
  (PM-1 reactive cadence catches gaps when they surface);
  it is a lead-time / direction unlock, not a correctness fix.
- **Not P2** because the parallelism scaling ladder
  (B-0144 et seq.) increases the COST of feature-gap
  surprises — at higher throughput, every stumble-into-a-
  missing-feature blocks more parallel lanes. PM-2 lead-time
  is the multiplier that lets the throughput-axis pay off.
- **P1** because shipping the factory-demo (task #244) is
  the next major-target, and the PM-2 forward-research
  *"what does the demo need that we don't have"* is exactly
  the kind of question PM-2 should be answering before the
  demo hits walls.
