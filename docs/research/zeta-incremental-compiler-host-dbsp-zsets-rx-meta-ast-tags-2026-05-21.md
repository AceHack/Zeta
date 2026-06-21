# Zeta Incremental Compiler Host — DBSP/Z-sets + Rx Meta-AST Tags

Date: 2026-05-21  
Prepared by: Amara-in-Zeta  
Related: ZetaParse, 081KS3X9Y0008QG0R000EKJE9S, 081KS3X9Y0008QG0R00323NSZA (ZetaParse) + 081KS3X9Y0008QG0R0010716X9 (this incremental compiler host), F# compiler fork, DBSP/Rx/tensor substrate

## Short answer

Yes.

If Zeta forks/extends the F# compiler, we can make incremental recompiles work as a compiler-owned substrate where:

- source files, generated files, grammar outputs, type-provider outputs, ontology nodes, tensor metadata, and diagnostics are represented as **Z-sets**,
- every compile phase is a DBSP-style incremental operator over those Z-sets,
- Rx queries attach **meta-AST tags** as observable dimensions,
- type providers / generators become retraction-aware compiler plugins,
- compile output is updated by deltas instead of full rebuilds where safe.

This is not “Roslyn generators copied into F#.” It is the F# fork becoming an incremental compiler database.

## Core thesis

Traditional compiler:

```text
source files
  -> parse
  -> bind/typecheck
  -> optimize
  -> emit
```

Zeta compiler host:

```text
source/input deltas
  -> Z-set changes
  -> DBSP incremental operators
  -> Rx observable meta-tags
  -> typed AST / ontology / tensors / diagnostics
  -> retractable generated code
  -> compile output deltas
```

The compiler becomes a live, retractable, typed, observable state machine.

## Deterministic simulation from seed

Correction / sharpening:

Generators and type providers should not merely be “pure-ish projections.” They should become **pure-ish deterministic simulations from seed**.

That means every compiler-time extension runs as if it were a small deterministic simulation:

```text
CompilerSnapshot
+ CompilerDelta
+ GeneratorVersion
+ CapabilityManifest
+ DeterministicSeed
+ ExplicitInputFacts
    -> GeneratedFacts
    -> RetractionFacts
    -> Diagnostics
```

No hidden clock.  
No hidden network.  
No hidden mutable cache.  
No ambient randomness.  
No unrecorded filesystem reads.

If a provider needs the outside world, the outside world is first observed into the compiler database as explicit facts. The generator then consumes those facts deterministically.

In other words:

```text
impure world
  -> Observe into facts
  -> deterministic seeded simulation
  -> generated/retracted compiler facts
```

This keeps the compiler host replayable, debuggable, and honest.

## Why this is the right place

F# already has type-provider-style compile-time information integration. Roslyn has incremental source generator ideas. Rx gives push-based notifications. DBSP gives incremental view maintenance. Zeta needs all four, but fused at the compiler-host level.

The important thing is that we should not store mutable plugin state inside a generator instance. The durable state must live in a content-addressed compiler database / DBSP store. Generators and providers become pure-ish projections from compiler-state Z-sets to generated artifacts.

## Minimum architecture

### 1. Compiler database

The compiler database is a versioned store of retractable facts.

```fsharp
type ZWeight =
  | Plus
  | Minus

type ZFact<'T> =
  { Value: 'T
    Weight: int
    Provenance: Provenance
    Clock: CompilerClock }

type CompilerRelation<'T> =
  { Name: string
    Facts: ZSet<'T> }
```

Example relations:

```text
SourceText(path, contentHash, text)
Token(file, span, kind, value)
ParseNode(file, nodeId, kind, span, children)
AstNode(nodeId, typedShape, span)
Symbol(symbolId, name, scope, kind)
TypeFact(symbolId, typeExpr)
MetaTag(nodeId, tagKey, tensorPayload, provenance)
Diagnostic(file, span, severity, message)
GeneratedFile(path, contentHash, sourceGeneratorId)
OntologyNode(id, kind, tensorShape, parent, provenance)
RetractionHandle(id, inverse)
DeterministicSeed(scope, seedHash, derivationPath)
EffectFact(effectId, kind, observedValue, provenance)
```

A file edit is not “rebuild the project.” It is:

```text
- SourceText(old)
+ SourceText(new)
```

Then downstream relations update incrementally.

### 2. Compiler phases as DBSP operators

Each phase becomes an incremental operator:

```fsharp
parse       : ZSet<SourceText> -> ZSet<ParseNode>
bind        : ZSet<ParseNode> * ZSet<Symbol> -> ZSet<BoundNode>
typecheck   : ZSet<BoundNode> -> ZSet<TypeFact>
inferMeta   : ZSet<AstNode> * ZSet<RxQuery> -> ZSet<MetaTag>
generate    : ZSet<AstNode> * ZSet<MetaTag> -> ZSet<GeneratedFile>
diagnose    : ZSet<CompilerRelation<_>> -> ZSet<Diagnostic>
```

The compiler host wires these operators together and only recomputes affected views.

### 3. Rx queries as meta-AST tag dimensions

Rx queries are not just runtime subscriptions. In the compiler host they become first-class compile-time queries over compiler relations.

```fsharp
type MetaAstTag =
  { NodeId: AstNodeId
    Dimension: DimensionId
    Payload: TensorFrame
    Query: RxQueryId
    Provenance: Provenance }
```

Example:

```fsharp
rxmeta "tonal-trajectory" {
    from node in AstNodes
    where node.Kind = Function && node.Attributes.Contains "ZetaTrajectory"
    select {
        nodeId = node.Id
        tensor = Clifford.Project(node)
        tags = ["meme-space"; "trajectory"; "limit-candidate"]
    }
}
```

The output is a Z-set:

```text
+ MetaTag(node42, "tonal-trajectory", tensorPayload, queryHash)
```

If the node changes or the query changes, the tag retracts and a new tag appears:

```text
- MetaTag(node42, "tonal-trajectory", oldTensor, oldQueryHash)
+ MetaTag(node42, "tonal-trajectory", newTensor, newQueryHash)
```

That is the bridge: Rx-shaped query semantics, DBSP/Z-set change discipline.

### 4. Generators and type providers become retraction-aware

Current source generators/type providers conceptually add compiler-time artifacts. Zeta’s fork should require every generator/provider to declare:

```fsharp
type IRetractionAwareGenerator =
  abstract Id: GeneratorId
  abstract Inputs: CompilerRelationId list
  abstract Version: GeneratorVersion
  abstract CapabilityManifest: CapabilityManifest
  abstract Generate: CompilerSnapshot * DeterministicSeed -> ZSet<GeneratedArtifact>
  abstract Retract: CompilerDelta * DeterministicSeed -> ZSet<GeneratedArtifact>
  abstract Laws: GeneratorLaw list
```

A generated file is no longer only “added.” It has a provenance and inverse.

```text
+ GeneratedFile("ZetaId.Generated.fs", hashA, by=ZetaIdGenerator)
- GeneratedFile("ZetaId.Generated.fs", hashA, by=ZetaIdGenerator)
+ GeneratedFile("ZetaId.Generated.fs", hashB, by=ZetaIdGenerator)
```

This lets generated artifacts behave like DBSP facts, not magical side effects.

### 5. Recursive ontology builder at compile time

The ontology builder runs as an incremental fixed-point over facts.

```fsharp
ontology {
    seed AstNodes
    seed MetaTags
    seed TypeFacts

    derive OntologyNode from AstNodes
    derive OntologyEdge from SymbolReferences
    derive TonalTrajectory from MetaTags
    derive CliffordFrame from TensorFrames

    untilFixpoint
}
```

Each derived ontology node is a fact in a Z-set. If an input disappears, dependent nodes retract.

This is the compiler-owned version of “recursive HKT ontology at compile time.”

## Compile loop

```text
1. Observe
   File watcher / editor / CI / generator input changes produce deltas.

2. Diff
   Convert raw changes into Z-set +/- facts.

3. Increment
   Run DBSP operators over changed relations.

4. Tag
   Rx meta queries attach typed tensor-backed tags to AST/ontology nodes.

5. Generate
   Retraction-aware providers/generators update generated artifacts.

6. Typecheck
   Type facts update incrementally.

7. Emit
   Produce assembly / generated source / diagnostics / ontology cache.

8. Persist
   Store compiler DB snapshot + provenance + retraction handles.
```

## What “incremental recompile” means here

It means:

- source edit retracts old parse facts and inserts new parse facts,
- only affected AST nodes update,
- only affected type facts recompute,
- only affected meta-tags recompute,
- only affected generated files update,
- diagnostics update as a delta,
- emitted artifacts rebuild only when their dependency slice changed.

This is the compiler as a live DBSP graph.

## Relation to Roslyn incremental generators

Roslyn incremental generators are an important pattern, but Zeta should not simply clone them.

The transferable ideas:

- generator registration as compiler pipeline step,
- incremental input tracking,
- avoid storing state in generator instances,
- generated source as compiler output.

Zeta-specific differences:

- F# compiler-owned semantics,
- Z-set retractions,
- DBSP operators,
- Rx queries as meta-dimensions,
- tensor-backed meta-tags,
- ontology-builder fixed points,
- parse forests / dialectical alternatives,
- explicit collapse/retraction semantics.

## Relation to F# type providers

F# type providers are closer to what Zeta wants than plain source generators because they already model compile-time type availability from external or generated sources.

Zeta’s fork can extend that idea:

```text
Type provider
  -> provides types from external/input data

Zeta retraction-aware provider
  -> provides types + AST tags + ontology facts + generated code
     from compiler DB relations, with retraction and provenance
```

## Key invariants

### Invariant 1 — provenance

Every generated fact has provenance.

```fsharp
GeneratedFact -> SourceFacts * QueryHash * GeneratorId * CompilerClock
```

### Invariant 2 — retractability

Every generated fact must be retractable.

```fsharp
insert(fact) + retract(fact) = zero
```

### Invariant 3 — determinism

Same compiler DB snapshot + same generator version = same outputs.

### Invariant 4 — stable identity

AST node identity should survive edits where possible.

```text
same logical node + small span shift = same stable NodeId
```

### Invariant 5 — explicit collapse

Ambiguous parse forests, competing meta-tags, and multiple ontology paths can remain uncollapsed until a collapse rule is invoked.

### Invariant 6 — no hidden generator state

Generator/provider state is content-addressed in the compiler DB, not stored in plugin instances.

### Invariant 7 — seeded replay

Same compiler DB snapshot + same generator version + same deterministic seed = same generated facts, same retractions, same diagnostics.

```text
simulate(snapshot, version, seed) = simulate(snapshot, version, seed)
```

### Invariant 8 — effects become facts

External reads are not performed inside generator logic. They are observed before simulation and stored as `EffectFact` / source facts with provenance.

## Minimal PoC

Build this in stages.

### PoC 1 — ZetaId compiler DB slice

Input:

```text
ZetaIdLayout.zg
```

Relations:

```text
SourceText
ParseNode
AstNode
MetaTag
GeneratedFile
Diagnostic
```

Output:

```text
ZetaId.Generated.fs
ZetaId.Generated.cs
zeta-id.generated.ts
zeta_id_generated.rs
zeta_id_generated.py
```

Test:

1. Generate all files.
2. Edit one field in `ZetaIdLayout.zg`.
3. Observe retraction of old field facts.
4. Observe insertion of new field facts.
5. Only affected generated slices change.
6. Compile/test all targets.

### PoC 2 — Rx meta-tag query

Add:

```fsharp
rxmeta "endianness" {
    from field in ZetaIdLayout.Fields
    select MetaTag(field.NodeId, "endianness", Tensor.Of(field.Endianness))
}
```

Test:

- changing endianness retracts old tag and inserts new tag,
- generated pack/unpack code changes,
- tests catch drift.

### PoC 3 — Type provider surface

```fsharp
type ZetaId = ZetaCompilerProvider<"ZetaIdLayout.zg">

let id = ZetaId.Parse "01H..."
```

The provider reads from the compiler DB, not from an ad hoc parser cache.

### PoC 4 — Parse forest / GLR

Allow ambiguous grammar shape.

- preserve parse forest,
- attach alternative meta-tags,
- collapse with deterministic semantic rule,
- prove old alternative retracts cleanly.

## FsCheck property tests

```fsharp
prop_retract_insert_zero:
  apply(+x)
  apply(-x)
  equals original state

prop_incremental_equals_full:
  incrementalCompile(edit, oldState)
  equals fullCompile(newSource)

prop_generator_deterministic:
  generate(snapshot, generatorVersion)
  equals generate(snapshot, generatorVersion)

prop_meta_tag_retraction:
  update(rxQuery)
  retracts old tags and inserts new tags

prop_parse_forest_collapse_deterministic:
  same forest + same collapse rule
  produces same AST

prop_seeded_replay:
  same snapshot + same generator version + same seed
  produces same generated facts

prop_effects_are_explicit:
  generator output depends only on compiler facts, not ambient filesystem/network/clock
```

## Where this lives

Proposed backlog row:

**081KS3X9Y0008QG0R00323NSZA — Zeta Incremental Compiler Host: DBSP/Z-set incremental recompiles with Rx meta-AST tags**

Depends on:

- 081KS3X9Y0008QG0R000EKJE9S — ANTLR grammar survey
- proposed 081KS3X9Y0008QG0R003R74B20 — ZetaParse LR/GLR grammar substrate
- 081KRYRGG0008QG0R0018CMFQY — compositional DBSP frame architecture
- F# compiler fork trajectory

Initial repo targets:

```text
src/Zeta.CompilerDb/
src/Zeta.Parse/
src/Zeta.CompilerHost/
tools/codegen/zetaparse/
tests/Zeta.CompilerDb.Tests/
docs/research/zeta-incremental-compiler-host-2026-05-21.md
```

## Sharpest formulation

Yes, we can make incremental recompiles work.

But the right unit is not “source generator.” The right unit is:

**compiler relation + Z-set delta + Rx meta-query + deterministic seed + retractable generator output.**

That gives us the equivalent of Roslyn incremental generators and F# type providers, but stronger and more Zeta-native:

```text
Roslyn generator:
  syntax change -> generated source

F# type provider:
  external data -> compile-time types

Zeta compiler host:
  compiler DB delta
    -> DBSP incremental update
    -> Rx meta-AST tags
    -> deterministic seeded simulation
    -> tensor-backed ontology facts
    -> retraction-aware generated source/types/diagnostics
```

This is the compiler version of Agora’s base loop:

```text
Observe change.
Emit delta.
Limit/collapse only when necessary.
Integrate into compiler state.
```

That is the path.
