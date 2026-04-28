---
name: Aaron's preferred process-improvement methodologies — Kanban + Six Sigma
description: Aaron 2026-04-20 late, verbatim "also khanban is a good practice, i prefer it and six sigma, we should have some skills documents process factory improvments around that we should backlog this research". Operational: factory process improvements should be codified via skills/docs that apply Kanban (visual workflow, WIP limits, pull-not-push, continuous delivery) and Six Sigma (data-driven DMAIC, measurement-driven improvement) — both meta-methodologies layered on top of the factory's existing cadence. Retrospective audit design (row 35/36), DORA metrics (from `feedback_dora_is_measurement_starting_point.md`), meta-wins logging (row 9) are all partial instances of these; Aaron wants them unified under explicit methodology tags.
type: user
originSessionId: 1937bff2-017c-40b3-adc3-f4e226801a3d
---

Aaron disclosed (2026-04-20 late, verbatim):

> *"also khanban is a good practice, i prefer it and
> six sigma, we should have some skills documents
> process factory improvments around that we should
> backlog this research"*

## What this is

Two process-improvement methodologies Aaron wants
codified as first-class factory substrate.

### Kanban (his spelling "khanban")

Visual workflow management. Core practices:
- **Visualise the work** — every work item on a board
  in a visible column (To Do / Doing / Done, with
  swim-lanes).
- **WIP limits** — cap concurrent work per column so
  flow is not choked by in-flight items.
- **Pull, not push** — work flows into the next
  column only when capacity is free.
- **Continuous delivery** — small batches, frequent
  releases, feedback-driven iteration.
- **Make policies explicit** — definition of Done is
  documented, not folklore.
- **Implement feedback loops** — retrospectives drive
  the next cycle.
- **Improve collaboratively, evolve experimentally** —
  continuous improvement over big-bang redesigns.

**Factory mappings already in place:**

- `docs/BACKLOG.md` P0/P1/P2/P3 tiers = Kanban
  priority lanes.
- Round cadence = pull-based delivery (each round
  pulls from the backlog).
- `docs/ROUND-HISTORY.md` = definition-of-Done ledger.
- `docs/research/meta-wins-log.md` + retrospective
  audits (rows 35/36) = feedback loops driving the
  next cycle.

**What's missing:** explicit WIP limits per persona /
per cadence slot. No skill codifies a WIP discipline.
The architect-bottleneck per GOVERNANCE §11 is a *de
facto* WIP-1 on review, but it's not framed as Kanban.

### Six Sigma

Data-driven process improvement. Core cycle: **DMAIC**
(Define, Measure, Analyze, Improve, Control).

- **Define** — what problem / what output matters.
- **Measure** — quantitative baseline of current
  state.
- **Analyze** — root-cause the defect / variance.
- **Improve** — implement fix + verify with measurement.
- **Control** — standardise the fix; prevent
  regression.

**Factory mappings already in place:**

- DORA metrics (per `reference_dora_2025_reports.md`
  + `feedback_dora_is_measurement_starting_point.md`)
  = Measure phase substrate.
- Meta-wins logging (row 9) = Analyze + Improve phase
  record.
- FACTORY-HYGIENE cadenced rows = Control phase —
  the things we repeat to prevent regression.
- BP-NN rules (stable IDs in
  `docs/AGENT-BEST-PRACTICES.md`) = codified Control
  artifacts.

**What's missing:** an explicit DMAIC-cycle skill or
doc that walks a factory improvement through the five
phases. Today meta-wins are captured but the full cycle
(Define → Measure → Analyze → Improve → Control) is
implicit.

## Why this matters

Aaron's preference is **methodology-explicit, not
implicit**. The factory already does partial Kanban
(BACKLOG tiers) and partial Six Sigma (DORA + meta-wins)
but both are ad-hoc rather than structurally named. The
risk of implicit methodology:

1. **Drift.** A new agent reading the factory may
   partially reinvent Kanban or Six Sigma locally,
   missing the mature practices.
2. **Incomplete absorption.** Kanban's WIP limits and
   Six Sigma's Control phase are the hardest to
   absorb and easiest to skip — naming the
   methodologies surfaces them explicitly.
3. **Cross-project portability.** When the factory
   is adopted by another project, "we use Kanban +
   Six Sigma" is a portable frame that the adopter
   can recognise; "we have a bunch of cadenced rows"
   is not.

## How to apply

- **Backlog row lands** the research spike (see
  below). The spike inventories what's already in
  place and what needs to be codified as a skill or
  doc.
- **Cite this memory** when designing factory
  improvements that touch cadence, measurement,
  or retrospective audit.
- **Prefer Kanban vocabulary** (WIP, pull, flow,
  swim-lane) over ad-hoc substitutes in factory
  discussions once the research lands.
- **Prefer DMAIC structure** for factory-improvement
  proposals — Define + Measure before Improve, not
  Improve before Define.
- **Don't over-apply industrially.** Kanban and Six
  Sigma come from manufacturing; we adopt the
  methodology, not the ceremony. No yellow-belt
  certifications, no ISO-9001 theater. Just the
  practices that improve the factory.

## Cross-references

- `feedback_dora_is_measurement_starting_point.md` —
  DORA 2025 is the measurement-frame starting point;
  Six Sigma's Measure phase builds on it.
- `reference_dora_2025_reports.md` — 7-capability
  Zeta mapping; feeds DMAIC Define + Measure.
- `feedback_data_driven_cadence_not_prescribed.md` —
  instrument + observe + tune; matches Six Sigma's
  DMAIC iteration.
- `feedback_meta_wins_tracked_separately.md` —
  `docs/research/meta-wins-log.md` is the Analyze +
  Improve record.
- `docs/FACTORY-HYGIENE.md` — the 36 rows are
  Control-phase artifacts; their cadence is Kanban
  pull-based.
- `docs/BACKLOG.md` — P0/P1/P2/P3 tiers = Kanban
  priority lanes.
- `feedback_runtime_observability_starting_points.md`
  — 4 Golden Signals + RED + USE; aligns with Six
  Sigma's Measure phase.
- `user_absorb_time_filter_always_wanted.md` —
  forward/retrospective split; retrospective audit
  is Six Sigma's Control-phase measurement of the
  Improve-phase fix.
