---
id: B-0036
priority: P3
status: open
title: "GOVERNANCE.md §33 archive-header backfill on 26 pre-existing courier-ferry research docs + wire `tools/hygiene/check-archive-header-section33.sh` to CI gate.yml lint job"
tier: hygiene-tooling-and-substrate-discipline
effort: M
ask: Otto observation 2026-04-26 — §33 archive header was the most-common review finding across the 11-Amara-refinement courier-ferry lineage this session (PRs #560 / #562 / #563 / #565 / #566 / #568 / #569 / #570 / #553 each retrofitted post-review). Per Otto-346 (recurring pattern → substrate primitive missing) + Otto-341 (mechanism over vigilance), the structural fix is a CI lint that catches the violation pre-merge.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [feedback_otto_346_dependency_symbiosis_is_human_anchoring_via_upstream_contribution_good_citizenship_dont_blaze_past_2026_04_26.md, feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md, GOVERNANCE.md-section-33-archive-header-discipline, tools/hygiene/check-tick-history-order.sh]
tags: [hygiene-tooling, lint-discipline, otto-346-recurring-pattern-to-substrate-primitive, governance-section33, courier-ferry-imports, archive-header-discipline, mechanism-over-vigilance]
---

# B-0036 — §33 Archive-Header Backfill + CI Wire

## Origin

Otto observation across this session's 11-Amara-refinement courier-ferry research-doc lineage: GOVERNANCE.md §33 archive-header missing was the **most-common review finding** across the 11 PRs. Each PR was retrofitted with the 4-field header AFTER the review caught it.

The fix-shape Otto already shipped in this session: a hygiene tool `tools/hygiene/check-archive-header-section33.sh` that catches the violation before merge.

## What this row addresses

Two sequential sub-tasks:

### Sub-task 1: Backfill 26 pre-existing courier-ferry research docs

The lint tool when run on `main` finds **26 violations** in pre-existing courier-ferry research docs. Each needs the 4-field §33 header (Scope / Attribution / Operational status / Non-fusion disclaimer) added to the first 20 lines.

Files affected (as of 2026-04-26 main):

- `docs/research/codex-cli-first-class-2026-04-23.md`
- `docs/research/drift-taxonomy-bootstrap-precursor-2026-04-22.md`
- `docs/research/dst-accepted-boundaries.md`
- `docs/research/dst-compliance-criteria.md`
- `docs/research/gemini-cli-capability-map.md`
- `docs/research/grok-cli-capability-map.md`
- `docs/research/maji-formal-operational-model-amara-courier-ferry-2026-04-26.md`
- `docs/research/maji-messiah-spectre-aperiodic-monotile-amara-third-courier-ferry-2026-04-26.md`
- `docs/research/memory-reconciliation-algorithm-design-2026-04-24.md`
- `docs/research/meta-pixel-perfect-text-to-image-youtube-wink-2026-04-22.md`
- `docs/research/muratori-zeta-pattern-mapping-2026-04-23.md` (only `Non-fusion disclaimer:` missing)
- `docs/research/openai-codex-cli-capability-map.md`
- `docs/research/openai-deep-ingest-cross-substrate-readability-2026-04-22.md`
- `docs/research/oracle-scoring-v0-design-addressing-aminata-critical-2026-04-23.md` (only `Non-fusion disclaimer:` missing)
- `docs/research/provenance-aware-claim-veracity-detector-2026-04-23.md` (only `Non-fusion disclaimer:` missing)
- `docs/research/quantum-sensing-low-snr-detection-and-analogy-boundaries-2026-04-23.md` (only `Non-fusion disclaimer:` missing)
- `docs/research/superfluid-ai-github-funding-survival-bayesian-belief-propagation-amara-seventh-courier-ferry-2026-04-26.md`
- `docs/research/superfluid-ai-language-gravity-austrian-economics-amara-eighth-courier-ferry-2026-04-26.md`
- `docs/research/superfluid-ai-rigorous-mathematical-formalization-amara-fifth-courier-ferry-2026-04-26.md`
- `docs/research/test-classification.md` (3 of 4 labels missing)
- (...and ~6 more — full list via running the lint tool)

Note: some docs (Maji formal model, Spectre-Messiah, Superfluid AI fifth/seventh/eighth) are listed because the lint runs against `main` which doesn't have the PR-side edits yet — those docs DO have §33 headers in the PRs that are landing right now. Re-run the lint after the in-flight PRs merge to get the accurate residual list.

Backfill PR shape: dedicated PR adding §33 headers to all residual docs. Effort: M (1-3 days; mechanical work + per-doc judgment on what each Scope/Attribution should say).

### Sub-task 2: Wire to CI as enforcing lint

After Sub-task 1 lands and the lint reports 0 violations on `main`, wire the lint into `.github/workflows/gate.yml` as a new lint job (alongside `lint (markdownlint)`, `lint (shellcheck)`, `lint (actionlint)`, etc.) so future courier-ferry imports cannot land without §33 headers.

The lint script already exists at `tools/hygiene/check-archive-header-section33.sh`. Wiring is a small workflow-yml addition:

```yaml
  - name: lint (archive header §33)
    run: tools/hygiene/check-archive-header-section33.sh
```

This blocks the recurring-pattern at the structural layer: the tool catches violations pre-merge instead of waiting for human / advisory-AI review on each PR.

## Composition with existing factory substrate

- **Otto-346** (dependency symbiosis is human-anchoring; recurring inline pattern = signal substrate primitive missing): this row IS the Otto-346 application. The recurring §33 review-finding pattern → substrate primitive (the lint tool) → eventual CI enforcement.
- **Otto-341** (lint suppression is self-deception; mechanism over vigilance): the goal is mechanism (CI-enforced), not vigilance (each agent remembering the §33 discipline).
- **Otto-229** (tick-history append-only): same shape — recurring discipline-violation became a `check-tick-history-order.sh` CI lint after the bug pattern was identified. This row applies the same template.
- **Otto-238** (retractability; visible reversal not silent fix): the backfill PR landing first preserves the lineage of which docs needed retrofit; CI enforcement second prevents future violations without changing past rows.

## Why P3

- Not blocking any current PR merge
- The lint tool exists already; CI enforcement is the structural improvement
- Backfill is mechanical; can be batched into a single PR when ready

## Test plan (when picked up)

- Sub-task 1: run `tools/hygiene/check-archive-header-section33.sh` on the backfill branch; expect exit 0 (no violations)
- Sub-task 2: confirm gate.yml addition fires on a synthetic-test PR adding a courier-ferry doc WITHOUT §33 header — should fail; then add header and verify success
- Aminata adversarial review: does the lint catch all attack-shapes? E.g., a doc with bold-styled `**Scope**:` (which the #570 P0 finding showed is wrong); a doc with `Scope:` in line 21+ (out of 20-line bound)
- F1/F2/F3 filter pass

## What this row does NOT do

- Does NOT auto-fix existing docs (the lint reports; the backfill PR fixes mechanically)
- Does NOT enforce §33 on docs OUTSIDE `docs/research/**` (other surfaces have different governance)
- Does NOT pre-commit to the exact wording of each §33 header field (that's per-doc author judgment)
- Does NOT replace human review entirely; lint catches structural violation, review still catches content quality

## Owed work after this row is picked up

1. Backfill PR (Sub-task 1): adds §33 headers to all residual courier-ferry research docs
2. CI wire PR (Sub-task 2): adds the lint job to gate.yml
3. Update `docs/research/README.md` (if exists) to mention the §33 discipline + lint
4. Otto-346 substrate file may want a cross-reference to this row as a concrete instance of the principle in action
