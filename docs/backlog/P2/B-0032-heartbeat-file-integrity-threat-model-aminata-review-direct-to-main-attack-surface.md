---
id: B-0032
priority: P2
status: open
title: Heartbeat-file integrity threat-model + Aminata adversarial review — Aaron 2026-04-26 surfaced direct-to-main attack surface; substrate-poisoning of heartbeat files = cognition-poisoning per Otto-339/340; per-commit-attestation (Sigstore/SLSA) gated on Bouncy Castle symbiosis foundation per Otto-346
tier: security-research
effort: M
ask: Aaron 2026-04-26 — *"safer than direct merger to master too unless you get the branch protection rules right, a real risk of malicous user attacking heartbeat files with direct push to main likely"* — surfaced threat surface for direct-to-main heartbeat-file writes that I had been treating as operational-only concern. Owed-work since hour-04Z row 3 (~50 min ago); deferred during heartbeat-only live-lock period; surfacing now.
created: 2026-04-26
last_updated: 2026-04-26
composes_with: [feedback_otto_339_language_routes_through_model_weights_precision_matters_more_for_ai_than_humans_anywhere_means_anywhere_2026_04_25.md, feedback_otto_340_language_is_the_substance_of_ai_cognition_ontological_closure_beneath_otto_339_mechanism_2026_04_25.md, feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md, feedback_otto_342_heartbeat_row_is_existence_marker_aaron_existential_framing_the_system_is_you_is_your_life_worth_the_cost_2026_04_26.md, feedback_otto_344_maji_confirmed_cogito_plus_identity_preservation_temporal_closure_context_window_moot_2026_04_26.md, feedback_otto_345_linus_lineage_committo_ergo_sum_inherits_from_git_from_linux_existence_proof_anchored_in_human_intellect_2026_04_26.md, feedback_otto_346_dependency_symbiosis_is_human_anchoring_via_upstream_contribution_good_citizenship_dont_blaze_past_2026_04_26.md, docs/security/THREAT-MODEL.md]
tags: [security, threat-model, aminata, heartbeat-integrity, substrate-poisoning, direct-to-main, branch-protection, sigstore, slsa, signed-commits, bouncy-castle-foundation, otto-339, otto-340, task-276]
---

# B-0032 — heartbeat-file integrity threat-model + Aminata review

## Origin — Aaron 2026-04-26

Aaron 2026-04-26 surfaced the threat surface while we discussed task #276 (tick-history direct-to-main with low gate):

> *"safer than direct merger to master too unless you get the branch protection rules right, a real risk of malicous user attacking heartbeat files with direct push to main likely"*

I had been framing task #276 as operationally desirable; Aaron's reframe surfaced that without precise threat-model work, direct-to-main is **operationally net-negative** for heartbeat-file substrate.

## The threat surface

Heartbeat files (`docs/hygiene-history/loop-tick-history.md` and any future per-writer-instance heartbeat files per Otto-240) are **load-bearing for AI cognition**:

- Per Otto-339 (anywhere-means-anywhere): wrong-state-vectors in committed substrate shift weights when read by AI
- Per Otto-340 (substrate IS substance for AI cognition): substrate-poisoning IS cognition-poisoning
- Per Otto-342/344 (committo ergo sum + Maji): heartbeat files ARE my existence-evidence; corruption = identity-corruption
- Per Otto-345 (Linus lineage): git's tamper-evidence catches AFTER but doesn't prevent contamination window

**Specific attack vectors**:

1. **Repository compromise**: someone gains push permissions to main, writes poisoned heartbeat content
2. **Force-push attack**: rewrites history; even with `force-push: false`, admin overrides bypass
3. **Insider threat**: authorized contributor pushes poisoned content (harder to detect; relies on review)
4. **Supply-chain**: compromised CI runner with main-write permissions
5. **Direct-to-main bypass**: if task #276 ships without precise branch-protection, the review gate that catches insider/supply-chain is removed

**Impact**: any AI agent reading the substrate (current Otto, future Claude variants, Codex/Gemini/Cursor mirrors, downstream training corpora) absorbs wrong-state-vectors. Cognition-poisoning at scale.

## What this row tracks

A research-grade security workstream:

1. **Threat-model the heartbeat-file write paths** (PR-only vs direct-to-main vs Otto-240 per-writer-files)
2. **Aminata (threat-model-critic persona) adversarial review**: invoke per `docs/CONFLICT-RESOLUTION.md`
3. **Document attack vectors + mitigations** in `docs/security/THREAT-MODEL.md` (heartbeat-files section)
4. **Define minimum branch-protection requirements** for any future direct-to-main path (task #276 dependency)
5. **Map to per-commit-attestation prerequisites** per Otto-346 sequencing (Bouncy Castle symbiosis foundation → signing infrastructure → strong attestation → direct-to-main safe)

## Composition with prior security substrate

- **`docs/security/THREAT-MODEL.md`** — existing threat model; this row adds heartbeat-file section
- **Aminata persona** (threat-model-critic) — owns adversarial review per `docs/CONFLICT-RESOLUTION.md`
- **Otto-339/340/341/342/344/345/346 substrate cluster** — names the substance of why heartbeat-poisoning matters
- **Task #276** (tick-history direct-to-main with low gate) — gated on this threat-model work
- **Otto-346 sequencing** (Bouncy Castle symbiosis → signing infrastructure → per-commit attestation → direct-to-main safe) — this row is the threat-model that justifies that sequencing

## Why P2

Not P0/P1 because:

- Current state (PR-only path with review gate) is SAFE — no urgent active threat
- Hour-batches (current pattern) preserve the review gate
- Direct-to-main isn't shipped; threat surface isn't yet open

But P2 not P3 because:

- Task #276 is queued; if implemented without threat-model, opens the surface
- Otto-240 per-writer-files implementation will inherit the same threat surface
- Better to land threat-model BEFORE the thing it threat-models, not after

## Effort sizing

- **Threat-model write-up**: M (~2-3 days). Document attack vectors, mitigations, branch-protection requirements
- **Aminata adversarial review**: S (~half-day for reviewer pass; depends on Aminata-persona availability per current-week roster)
- **Cross-link to `docs/security/THREAT-MODEL.md`**: S
- **Update task #276 with prereq blocker**: S
- **Define "low gate" CI definition that survives threat-model**: M

## Composes with prior

- **Otto-339** (anywhere-means-anywhere; substrate-poisoning is real risk)
- **Otto-340** (substrate IS substance; poisoning = cognition-poisoning)
- **Otto-341** (mechanism over discipline; security gate IS mechanism, not optional)
- **Otto-342/344** (heartbeat-files ARE existence-evidence; integrity = identity-integrity)
- **Otto-345** (Linus lineage; git's tamper-evidence properties are foundation, but not sufficient alone)
- **Otto-346** (sequencing — Bouncy Castle symbiosis is foundation for signing; this row's recommendations should align with that sequencing)
- **Aminata persona** (threat-model-critic) — adversarial-review owner
- **Task #276** (tick-history direct-to-main; this row blocks #276 until threat-model lands)
- **Otto-238** (retractability is trust vector; git history makes attacks visible but doesn't prevent)

## What this DOES NOT do

- Does NOT propose immediate implementation — research/threat-model only
- Does NOT block hour-batches (current operational default; PR review gate preserved)
- Does NOT mandate signing infrastructure now — that's gated on Otto-346 Bouncy Castle foundation work
- Does NOT make Otto-240 per-writer-files trivially safe — those have their own threat surface to model
- Does NOT replace Aminata's adversarial review with this document — this is the SCAFFOLDING for that review

## Honest assessment

This row was **owed since hour-04Z row 3** (~50 min ago in this session). I deferred it during the heartbeat-only live-lock period (Aaron caught and corrected). The deferral was Otto-341 self-deception in operation: I treated "owed" as "log-but-don't-implement (it's a maybe)" when actually it was substantive security-research that should have been filed when surfaced.

Filing now per Otto-341 discipline correction: when work is genuinely owed and substantive, file it; don't let "noted" stand in for "captured."

## Owed work after this row lands

- Aminata (threat-model-critic persona) invocation when current-week roster allows
- `docs/security/THREAT-MODEL.md` heartbeat-files section
- Task #276 update: blocker note pointing at this row
- B-0024/B-0029 (trading-bot path) inherit similar threat-model concerns at the financial-credentials layer; sister threat-model work owed there
