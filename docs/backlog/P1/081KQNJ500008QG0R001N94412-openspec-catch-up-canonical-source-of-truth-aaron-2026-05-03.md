---
id: 081KQNJ500008QG0R001N94412
priority: P1
status: open
title: OpenSpec catch-up — restore OpenSpec capabilities as canonical source-of-truth (Aaron 2026-05-03 architectural-debt naming; "if we deleted everything other than it [OpenSpec]")
tier: foundation
effort: L
ask: Aaron 2026-05-03 verbatim *"openspec which we are way behind on, that's suppsed to be our source of truth lol, if we were to delete everyting other than it"*
created: 2026-05-03
last_updated: 2026-05-31
depends_on: []
decomposition: decomposed
composes_with: [081KQ3HBZ0008QG0R002S674CG, 081KQJZR90008QG0R002D6XYHB, 081KQNJ500008QG0R003SCWBDV, 081KQNJ500008QG0R001VGMS5G, 081KQNJ500008QG0R003ZC6PK8, 081KQR4HQ0008QG0R001909FPT]
tags:
  [
    openspec,
    source-of-truth,
    foundation,
    architectural-debt,
    contract-based-development,
    spec-based-development,
    p1-foundation,
  ]
type: friction-reducer
---

# OpenSpec catch-up — restore OpenSpec as canonical source-of-truth

Aaron 2026-05-03, in the autonomous-loop maintainer channel via the skill-design memo (`feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md`), named OpenSpec catch-up as load-bearing architectural debt:

> _"openspec which we are way behind on, that's suppsed to be our source of truth lol, if we were to delete everyting other than it"_

The intended state per `openspec/README.md`: capabilities under `openspec/specs/**` carry behavioral specs that the code is supposed to satisfy. Specs are canonical; code + skills + memos + docs all derive from / serve / reference the specs.

**Current state (2026-05-03):** specs are sparse; most discipline lives outside specs (memos, CLAUDE.md, GOVERNANCE.md). The _"if we deleted everything but OpenSpec, the project would be lost"_ test FAILS today.

This row tracks the catch-up work needed to restore OpenSpec as actual source-of-truth.

## Current checkpoint (2026-05-31)

The row's 2026-05-03 baseline is stale. The current mechanized inventory
surface is `tools/openspec/inventory.ts`, and the latest focused run reports:

- `openspec/specs/**`: 9 capability specs with `spec.md` files. The
  README-only `openspec/specs/retraction-native/` directory remains background
  material, not an input to the strict unmapped-spec gate.
- `src/Core/*.fs`: 84 scanned modules, 18 covered modules, 64 uncovered
  modules after exclusions.
- Artifact coverage: 22 mapped artifacts across agentic-organization,
  Z-set algebra, and tick-history; 0 missing mapped artifacts.
- Inventory gate: PASS under the current default gate.
- Strict unmapped-spec gate: PASS with `--fail-on-unmapped-specs`.

This means the next 081KQNJ500008QG0R001N94412 slice is no longer "prove OpenSpec is empty." The
work is now reconciliation: continue mapping artifact-backed capabilities,
decide which open child rows are already satisfied by existing specs, and add
one bounded capability mapping or child-row correction per PR. Avoid touching
`docs/BACKLOG.md` while active backlog-index claims own it.

The current child-row sequence is:

- `081KSNY2Z0008QG0R003YZ3JXC` - author the Z-Set Algebra spec.
- `081KSNY2Z0008QG0R000XVGWA8` - author the Tick-History Schema spec.
- `081KSNY2Z0008QG0R0016VFTRX` - author the Retraction-Native Semantics spec.
- `081KSXN940008QG0R003DWYYA6` - author the Backlog Row Schema spec.

The parent row is marked `decomposition: decomposed` so autonomous pickup can
descend into the open atomic child rows instead of repeatedly selecting the
parent for another decomposition pass.

## Why P1 (foundation)

- Aaron's same-tick framing names OpenSpec catch-up as **load-bearing prerequisite** for Rule 3 (skill-domain packaging + harness hooks for contracts) to fully operationalize
- The skill-design rules in `feedback_skills_as_carved_sentences_*` recursively compose at the spec layer: skill body / command / skill domain / cross-skill contracts / **spec** — without the spec layer current, the recursion is incomplete
- Contract-based development (Meyer, Eiffel) / Design-by-Contract / spec-based development is what hooks-as-pre/post-conditions plug into; without specs, the contracts have no reference

## Scope (incremental, not big-bang)

The catch-up is **NOT** a single big-bang spec authoring pass. It's incremental backfilling of the most load-bearing capability surfaces FIRST, then extending coverage. Per Aaron's _"foundation right and deliberate"_ guidance, quality > coverage.

### Phase 1 — Inventory + sequencing

1. Audit current `openspec/specs/**` — what capabilities exist? what's stale? what's empty?
2. Compare against the project's actual hot-path code (Z-set algebra, DBSP operators, retraction-native semantics, tick-history schema)
3. Identify the top-10 capabilities by load-bearing-weight — these are the catch-up targets
4. Sequence: spec the most-foundational first (algebra > operators > DBSP > retraction-native > tick-history > backlog row schema > skill-router shape > harness contracts)

### Phase 2 — Author the top-10 specs

Per `openspec/README.md` modified-fork conventions (no archive, no change-history). Each spec lands its own PR. Reviewer surface: spec-zealot (Viktor) — adversarial pass on each spec.

### Phase 3 — Cross-reference + tooling

- Update `CLAUDE.md` + `AGENTS.md` to make OpenSpec the FIRST-READ surface (above current load order)
- Add CI check: every load-bearing change references a spec in `openspec/specs/**`
- Add `tools/openspec/` tooling for spec-to-code drift detection (probably builds on `tools/substrate-claim-checker/` v1+)

### Phase 4 — Validation

The _"if we deleted everything but OpenSpec, the project would be lost"_ test is the acceptance criterion. When all 4 phases complete, that test should NOT fail.

## Why this matters now

- Multiple just-landed memos (`feedback_skills_as_carved_sentences_*`, `feedback_multi_harness_alignment_convergence_*`, `feedback_git_native_backlog_management_*`, `feedback_verify_then_claim_*`) reference OpenSpec as the long-term canonical surface. Each adds substrate that should eventually have spec backing.
- The substrate-claim-checker tool (081KQNJ500008QG0R003SCWBDV) v1+ work for hook integration depends on contract-based development, which depends on specs being current.
- Plugin packaging (081KQNJ500008QG0R001VGMS5G) depends on specs as the contract carriers.

## Out of scope

- Adopting upstream OpenSpec workflow as-is (the project uses a modified fork; modifications stay)
- Single big-bang spec authoring (incremental per Phase 1-4 above)
- Replacing CLAUDE.md / AGENTS.md / GOVERNANCE.md (OpenSpec is the _contract_ layer; those remain the _behavioral guidance_ + _governance_ layers — they reference the contracts)

## Composes with

- **081KQ3HBZ0008QG0R002S674CG** (AI ethics + safety research track) — alignment specs are one class of OpenSpec capability that needs catch-up
- **081KQJZR90008QG0R002D6XYHB** (decision-archaeology skill) — once specs are current, `docs/DECISIONS/` ADRs cross-reference specs; decision-archaeology composes naturally
- **081KQNJ500008QG0R003SCWBDV** (substrate-claim-checker TS tool) — v1+ hook integration depends on specs as contract carriers
- **081KQNJ500008QG0R001VGMS5G** (skill-domain plugin packaging) — skill domains expose contracts; contracts live in specs
- **081KQNJ500008QG0R003ZC6PK8** (hook authoring for skill-creation contracts) — pre/post-conditions are spec-encoded; hooks read them
- `memory/feedback_skills_as_carved_sentences_knowledge_in_docs_datavault_2_0_pattern_aaron_2026_05_03.md` — the memo naming this catch-up as load-bearing
- `openspec/README.md` — the canonical-intent doc; reading order is OpenSpec first per the future state
- `memory/feedback_rule_number_two_assume_its_on_backlog_and_find_it_with_all_dependencies_and_updates_and_clean_up_the_dependson_chain_aaron_2026_05_05.md` — Rule #2 (assume-it's-on-backlog + walk depends_on); OpenSpec catch-up IS the spec-side analogue (assume the contract already exists, find it, walk its composes-with chain).
- `memory/feedback_rule_number_three_assume_an_orthogonal_trajectory_already_exists_for_the_thing_find_it_aaron_2026_05_05.md` — Rule #3 (assume-trajectory-exists); OpenSpec catch-up is itself the spec-class trajectory anchor.

## Done-criteria

This row closes when:

1. The top-10 load-bearing capability surfaces have current OpenSpec specs (Phase 2 complete)
2. CI gate enforces "every load-bearing change references a spec" (Phase 3 complete)
3. CLAUDE.md + AGENTS.md updated to make OpenSpec FIRST-READ (Phase 3 complete)
4. The _"delete everything but OpenSpec"_ test passes (Phase 4 complete)

Until done, this row stays open. Per Aaron's _"WONT-DO is 99% deferral, not forever — we will likely do everything eventually"_, the catch-up is on the long arc.
