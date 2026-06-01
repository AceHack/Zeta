---
id: B-0976
priority: P1
status: open
title: "Self-evolving saga build — serialized deferred execution (Bonsai expr-tree + closure state), resume-not-replay, Temporal-grade interface, rides the Z-set/IndexedZSet ladder (Aaron 2026-06-01)"
tier: design
effort: L
created: 2026-06-01
last_updated: 2026-06-01
depends_on: [B-0640, B-0668, B-0917]
composes_with: [B-0251, B-0640, B-0668, B-0668.1, B-0706, B-0764, B-0776, B-0777, B-0785, B-0867, B-0872, B-0883, B-0917, B-0957, B-0959, B-0040, B-0253]
tags: [saga, self-evolving-saga, durable-execution, bonsai, nuqleon, reaqtor, durabletask, temporal, durable-functions, dapr, dapr-actors, dapr-workflow, orleans, z-set, indexed-z-set, retraction, otel, intrctx, kleisli, observe-loop, du-workflow, resume-not-replay, cross-language, aaron]
type: design
---

# Self-evolving saga build — serialized deferred execution, resume-not-replay, Temporal-grade interface

## Why

Aaron 2026-06-01: *"file a backlog row for the saga build."* Crystallized across
the day's framings (serialize deferred execution → subsumes Durable Functions →
closure-propagation-with-state as self-evolving sagas → every partition + cross-
partition joins → agent-mediators with compensation → composes with DU workflow →
context = OTel context → Temporal has the interface to beat). Full design +
prior-art grounding in the research note:
[`docs/research/2026-06-01-closure-propagation-with-state-as-self-evolving-sagas-...`](../../research/2026-06-01-closure-propagation-with-state-as-self-evolving-sagas-bonsai-serialized-deferred-execution-subsumes-durable-functions-rides-zset-ladder-aaron-otto.md).
This row is the **build** row; the note is the design.

## What it is

A **self-evolving saga** = `serialize(Rx / Bonsai expression-tree)` + `serialize(closure state)`
on a retraction-native (Z-set / IndexedZSet) stream:

- **resume, not replay** — restore the snapshotted closure + expr-tree directly;
  do NOT re-run the body from the start. Looser body constraints than the replay
  family (DF / Temporal / Dapr Workflow): no-handles required (same as replay),
  but **non-determinism in the body is fine** (we snapshot the value).
- **the pattern is data** — the serialized expr-tree can be edited in flight
  (retract a sub-tree, add another); the ℤ **retraction IS the pattern-evolution
  operator** (B-0668: *"saga compensation = retraction = additive inverse in
  Z-set algebra"* — this core already exists there; this row builds it). Both
  pattern AND state evolve — the superset the replay family structurally can't do.

## Interface target = Temporal (own-our-interface, meet-or-beat)

Aaron 2026-06-01: *"durable functs and especially temporal have the better
interfaces than mine; their interfaces are much better."* Target Temporal-grade
ergonomics:

- **durability-transparent body** — author writes normal code; no per-step
  hand-wrapping.
- **signals** (push into a running saga — human-in-the-loop) ↦ external events on
  the stream / the `observe→act` move-next surface.
- **queries** (read running state without advancing) ↦ a pure read of the
  context-keyed Z-set at rest.

Temporal is the **interface conformance oracle** (per
[`bcl-interface-boundary-own-your-interfaces-hexagonal`](../../../.claude/rules/bcl-interface-boundary-own-your-interfaces-hexagonal.md));
own our interface (the port), meet-or-beat it; Temporal is a design reference,
not a dependency.

## Context = OTel context = IntrCtx — and F# may not need AsyncLocal (Kleisli)

The saga **context** (state hangs off it) is the **OTel context** = **B-0917
IntrCtx** (the 5-context Kleisli propagation: memetic / prompt / trust / log /
otel). It carries identity + small hot state; the heavy serialized payload is
keyed off it in the store. Per-language propagation:

- **C# / TS — ambient `AsyncLocal` / `Activity.Current`** in-process; W3C
  `traceparent` + baggage cross-process (B-0957 scope-propagation, B-0872
  ZetaID + trace-id).
- **F# — may NOT need AsyncLocal (Aaron 2026-06-01: "f# might not need async
  local we have Kleisli arrows if it works").** Kleisli arrows thread the context
  **explicitly** through the monadic bind (B-0917 Kleisli context-propagation +
  the monad-propagation rule), so the context is a typed value, not hidden
  ambient state — cleaner, DST-friendly (no hidden mutable ambient), composable.
  **Hypothesis to validate:** if Kleisli context-threading is ergonomic enough
  (F# CE + `>=>`), F# avoids AsyncLocal entirely; AsyncLocal stays the C#/TS
  mechanism. Risk: explicit threading can be verbose — validate before committing.
  The saga interface abstracts over both (ambient adapter vs Kleisli adapter).

## Runtime — Dapr Actors carrier; per-partition + cross-partition-join mediator

- **Dapr** is the planned runtime (already deployed, B-0785). **Dapr Actors**
  (Orleans-lineage virtual actors) = the mediator **carrier** (+ the
  Durable-Entities primitive); **Dapr Workflow** (`durabletask-go`, replay
  family) = conformance oracle, NOT the self-evolving engine. Ride Dapr Actors as
  runtime/carrier + saga-**resume** for the looser constraints + self-evolution.
- **Per-partition** sagas (each shard / key-group / Orleans-grain = agent, per
  B-0706 grain identity = agent identity) + **cross-partition joins** (the
  bilinear `join` spanning shards is itself a saga) **run via an agent mediator
  whose tick stream is the carrier, holding both sides local for the CALM linear
  merge-join, with mitigation/compensation factors inside the saga** (compensate /
  retract via ℤ inverse / retry / hold-resume) for one-side failure.

## `observe.ts` generic saga combinator

A single generic combinator in `observe.ts` lifts **any lifecycle-DU workflow**
(B-0867) to a self-evolving saga: `serialize(Rx) + serialize(state)`. DU = legal
transitions (compile-time); Bonsai = serialized-mutable pattern (runtime); tick
stream = carrier; ℤ retraction = evolution + compensation.

## Build options (own-vs-Nuqleon; replay baseline)

- **Serializer:** (a) **Nuqleon Bonsai** as conformance oracle (.NET; JSON/binary;
  all nodes incl. statement) + (b) **our own cross-language Bonsai-subset**
  verified against it with shared golden vectors — the meet-in-the-middle
  discipline the algebra ladder runs (TS/F#/C#/Rust oracles). Likely both per
  `default-to-both`: Nuqleon as the .NET reference, own-subset for cross-language.
- **Closure-state half:** `src/Core/Checkpoint.fs` (mirrors Reaqtor
  `IStatefulOperator` Save/Load) — already present.
- **Replay baseline:** the replay model is ~5 primitives (step-cursor +
  cached-results + break-exception + state-provider + context) — cheap to build a
  replay-family backend if needed; resume is the superset.

## Acceptance / decomposition (slices)

- 🚧 Cross-language **Bonsai-subset serializer** (`{Context, Expression}`) +
      golden-vector cross-verify (TS/F#/C#/Rust oracles), Nuqleon as .NET oracle.
      **TS reference oracle ✅** (`src/Core.TypeScript/bonsai/` — weakly-typed /
      reflection-omitted subset: const/param/lambda/binary/call/cond; canonical
      byte-exact serialize + parse round-trip + `golden-vectors.json`; 30 tests).
      **F#/C#/Rust oracles pending** (replay the shared golden vectors).
- [ ] **Resume engine** — serialize closure + expr-tree; restore-not-replay;
      no-handles discipline enforced; non-determinism allowed.
- [ ] **Context propagation** = OTel/IntrCtx — C#/TS AsyncLocal adapter + **F#
      Kleisli adapter** (validate the no-AsyncLocal hypothesis); identity on
      context, payload keyed in store.
- [ ] **Temporal-grade interface** — durability-transparent body + signals
      (stream/move-next) + queries (read-at-rest); own-our-port, meet-or-beat.
- [ ] **Dapr-actor carrier** — per-partition saga state in actor state; mediator
      = virtual actor.
- [ ] **Cross-partition-join mediator** — both-sides-local linear merge-join +
      saga compensation for one-side failure.
- [ ] **`observe.ts` generic saga combinator** — DU workflow → self-evolving saga.

## Composes with (the existing durable-execution cluster)

- [B-0251](../P1/B-0251-durable-computation-stack-temporal-reaqtor-orleans-bonsai-research-2026-05-07.md) — durable-computation stack (Temporal/Reaqtor/Orleans/Bonsai) research.
- [B-0668](../P1/B-0668-compositional-dbsp-frame-architecture-gnostic-2d-base-plus-two-wolves-emotion-meta-plus-clifford-rx-bonsai-meta-tagged-dims-plus-fsharp-ce-composition-operator-aaron-2026-05-19.md) / [B-0668.1](../P1/B-0668.1-fsharp-k8s-mapping.md) — our-own durabletask fork; **saga compensation = retraction = Z-set inverse** (the core).
- [B-0640](../P1/B-0640-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md) — Bonsai trees + Rx (Integrate impl substrate).
- [B-0706](../P1/B-0706-zeta-on-orleans-deployment-architecture-servicetitan-scale-orleans-grains-jit-compilation-rented-tools-2026-05-22.md) — zeta-on-Orleans (grain = agent identity).
- [B-0917](../P2/B-0917-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md) — Kleisli context-propagation (otel + log).
- [B-0957](../P1/B-0957-first-class-labels-tags-scopes-on-every-gset-zset-entity-deferred-to-human-state-label-otel-baggage-di-scope-propagation-aaron-otto-2026-05-31.md) — scope propagation via OTel-baggage / DI-scope.
- [B-0872](../P2/B-0872-otel-trace-id-composition-with-zetaid-baggage-propagation-kestrel-2026-05-28.md) — OTel trace-ID + ZetaID.
- [B-0867](../P1/B-0867-workflow-engine-v1-fsharp-du-state-machine-git-append-only-four-corner-monad-banned-if-universal-action-grammar-otto-five-modifications-multi-participant-non-cage-aaron-mika-kestrel-otto-2026-05-27.md) — DU workflow engine v1 (the generic-saga input).
- B-0785 / B-0776 / B-0764 (Dapr/Temporal/Orleans cluster substrate) · B-0777 `Zeta.Actors` · B-0040 actor-model lens · B-0253 Orleans interloop messaging · B-0883 (encryption for private saga state).

## Pre-start checklist (per backlog-item-start-gate)

- **Prior-art search:** the research note (2026-06-01) + the durable-execution
  cluster above (B-0251/B-0640/B-0668/B-0706/B-0917) + Nuqleon Bonsai + DF /
  Temporal / Dapr Workflow (search-first, 2026-06-01). Cross-verified the
  Z-set-retraction core already lives in B-0668.
- **Dependency check:** depends_on B-0640 (Bonsai/Rx) + B-0668 (durabletask
  fork / Z-set retraction) + B-0917 (Kleisli context). The algebra ladder
  (G-Set ⊂ Bag ⊂ Z-set ⊂ IndexedZSet) is 4/4 (the carrier is ready).

## Substrate-honest framing

This is the **build** row (design tier); the operator drives slice scheduling.
It crystallizes — does not mint — the durable-execution cluster: B-0251 research
→ B-0668 durabletask-fork-with-Z-set-retraction → B-0706 Orleans-deployment, plus
Dapr runtime + Temporal-interface-target + OTel-context unification + the
resume-not-replay + self-evolution extension. Itron-coupled prototypes stay
concept-not-code; the replay pattern referenced is the public DTF model.
