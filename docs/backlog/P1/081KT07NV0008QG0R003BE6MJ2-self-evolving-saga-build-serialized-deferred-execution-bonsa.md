---
id: 081KT07NV0008QG0R003BE6MJ2
priority: P1
status: open
title: "Self-evolving saga build — serialized deferred execution (Bonsai expr-tree + closure state), resume-not-replay, Temporal-grade interface, rides the Z-set/IndexedZSet ladder (Aaron 2026-06-01)"
tier: design
effort: L
created: 2026-06-01
last_updated: 2026-06-01
depends_on: [081KRW63S0008QG0R002XA5N6S, 081KRYRGG0008QG0R0018CMFQY, 081KSNY2Z0008QG0R002HB4AGT]
composes_with: [081KQZVQW0008QG0R000PPQ3MH, 081KRW63S0008QG0R002XA5N6S, 081KRYRGG0008QG0R0018CMFQY, 081KSNY2Z0008QG0R001TMM2HY, 081KS6FPN0008QG0R003Y3MCVE, 081KSE6WT0008QG0R0009YYNP4, 081KSE6WT0008QG0R002275NDE, 081KSE6WT0008QG0R000JSJ3SR, 081KSE6WT0008QG0R000R8CPFX, 081KSKBP80008QG0R000B3Y19A, 081KSNY2Z0008QG0R000ZNRFCE, 081KSNY2Z0008QG0R002JKH50A, 081KSNY2Z0008QG0R002HB4AGT, 081KSXN940008QG0R001YABTHH, 081KSXN940008QG0R003FCQ7WT, 081KQ3HBZ0008QG0R000RP1WDN, 081KQZVQW0008QG0R000W4B8KT]
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
  operator** (081KRYRGG0008QG0R0018CMFQY: *"saga compensation = retraction = additive inverse in
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

The saga **context** (state hangs off it) is the **OTel context** = **081KSNY2Z0008QG0R002HB4AGT
IntrCtx** (the 5-context Kleisli propagation: memetic / prompt / trust / log /
otel). It carries identity + small hot state; the heavy serialized payload is
keyed off it in the store. Per-language propagation:

- **C# / TS — ambient `AsyncLocal` / `Activity.Current`** in-process; W3C
  `traceparent` + baggage cross-process (081KSXN940008QG0R001YABTHH scope-propagation, 081KSNY2Z0008QG0R000ZNRFCE
  ZetaID + trace-id).
- **F# — may NOT need AsyncLocal (Aaron 2026-06-01: "f# might not need async
  local we have Kleisli arrows if it works").** Kleisli arrows thread the context
  **explicitly** through the monadic bind (081KSNY2Z0008QG0R002HB4AGT Kleisli context-propagation +
  the monad-propagation rule), so the context is a typed value, not hidden
  ambient state — cleaner, DST-friendly (no hidden mutable ambient), composable.
  **Hypothesis to validate:** if Kleisli context-threading is ergonomic enough
  (F# CE + `>=>`), F# avoids AsyncLocal entirely; AsyncLocal stays the C#/TS
  mechanism. Risk: explicit threading can be verbose — validate before committing.
  The saga interface abstracts over both (ambient adapter vs Kleisli adapter).

## Runtime — Dapr Actors carrier; per-partition + cross-partition-join mediator

- **Dapr** is the planned runtime (already deployed, 081KSE6WT0008QG0R000R8CPFX). **Dapr Actors**
  (Orleans-lineage virtual actors) = the mediator **carrier** (+ the
  Durable-Entities primitive); **Dapr Workflow** (`durabletask-go`, replay
  family) = conformance oracle, NOT the self-evolving engine. Ride Dapr Actors as
  runtime/carrier + saga-**resume** for the looser constraints + self-evolution.
- **Per-partition** sagas (each shard / key-group / Orleans-grain = agent, per
  081KS6FPN0008QG0R003Y3MCVE grain identity = agent identity) + **cross-partition joins** (the
  bilinear `join` spanning shards is itself a saga) **run via an agent mediator
  whose tick stream is the carrier, holding both sides local for the CALM linear
  merge-join, with mitigation/compensation factors inside the saga** (compensate /
  retract via ℤ inverse / retry / hold-resume) for one-side failure.

## `observe.ts` generic saga combinator

A single generic combinator in `observe.ts` lifts **any lifecycle-DU workflow**
(081KSKBP80008QG0R000B3Y19A) to a self-evolving saga: `serialize(Rx) + serialize(state)`. DU = legal
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

## Error channel — fail-fast `Result` now; accumulate (RFC-9457 ProblemDetails) later

Two complementary modes (the monad/applicative split), each leaning on its
ecosystem's native shape (hexagonal — own the payload contract, use the BCL
container where one exists):

- **Fail-fast (monadic) — built (TS + F#).** `serialize`/`parse` return
  `Result<T, BonsaiFeedback>`; the first decline short-circuits. Correct for
  single-parse (you can't continue past a structural error). F#/Rust lean on the
  BCL `Result` (`FSharp.Core.Result`, `std::result::Result`); C#/TS own a minimal
  `Result` port + adapt to the widely-used lib (neverthrow / FluentResults-class).
  `BonsaiFeedback` is the shared cross-oracle payload; its `where` fields are
  JSON-pointer keys.
- **Accumulate (applicative) — the tracked next slice (consumer-driven).** For
  batch / model-validation (validate N golden vectors at once, the bus validating a
  batch of envelopes, throttled-batch ops) you want *every* failure, keyed by field.
  That shape is **RFC 9457 "Problem Details"** (supersedes RFC 7807), and .NET ships
  it as **`ValidationProblemDetails`** with `Errors: IDictionary<string, string[]>`
  (field → messages) — useful well outside HTTP (only `status` is HTTP-flavored).
  Hexagonal plan: own a cross-language ProblemDetails-shaped port
  (`{type, title, status?, detail, instance?, errors}`), adapt to .NET's
  `ValidationProblemDetails` at the C# seam; a `BonsaiFeedback list` maps straight
  onto the `errors` map via the `where` keys. Complementary primitive for the family
  + the git-native bus (081KSXN940008QG0R00171YAZW) — build when scheduled; **saved here so the
  hexagonal isn't forgotten** (the operator 2026-06-01).

## Acceptance / decomposition (slices)

- ✅ Cross-language **Bonsai-subset serializer** (`{Context, Expression}`) +
      golden-vector cross-verify — **all four oracles done + byte-locked** on the
      shared `golden-vectors.json` (`serialize(parse(canonical)) == canonical`),
      Nuqleon retained as the .NET-typed conformance oracle. Weakly-typed /
      reflection-omitted subset (const/param/lambda/binary/call/cond); canonical
      byte-exact serialize + parse round-trip; `serialize`/`parse` return
      `Result<_, BonsaiFeedback>` (result over throw); safe-int + lone-surrogate +
      canonical-only + shared `MaxDepth=1024` + op/bool boundary validation:
      **TS** (`src/Core.TypeScript/bonsai/`, 57 tests) ·
      **F#** (`src/Core/Bonsai.fs`, 30 tests) ·
      **C#** (`src/Core.CSharp.Bonsai/`, #6440 — owns a minimal `Result<T,TError>`
      port + System.Text.Json, sealed-record DUs, 23 tests) ·
      **Rust** (`src/Core.Rust.Bonsai/`, #6442 — `std::result::Result`-native +
      zero-dep hand-rolled JSON reader, 17 tests). All four agree byte-for-byte AND
      error-shape-for-error-shape (same `BonsaiFeedback` variant set, same `Result`
      contract, same `MaxDepth`).
- ✅ **Accumulate-mode error channel** (RFC-9457 ProblemDetails) — the applicative
      complement to the fail-fast `Result`: `parseAll` collects *every* per-node
      decline keyed by JSON-path (not just the first), for batch / model-validation /
      the bus validating a batch of envelopes. Additive over the same `BonsaiFeedback`
      payload; `toProblemDetails` adapts the collected list to the RFC-9457 errors-map
      (the .NET `ValidationProblemDetails` shape at the C# seam). Shipped across
      **all four oracles** (TS #6436 · F# #6438 · C# #6440 · Rust #6442).
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

- [081KQZVQW0008QG0R000PPQ3MH](../P1/081KQZVQW0008QG0R000PPQ3MH-durable-computation-stack-temporal-reaqtor-orleans-bonsai-research-2026-05-07.md) — durable-computation stack (Temporal/Reaqtor/Orleans/Bonsai) research.
- [081KRYRGG0008QG0R0018CMFQY](../P1/081KRYRGG0008QG0R0018CMFQY-compositional-dbsp-frame-architecture-gnostic-2d-base-plus-two-wolves-emotion-meta-plus-clifford-rx-bonsai-meta-tagged-dims-plus-fsharp-ce-composition-operator-aaron-2026-05-19.md) / [081KSNY2Z0008QG0R001TMM2HY](../P1/081KSNY2Z0008QG0R001TMM2HY-fsharp-k8s-mapping.md) — our-own durabletask fork; **saga compensation = retraction = Z-set inverse** (the core).
- [081KRW63S0008QG0R002XA5N6S](../P1/081KRW63S0008QG0R002XA5N6S-bonsai-trees-for-integration-rx-queries-real-time-implementation-substrate-aaron-2026-05-18.md) — Bonsai trees + Rx (Integrate impl substrate).
- [081KS6FPN0008QG0R003Y3MCVE](../P1/081KS6FPN0008QG0R003Y3MCVE-zeta-on-orleans-deployment-architecture-servicetitan-scale-orleans-grains-jit-compilation-rented-tools-2026-05-22.md) — zeta-on-Orleans (grain = agent identity).
- [081KSNY2Z0008QG0R002HB4AGT](../P2/081KSNY2Z0008QG0R002HB4AGT-interrupt-substrate-in-monad-space-kleisli-arrows-for-context-propagation-memetic-prompt-trust-log-otel-guaranteed-free-time-after-n-rounds-target-aaron-2026-05-28.md) — Kleisli context-propagation (otel + log).
- [081KSXN940008QG0R001YABTHH](../P1/081KSXN940008QG0R001YABTHH-first-class-labels-tags-scopes-on-every-gset-zset-entity-deferred-to-human-state-label-otel-baggage-di-scope-propagation-aaron-otto-2026-05-31.md) — scope propagation via OTel-baggage / DI-scope.
- [081KSNY2Z0008QG0R000ZNRFCE](../P2/081KSNY2Z0008QG0R000ZNRFCE-otel-trace-id-composition-with-zetaid-baggage-propagation-kestrel-2026-05-28.md) — OTel trace-ID + ZetaID.
- [081KSKBP80008QG0R000B3Y19A](../P1/081KSKBP80008QG0R000B3Y19A-workflow-engine-v1-fsharp-du-state-machine-git-append-only-four-corner-monad-banned-if-universal-action-grammar-otto-five-modifications-multi-participant-non-cage-aaron-mika-kestrel-otto-2026-05-27.md) — DU workflow engine v1 (the generic-saga input).
- 081KSE6WT0008QG0R000R8CPFX / 081KSE6WT0008QG0R002275NDE / 081KSE6WT0008QG0R0009YYNP4 (Dapr/Temporal/Orleans cluster substrate) · 081KSE6WT0008QG0R000JSJ3SR `Zeta.Actors` · 081KQ3HBZ0008QG0R000RP1WDN actor-model lens · 081KQZVQW0008QG0R000W4B8KT Orleans interloop messaging · 081KSNY2Z0008QG0R002JKH50A (encryption for private saga state).

## Pre-start checklist (per backlog-item-start-gate)

- **Prior-art search:** the research note (2026-06-01) + the durable-execution
  cluster above (081KQZVQW0008QG0R000PPQ3MH/081KRW63S0008QG0R002XA5N6S/081KRYRGG0008QG0R0018CMFQY/081KS6FPN0008QG0R003Y3MCVE/081KSNY2Z0008QG0R002HB4AGT) + Nuqleon Bonsai + DF /
  Temporal / Dapr Workflow (search-first, 2026-06-01). Cross-verified the
  Z-set-retraction core already lives in 081KRYRGG0008QG0R0018CMFQY.
- **Dependency check:** depends_on 081KRW63S0008QG0R002XA5N6S (Bonsai/Rx) + 081KRYRGG0008QG0R0018CMFQY (durabletask
  fork / Z-set retraction) + 081KSNY2Z0008QG0R002HB4AGT (Kleisli context). The algebra ladder
  (G-Set ⊂ Bag ⊂ Z-set ⊂ IndexedZSet) is 4/4 (the carrier is ready).

## Substrate-honest framing

This is the **build** row (design tier); the operator drives slice scheduling.
It crystallizes — does not mint — the durable-execution cluster: 081KQZVQW0008QG0R000PPQ3MH research
→ 081KRYRGG0008QG0R0018CMFQY durabletask-fork-with-Z-set-retraction → 081KS6FPN0008QG0R003Y3MCVE Orleans-deployment, plus
Dapr runtime + Temporal-interface-target + OTel-context unification + the
resume-not-replay + self-evolution extension. Itron-coupled prototypes stay
concept-not-code; the replay pattern referenced is the public DTF model.
