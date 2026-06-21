---
id: 081KQGDBJ0008QG0R003VHD3KZ
priority: P2
status: open
title: Formal architecture ladder — explicit-layer-declaration discipline for B-rows
created: 2026-05-01
last_updated: 2026-05-02
depends_on: []
type: friction-reducer
---

# 081KQGDBJ0008QG0R003VHD3KZ — Formal architecture ladder — explicit-layer-declaration discipline

## What

Add a discipline (and the tooling to enforce it) where every B-row
filed against a formal-foundations item declares which layer of
the **abstraction ladder** it instantiates:

```text
  Layer 1: Category theory       (functors, morphisms, composition)
  Layer 2: Type theory / formal  (orthogonality, retractability, modal types)
  Layer 3: Class taxonomy        (v2 catalog patterns, SRE class shapes)
  Layer 4: Domain metric framework (DORA / USE / RED / Four Golden Signals)
  Layer 5: Reproducibility harness (DST + CI + lint + dashboards)
  Layer 6: Accuracy              (reproducibly-correct measurements)
  Layer 7: Quality               (the iteratively-optimized end-property)
```

Each formal-foundations B-row gets a `layer:` field in
frontmatter that names the integer 1–7. Cross-layer composition
becomes traceable; gaps become filable as sibling rows when a
declared layer has no instances above or below.

## Why now

The abstraction ladder was named explicitly by Aaron 2026-05-01:

> *"that shoud be able to go from category theroy->SRE classes->
> DORE/USE/RED/FGS quailty measurements of doman->accuracy->
> quality"*
>
> *"i probably missed some steps"*

Captured in
`memory/feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`
(PR #1116) as the formal spine connecting category-theoretic
work to operational quality. The factory has B-rows scattered
across most layers but the **layer-membership is implicit** —
there is no way to query *"which B-rows live at layer 3?"* or
*"is layer 5 underbuilt relative to layer 4?"* without manual
audit.

Making layer-membership explicit is the rung-2-of-rung-4 move
in the parallelism scaling ladder: it's a lessons-mechanization
that compounds across all future B-rows.

## Acceptance criteria

1. **Frontmatter schema extension.** `tools/backlog/generate-index.sh`
   accepts a new optional `layer: <1-7>` frontmatter field. Rows
   without it are valid (back-compat); rows with it are validated
   for integer-in-range.

2. **Generated index by-layer view.** `docs/BACKLOG.md` gains a
   new section *"By formal-architecture layer"* listing rows
   grouped by their declared layer (and a *"Unlayered"* group
   for rows without the field).

3. **Existing-row layer backfill.** A one-time PR that adds
   `layer:` to the formal-foundations B-rows already filed:
   - 081KQGDBJ0008QG0R0029JMJWE (category-theoretic compositional structure) → Layer 1
   - 081KQGDBJ0008QG0R0032X1MMC (type-theoretic orthogonality) → Layer 2
   - 081KQGDBJ0008QG0R0035M1YRC (sequent calculus for retraction) → Layer 2
   - 081KQGDBJ0008QG0R002X4AFA0 (modal logic for retractability) → Layer 2
   - 081KQGDBJ0008QG0R003NDQTBM (Tarski stratification proof) → Layer 2
   - 081KQGDBJ0008QG0R002WY918J (Code Contracts revival, when filed) → Layer 2
   - 081KQGDBJ0008QG0R0015RNK3P (pre/post pattern, when filed) → Layer 2 or 3
   - 081KQGDBJ0008QG0R002Y31XJ3 (verify-before-state-claim mechanized auditor) → Layer 5
   - 081KQGDBJ0008QG0R0021E8YZV (doc/code two-lane parallel split) → not formal-
     foundations (process row); skip layer assignment
   - 081KQGDBJ0008QG0R000RWAA67 (PM-2 role) → not formal-foundations (org row);
     skip layer assignment
   - 081KQGDBJ0008QG0R003VHD3KZ (this row) → Layer 5 (mechanizes the discipline
     itself; it's a harness for the harness)

4. **Gap detection (optional).** A simple report at
   `docs/backlog/by-layer-summary.md` (auto-regenerated)
   showing row-count per layer. Alerts on layers with zero rows
   when adjacent layers have many — signal the layer is
   underbuilt.

## Out of scope (defer)

- **Auto-classification.** Inferring layer from row content is
  a research task, not a P2 hygiene task. Manual declaration is
  the v1.
- **Cross-row layer-relationship graph.** Composing rows into a
  full graph (which row instantiates which) is a bigger design;
  this row scopes only to per-row layer-membership.
- **Process / org / hygiene rows.** Most B-rows are not
  formal-foundations rows; the `layer:` field is optional for
  those. Don't force the schema where it doesn't fit.

## Composes with

- `memory/feedback_reproducible_accuracy_before_quality_fitness_function_harness_first_aaron_2026_05_01.md`
  (PR #1116) — the substrate this row mechanizes
- `memory/feedback_parallelism_scaling_ladder_kenji_unlocked_loop_agent_doc_code_two_lane_file_isolation_peer_mode_claims_automated_best_practice_at_scale_aaron_2026_05_01.md`
  (PR #1116) — rung-4 lessons-mechanization that compounds
- 081KQGDBJ0008QG0R0029JMJWE (category theory; Layer 1)
- 081KQGDBJ0008QG0R0032X1MMC, 081KQGDBJ0008QG0R0035M1YRC, 081KQGDBJ0008QG0R002X4AFA0, 081KQGDBJ0008QG0R003NDQTBM (type theory; Layer 2)
- 081KQGDBJ0008QG0R002Y31XJ3 (mechanized auditor; Layer 5)
- `tools/backlog/generate-index.sh` — the generator that
  needs the schema extension

## Effort

**S–M (small to medium, 1–2 days)** for schema extension +
generator changes + by-layer view + initial backfill PR.
Gap-detection report is optional follow-up.

## Why P2 (not P1 / not P3)

- **Not P1** because the factory functions today without it
  (formal-foundations B-rows are findable via grep); it is a
  *visibility* / *organizational* improvement, not a
  correctness fix.
- **Not P3** because the substrate it mechanizes is freshly
  landed (PR #1116); operationalizing the discipline while the
  substrate is current beats deferring until layer-membership
  is forgotten.
- **P2** sits between — useful, not urgent. Lands when a maintainer
  has bandwidth.
