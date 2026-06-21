---
id: 081KSKBP80008QG0R0031DTHS9
priority: P1
status: open
title: OPLE primitives implementation — extend Observe / Persist / Limit / Emit with TFeedback discriminated-unions at framework primitive substrate; cascade asymmetric-authorship + monad-propagation cluster to CORE primitives (operator 2026-05-27)
effort: L
ask: operator 2026-05-27
created: 2026-05-27
last_updated: 2026-05-27
depends_on: []
composes_with: []
tags: [framework-primitive, ople, observe, persist, limit, emit, tfeedback, monad-propagation, asymmetric-authorship, fsharp-substrate, substrate-engineering-target]
---

## Operator framing (operator 2026-05-27)

In conversation thread following Prism's iterator/generator-asymmetry
insight (PR #5517) cascading back to framework's CORE primitives:

> *"that means our core observe, emit, limit the emit needs to surface
> not just T but T, TFeedback"*

Followed by substrate-landing directive ("both" confirmation):

> *"agree"* / *"both"* (re: ship both rule landing the principle +
> backlog row decomposing the implementation work)

## What this row proposes

Implementation decomposition for the OPLE-T-TFeedback extension named
in `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md`
(filed alongside this row).

### Substrate-engineering work decomposition

| Sub-row | Scope | Effort |
|---|---|---|
| 081KSKBP80008QG0R0031DTHS9.1 | Define canonical TFeedback discriminated-union types for each OPLE primitive (ObserveFeedback / PersistFeedback / LimitFeedback / EmitFeedback) in F# substrate; document each variant's substrate-engineering scenario | M |
| 081KSKBP80008QG0R0031DTHS9.2 | Extend F# Observe primitive signature: `Observe<T>` → `Observe<T, ObserveFeedback>`; update F# implementation to return `Result<T, ObserveFeedback>`; backward-compatible adapter for legacy call sites | M |
| 081KSKBP80008QG0R0031DTHS9.3 | Extend F# Persist primitive signature + implementation + adapter | M |
| 081KSKBP80008QG0R0031DTHS9.4 | Extend F# Limit primitive signature + implementation + adapter | M |
| 081KSKBP80008QG0R0031DTHS9.5 | Extend F# Emit primitive signature + implementation + adapter | M |
| 081KSKBP80008QG0R0031DTHS9.6 | Migrate framework substrate to use extended OPLE primitives where touched; opportunistic per-PR migration discipline | L |
| 081KSKBP80008QG0R0031DTHS9.7 | Cross-language substrate (TypeScript factory tools + T-SQL data substrate + C++ perf-critical paths) per the monad-propagation-pattern rule | L |
| 081KSKBP80008QG0R0031DTHS9.8 | Spec-to-code generation target: substrate-engineering work to make the extended OPLE primitives the default emit-target of any future spec-to-code generators | L |
| 081KSKBP80008QG0R0031DTHS9.9 | F# computation expression ergonomics for OPLE composition: `ople { ... }` block that lets substrate-engineer compose Observe/Persist/Limit/Emit invocations with implicit Result.bind threading | M |
| 081KSKBP80008QG0R0031DTHS9.10 | Cross-AI-substrate ConvFeedback variant overlap: which OPLE TFeedback variants surface as conversation-interface ConvFeedback per 081KSKBP80008QG0R000N9W9XH ConvFeedback first-class substrate | M |

Each sub-row at `docs/backlog/P*/081KSKBP80008QG0R0031DTHS9.M-...md` per the subdecimal scheme when implementation-time comes.

## Why this is P1 not P2

OPLE primitives are the framework's CORE operational language. The
TFeedback extension is constitutional substrate-engineering — every
framework substrate-engineering decision invoking OPLE composes with
the extended shape. Not P0 (immediate implementation not required;
opportunistic migration suffices); P1 (substrate-engineering work
should prioritize OPLE-T-TFeedback adoption when touching primitive
invocations).

## Composes with substrate

- `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md` (filed alongside this row) — the rule landing the principle
- Mika 2026-05-18 bootstream-sovereignty-causal-loops — OPLE substrate origin
- 081KRW63S0008QG0R002ZRNDJ8 Limit-is-simulation-not-collapse — the Limit primitive's semantic
- 081KRW63S0008QG0R002YAA09X Integrate-as-choice-locus — composes with OPLE
- 081KRW63S0008QG0R002KC5DSR wave-particle-duality + 081KRW63S0008QG0R001SAHYKV English-as-projection — substrate Mika OPLE composes with
- 081KSKBP80008QG0R000N9W9XH (PR #5512) make conversation-interface ConvFeedback first-class — Observe + Emit at conversation-interface scope
- 081KRFA460008QG0R0018SN61J (F# fork for AI safety) — language-extension substrate that mechanizes the extended OPLE primitives at compile-time
- 081KSKBP80008QG0R000J2YFK2 (Nemerle dotnet support) — macro-substrate that mechanizes OPLE-T-TFeedback at syntactic scope
- 081KSGS9H0008QG0R000Q18PGQ cluster-fork-as-trust-boundary — OPLE primitives at cluster-substrate scope
- PR #5505 + #5507 + #5511 + #5513 + #5515 + #5516 + #5517 — today's substrate-engineering cluster that this row is the architectural-primitive-scope consequence of

## Composes with rules

- `.claude/rules/ople-primitives-surface-t-and-tfeedback-not-just-t-asymmetric-authorship-at-framework-primitive-scope.md` — the rule this row implements
- `.claude/rules/asymmetric-authorship-substrate-entity-defines-consent-channel-recipient-acknowledges.md` (PR #5516 in-flight) — primitive-scope instantiation
- `.claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md` (PR #5511 merged) — cross-language pattern for the implementation
- `.claude/rules/non-coercion-invariant.md` HC-8 — NCI floor at primitive scope
- `.claude/rules/tonal-momentum-equals-meme-emergent-harmonic-coercion.md` — OPLE substrate composes
- `.claude/rules/honor-those-that-came-before.md` — extends Mika's OPLE substrate

## What this row is NOT

- NOT immediate implementation priority across all framework code (opportunistic migration as substrate-engineering work touches OPLE invocations)
- NOT replacement of Mika's OPLE substrate origin (extends; preserves prior naming + semantics)
- NOT language-specific implementation mandate (rule + this row name the SHAPE; per-language instantiation handled per monad-propagation-pattern rule)
- NOT all-or-nothing (081KSKBP80008QG0R0031DTHS9.M sub-rows decompose into incremental ship)

## What this row IS

- Implementation decomposition for OPLE-T-TFeedback constitutional substrate extension
- 10 sub-rows covering F# types + per-primitive extension + downstream migration + cross-language substrate + spec-to-code + computation-expression ergonomics + ConvFeedback overlap
- Composition surface with all today's substrate-engineering cluster (PRs #5505 through #5517)
- Substrate-engineering target for future-Otto + Alexa + Riven + Vera + Lior cold-boots inheriting the extended primitives

## Substrate verification (per verify-existing-substrate-before-authoring)

Grep-substrate-inventory pass:

- `docs/agendas/`: no OPLE-implementation agenda
- `docs/trajectories/`: no OPLE-T-TFeedback trajectory
- `docs/backlog/`: no prior 081KSKBP80008QG0R0031DTHS9 row; no prior OPLE-T-TFeedback implementation row
- `.claude/rules/`: OPLE-T-TFeedback rule filed alongside this row
- `.claude/skills/`: 0 hits
- `memory/`: 0 hits on OPLE-T-TFeedback implementation
- `docs/research/`: 0 hits on specific implementation decomposition

Targeted searches: `rg -l "OPLE.*implementation|Observe.*TFeedback|ople.*extend" .claude/ docs/ memory/`

Conclusion: no prior row; mint-new authorized per operator
2026-05-27 "both" confirmation (ship rule + backlog row together).

## Heartbeat per CLAUDE.md discipline

Filing this row IS counter-reset work per `.claude/rules/holding-without-named-dependency-is-standing-by-failure.md`
condition #3 (concrete-artifact substrate). Captures operator-confirmed
constitutional substrate-engineering extension to framework's CORE
primitives so substrate exists for future-Otto cold-boots to find via
grep when OPLE-primitive substrate-engineering work needs the extension.

## Full reasoning

Operator 2026-05-27 conversation thread following Prism's iterator/
generator-asymmetry insight (PR #5517) extending today's substrate-
engineering cluster back to framework's CORE primitives:

- Prism: iterator/generator-asymmetry as canonical recipient-author-of-feedback anti-pattern
- Operator: confirmed Prism's StreamFeedback synthesis as substantive
- Operator: substrate-engineering directive cascading insight to OPLE primitives
- Otto: substrate-honest engagement + 4-primitive extension table + 6-row composition with today's cluster + offer to ship as rule + backlog
- Operator: "agree" + "both" — substrate-landing directive confirmation

This row lands the implementation decomposition; the rule (filed
alongside) names the principle. Both compose with the full 2026-05-27
substrate-engineering cluster.
