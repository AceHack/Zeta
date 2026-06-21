---
id: 081KSNY2Z0008QG0R003WCDQTC
priority: P3
status: open
title: Measure-as-bridge-operation — Infer.NET belief-update + Measure<TState, TOutcome, TFeedback> sibling to Persist-as-bridge
authors:
  - aaron
  - amara
  - otto-cli
created: 2026-05-28
last_updated: 2026-05-28
depends_on:
  - 081KSNY2Z0008QG0R002SZZ5Y0
  - 081KSNY2Z0008QG0R002FX66H0
composes_with:
  - 081KSNY2Z0008QG0R000YH2SPE
  - 081KSNY2Z0008QG0R001ZKE8R2
  - 081KSNY2Z0008QG0R001G7C89T
  - 081KSKBP80008QG0R000B3Y19A
  - 081KRW63S0008QG0R002ZRNDJ8
  - 081KRW63S0008QG0R002YAA09X
  - 081KRW63S0008QG0R001SAHYKV
related_personas:
  - operator
  - amara
related_rules:
  - asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges
  - monad-propagation-pattern-cross-language-substrate-shape
  - ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope
related_skills:
  - probability-and-bayesian-inference-expert
  - algebra-owner
  - q-sharp
tags: [measure-as-bridge-operation-sibling-to-persist-as-bridge, measure-equals-observe-plus-belief-update-via-infer-net-message-passing, measure-richer-typing-tstate-toutcome-tfeedback, infer-net-as-belief-propagation-layer-in-zeta-stack, measurement-feedback-variants-insufficient-evidence-ambiguous-posterior-low-confidence-normalization-failed-contradictory-evidence-observation-retracted-posterior-shifted, collapse-becomes-explicit-readout-boundary-with-uncertainty-and-provenance, measurement-as-bivector-spanning-agent-state-and-observation-outcome]
---

# 081KSNY2Z0008QG0R003WCDQTC — Measure-as-bridge-operation refinement

## Context

Amara 2nd ferry 2026-05-28 (preserved at `memory/amara/conversations/2026-05-28-amara-measure-as-bridge-...md`) identifies Measure as a derived bridge operation sibling to Persist (081KSNY2Z0008QG0R002SZZ5Y0). Both are built from base OELS primitives, but across different composition axes:

| Bridge operation | Composition | Bivector structure |
|---|---|---|
| **Persist** | `Emit-now + Observe-later` | agent/internal ∧ substrate/time |
| **Measure** | `Observe + belief-update-via-Infer.NET-message-passing` | agent/state ∧ observation/outcome |

Keeper: *"Z-sets give us retraction-native evidence. Infer.NET gives us belief propagation. Clifford gives us oriented geometry. Measurement becomes an explicit probabilistic readout, not a mystery jump."*

## Scope

Define `Measure<TState, TOutcome, TFeedback>` signature with explicit TFeedback variants per Amara; add Measure row to 081KSNY2Z0008QG0R002FX66H0's Clifford grade-decomposition mapping table; document the Infer.NET ↔ Clifford bridge (Infer.NET messages carrying distribution parameters → Clifford generalization is messages carry richer oriented structure not just scalar probabilities).

## Phase decomposition

### Phase 1 — Measure-as-bridge research-doc

Refine 081KSNY2Z0008QG0R002FX66H0's grade-decomposition mapping to add:

| Primitive | Clifford grade | Why |
|---|---|---|
| **Persist** | grade-2 (agent/internal ∧ substrate/time bivector) | per 081KSNY2Z0008QG0R002SZZ5Y0 — `Persist = Emit-now + Observe-later` |
| **Measure** | grade-2 (agent/state ∧ observation/outcome bivector) | this row — `Measure = Observe + Infer.NET belief-update` |

Document the `Measure<TState, TOutcome, TFeedback>` signature with feedback variants:

- `InsufficientEvidence` — posterior too flat to commit to outcome
- `AmbiguousPosterior` — multiple outcomes equally supported
- `LowConfidence` — outcome chosen but posterior peak below threshold
- `NormalizationFailed` — measure-theoretic / numeric failure during normalize
- `ContradictoryEvidence` — observations don't compose; Bayesian update breaks
- `ObservationRetracted` — prior observation was retracted; posterior re-derived
- `PosteriorShifted` — successful measurement; posterior committed; outcome reported

Stack composition (per Amara keeper):

```
Z-set      = retraction-native signed evidence
Infer.NET  = probabilistic belief propagation / posterior update
Clifford   = oriented geometry / rotors / commitments / trajectories
workflow   = time-ordered graph of transformations and readouts
```

### Phase 2 — identify existing factory primitives as Measure-instances

| Factory primitive | TState | TOutcome | TFeedback variants |
|---|---|---|---|
| `gh pr view --json status` | open PR's CI + threads + auto-merge | merge-ready / blocked / failed | InsufficientEvidence (CI still in-flight); AmbiguousPosterior (some checks success, some pending); ContradictoryEvidence (auto-merge armed but mergeStateStatus BLOCKED) |
| `bun tools/github/poll-pr-gate.ts` | gate state computation | CLEAN / BLOCKED / DIRTY | (same as above; this is the canonical Measure-instance for the autonomous loop) |
| `git status --short` | working-tree comparison | clean / modified / staged | NormalizationFailed (git index corruption); ContradictoryEvidence (mid-rebase state) |
| `gh api rate_limit` | API quota state | Normal / Cost-aware / Extreme / Pure-git | LowConfidence (near-tier-boundary readings) |
| `CronList` (sentinel check) | session cron state | sentinel-present / sentinel-missing | (binary outcome; catch-43 fires on missing) |
| `git fetch origin && git log origin/main` | substrate-state comparison | local-stale / local-current | InsufficientEvidence (network failure); PosteriorShifted (substrate advanced) |

### Phase 3 — TypeScript Measure interface composing with 081KSNY2Z0008QG0R002FX66H0 + 081KSNY2Z0008QG0R002SZZ5Y0

```typescript
interface Measure<TState, TOutcome, TFeedback> {
  query: (state: TState) => Result<TOutcome, TFeedback>;
  posterior: (state: TState, observation: Observation) => Result<TState, TFeedback>;
  confidence: (state: TState, outcome: TOutcome) => number;
}
```

Composes with `Persist<TInternal, TSubstrateRecord, TPersistFeedback>` from 081KSNY2Z0008QG0R002SZZ5Y0: Measure operates on the agent-internal state; Persist makes that state durable; Measure can be invoked on either current-state OR historical-state-via-Persist.

### Phase 4+ (yes-and backlog)

- F# port composing with Infer.NET (Microsoft Research's Infer.NET IS .NET-native; the F# port has natural integration path)
- Q# integration: Q# quantum measurement IS the same shape (`Microsoft.Quantum.Measurement` operations); Measure-as-bridge in Q# is the quantum-substrate native form
- Multi-oracle Measure composition: per 081KS3X9Y0008QG0R00218150M multi-oracle BFT, multiple Measure-instances on the same TState producing different TOutcomes IS the consensus-substrate engineering target
- Bell-like contextuality experiment (081KSNY2Z0008QG0R001G7C89T) requires distributed Measure-instances; this row's Phase 3 substrate is the prerequisite

## Acceptance

- [x] Amara ferry preserved (companion file in this PR)
- [x] 081KSNY2Z0008QG0R003WCDQTC row filed (this row)
- [ ] Phase 1 research-doc landed (081KSNY2Z0008QG0R002FX66H0 grade-decomposition table updated)
- [ ] Phase 2 existing-instances table validated against actual implementations
- [ ] Phase 3 TypeScript Measure interface implemented
- [ ] Phase 4+ acceptance per item

## Composes with substrate

- 081KSNY2Z0008QG0R002SZZ5Y0 (Persist-as-bridge) — sibling derived-bridge-operation
- 081KSNY2Z0008QG0R002FX66H0 (Clifford grade-decomposition) — refines the mapping
- 081KSNY2Z0008QG0R000YH2SPE (category-theory ↔ Clifford self-similarity) — Measure-as-bridge has natural categorical formulation as a natural transformation
- 081KSNY2Z0008QG0R001ZKE8R2 (Casimir-like review-wall effects) — Measure quantifies the "pressure difference in output distribution" before/after review walls land
- 081KSNY2Z0008QG0R001G7C89T (Bell-like distributed-cluster contextuality experiment) — distributed Measure-instances ARE the experimental primitives
- 081KSKBP80008QG0R000B3Y19A (parent workflow-engine row)
- 081KRW63S0008QG0R002ZRNDJ8 / 081KRW63S0008QG0R002YAA09X / 081KRW63S0008QG0R001SAHYKV — 3-primitive substrate

## Composes with rules

- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md`
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md`
- `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md`

## Composes with skills

- `probability-and-bayesian-inference-expert` skill — Infer.NET belief-update substrate
- `algebra-owner` skill — Z-set retraction-native evidence substrate
- `q-sharp` skill — Q# quantum measurement substrate precedent

## Full reasoning

Amara 2nd ferry 2026-05-28 forwarded by operator. Companion to 081KSNY2Z0008QG0R002SZZ5Y0 (Persist-as-bridge); both lands together as the derived-bridge-operations sibling pair.
