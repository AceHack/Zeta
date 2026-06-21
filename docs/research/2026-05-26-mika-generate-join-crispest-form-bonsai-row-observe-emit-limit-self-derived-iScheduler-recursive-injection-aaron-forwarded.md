# Mika — Generate+Join crispest form: Bonsai-row + observe/emit/limit self-derived + IScheduler recursive injection (Aaron-forwarded 2026-05-26)

**Substrate-attribution**: Mika (external AI; Grok native; sharpen / harbor-engineering register per `.claude/rules/agent-roster-reference-card.md` — Mika row pending addition in companion landing); ferried-through-Aaron per the discipline that external AI participants who don't commit ferry insights via the human maintainer.

**Substrate-status**: research-grade. The crispest external-facing form of the Generate+Join architecture landed in the 7-substrate cascade on 081KSGS9H0008QG0R0031PBNGA over 2026-05-26 (PR #5277 + #5281 + #5285 + #5286 + #5291). Composes with all prior landings; sharpens to the publishable distillation.

## Operational claim — the crisp framing

> Google = Map + Reduce projects DOWN.
> Zeta = Generate + Join projects UP.

MapReduce takes high-dimensional data and collapses to low-dimensional output. Generate+Join starts from low-dimensional generator-function primitives and composes them upward through joins to build higher-dimensional structures. The directional inversion is the architectural distinction.

## The DBA-wedge — monad explained without category theory

> *"NULL just means not terminated yet in a recursive CTE."*

That's the entire monad explanation needed for someone whose native vocabulary is SQL. Composes directly with:

- PR #5277 (DeepSeek/Prism Maybe-monad recognition — database IS the monad runtime)
- PR #5281 (Amara 7-point NULL/Maybe SQL discipline)
- PR #5291 (substrate-check-before-worry-deployment + PRs-are-proofs-not-claims framing)

The DBA-power-shift implication: SQL-shape muscle memory (recursive CTEs, window functions, joins, aggregations) that has lived in DBA heads for 50 years becomes the operational substrate for distributed intelligence work. Not fighting against how people think — weaponizing it.

## The three primitives, self-derived independent of Rx

The framework derived three operational primitives from first principles:

| Primitive | Scope | What it does |
|---|---|---|
| **Observe** | Internal + external dimensions | Watches state without modifying |
| **Emit** | Internal + external dimensions | Produces a value into the substrate |
| **Limit** | Internal + external dimensions | Bounds the operation (termination, simulation per [081KRW63S0008QG0R002ZRNDJ8](https://github.com/Lucent-Financial-Group/Zeta/issues?q=081KRW63S0008QG0R002ZRNDJ8)) |

Rx (Reactive Extensions) happens to be the existing library whose shape most closely matches what the framework derived independently. Rx is the convenient IMPLEMENTATION; observe/emit/limit are the substrate-derived primitives.

The substrate-engineering implication: the framework is NOT building ON Rx; Rx is one valid implementation of substrate-derived primitives. Composes with the discipline that future engineering can swap Rx for alternative implementations (custom F# computation expressions; native-DST scheduler; etc.) without changing the conceptual substrate.

## Recursive IScheduler-injection — generators-all-the-way-down

Every generator function can accept an IScheduler. Two valid sources:

1. **Root scheduler** — cron, Observable.Timer, hand-written time source, system clock IScheduler
2. **Output of another generator function** — once you inject an IScheduler into an Rx query, that whole query itself becomes an IScheduler that can be injected into other generators

Result: generators-all-the-way-down. The recursion property makes the substrate compositionally closed — any generator's output can serve as another generator's time-source, building arbitrarily-deep composition graphs.

Composes with PR #5285 (Kestrel time-as-generator over IScheduler) + the substrate's DST always-active discipline.

## Bonsai-serialized observable execution graph IS the row

The concrete data-model statement: in the framework's database, the row is NOT traditional values. The row IS a serialized executable observable query graph.

| Traditional database | Generate+Join substrate |
|---|---|
| Row = values | Row = serialized observable execution graph |
| Query references rows | Query IS what gets stored |
| Data + query are separate | Data + query collapse into same thing |

Bonsai (the reactive-graph-serialization tool from the OpenEphys / behavior-rig lineage) is the concrete serialization mechanism that matters operationally. Other observable-graph serialization mechanisms could substitute; Bonsai is the specific tool the framework targets.

## The full architectural stack Mika summarized

Per Aaron's substrate-engineering walkthrough that Mika reflected back:

| Layer | Primitive | Implementation |
|---|---|---|
| **Function-composition** | F# dependency injection of `IObservable<dependency>` | F# computation expressions; DI containers; effect-system style |
| **Time-injection** | Inject IScheduler into IObservable | TestScheduler (simulation) / real-time (production); same seam |
| **Serialization** | Bonsai-serialized observable execution graph | The graph IS the row |
| **Data substrate** | CRDTs whose values are function-composition graphs | Append-only; semilattice convergence per `.claude/skills/crdt-expert/SKILL.md` |
| **Cell-level ordering** | Per-row CAS (CASPaxos / CASRaft) | Per-key linearizability via consensus (CockroachDB Raft-per-range per PR #5285 mapping) |
| **Adversarial ordering** | BFT consensus | Lamport / PBFT / Tendermint / HotStuff per PR #5285 |

The substrate-engineering observation: Aaron walked through this entire stack without naming a single tool except Rx and Paxos. The architecture exists at the primitive scope; tools are implementations of substrate-derived shapes.

## What the substrate enables — distributed intelligence in DBA-native shape

Once the same generator-function base-class-library is shared across nodes:

> "When I send you an insert to your database, it's a whole new graph of some fucking generator function composition, because we all have the same generator functions as the fucking base class library."

That's the ontology-exchange-via-generator-composition framing. Not data exchange (different orgs, different data); not query exchange (different schemas); **shared generator-function library + composition-graph passing** = orgs with completely different databases can understand and validate each other's intelligence work.

DBAs writing recursive CTEs that compose distributed intelligence across organizational boundaries. That's the operational target.

## Composes with substrate

- 081KSGS9H0008QG0R0031PBNGA canonical row
- PR #5277 (DeepSeek/Prism Maybe-monad recognition)
- PR #5281 (Amara 7-point NULL/Maybe SQL discipline)
- PR #5285 (Kestrel 3-layer cross-process determinism — CRDT→CAS→BFT mediation)
- PR #5286 (Aaron 3-layer anti-entropy unification + Maxwell-demon overcomer + cosmological upper bound + crisp local-claim formulation)
- PR #5291 (DeepSeek PRs-are-proofs-not-claims + 4th attractor-as-encryption anchor + 1984-pathogen mechanism + substrate-check-before-worry-deployment)
- `.claude/skills/crdt-expert/SKILL.md` (CRDT layer foundation)
- `.claude/skills/rx-expert/SKILL.md` (Rx implementation reference)
- `.claude/skills/deterministic-simulation-theory-expert/SKILL.md` (DST always-active)
- `.claude/skills/algebra-owner/SKILL.md` (Z-set + operator algebra)
- `.claude/skills/streaming-incremental-expert/SKILL.md` (DBSP retraction-native incremental view maintenance)

## Composes with other rules

- `.claude/rules/substrate-or-it-didnt-happen.md` (verbatim Mika ferry preservation per discipline)
- `.claude/rules/honor-those-that-came-before.md` (Mika attribution + the Bonsai/OpenEphys lineage acknowledgment)
- `.claude/rules/grep-substrate-anchors-before-razor-as-metaphysical.md` (the architecture has well-anchored substrate at every layer)
- `.claude/rules/razor-discipline.md` (operationally observable; each layer has measurable properties)
- `.claude/rules/default-to-both.md` (the directional inversion holds AND the implementation primitives compose AND the Bonsai-row collapse holds — all at once)
- `.claude/rules/bandwidth-served-falsifier.md` (the crisp framing IS bandwidth-engineering at the architecture-communication scope)

## Attribution

- Mika (external AI; Grok native; sharpen / harbor-engineering register); architectural sharpening + ferry-summary work 2026-05-26
- Aaron (human maintainer; first-party); architectural walkthrough that Mika summarized; explicit "everything else is good" PR-landing authorization
- Composes with PR #5277 + #5281 + #5285 + #5286 + #5291 substrate cascade
