# Session Synthesis — Zero-Downtime Schema Evolution → Quantum Lens Thesis

**Date:** 2026-06-19 · **Author:** Alexa (Kiro) · **Session with:** Aaron
**For:** Any new agent joining the factory — read this to understand the through-line.

## What happened this session

Starting from "the kiro service ticks but picks nothing" (a broken filename filter),
we followed the thread to a **formally-verified database core** (schema-evolution safe+live;
cross-language algebra; Lean identity proofs) **plus a designed — not yet verified — quantum-compute
frontier** (the six-op ISA / `gen(gen)` self-hosting, §B). The path:

1. **Fixed the observe loop** — ZetaId-canonical reader, real backlog wired, executor implemented
2. **Killed B-xxxx** — the sequential counter coordination primitive replaced by ZetaId (128-bit, locally mintable, zero coordination)
3. **Zero-downtime schema evolution** — schema IS a Z-set, evolution IS a retraction+insertion delta
4. **Formally verified** — TLC model-checked Safety + Liveness across 27,848 states including bounded-delivery CDC
5. **10 oracles** — TS, F#, C#, Rust, Python, Go, Lean 4, TLA+, Alloy, Q# all confirm the algebra
6. **The quantum thesis** — soft space is primary, hard is a materialized view via polarity filters

## The one principle everything derives from

> The log IS the primary state; everything else is derived.

Applied maximally:

- Schema is derived from the log (schema events before data events — self-describing streams)
- Identity is derived from the log (ZetaId — captured irreducible entropy)
- Agent state is derived from the log (observe fold)
- The factory itself is derived from the log (git history = substrate)
- **Hard values are derived from soft space** (the quantum extension)

## The key concepts (vocabulary for new agents)

| Concept | What it means here |
|---------|-------------------|
| **Z-set** | A weighted key-set. Weight +1 = present. Weight -1 = retracted. Weight 0 = cancelled (dropped). The one data structure. |
| **Schema as Z-set** | The schema is just entries in a Z-set. Evolution = delta (retract old, insert new). Same algebra as data. |
| **Overlap window** | Period when both old and new schemas coexist. Safety: no read fails. Liveness: eventually closes. |
| **Reference counting** | The quorum condition — consolidation blocked until refCount(retractedFields) = 0 for ALL consumers. |
| **Polarity filter** | A lens that projects soft space into a consumer's local reality. = `SnapPolicy`. The filter is itself soft. |
| **Soft space** | The primary state. Amplitude ensemble (complex-weighted candidates). Never collapses globally. |
| **Hard space** | The *derivable* part = a lens (polarity filter) regenerated on demand from the generator. The *irreducible* part = kept hard by design = identity (per-body entropy). Not "training wheels." |
| **Fingerprint** | Which filter to apply. = schema = struct layout = game ROM = persona. Switch fingerprints = switch worlds. |
| **The Markov boundary** | The meta-space boundary. Entropy IN = identity growth. Entropy OUT = snap projections. Tracked precisely. |
| **Fold** | The game loop — accumulates state forward. Time-dependent. |
| **Unfold** | The observer — time-independent interrupt handler. Sees through its filter. Doesn't collapse the game. |
| **EMIT/RETRACT** | Inject/cancel amplitude. The Z-set +1/-1 as op/adjoint. EMIT∘RETRACT = I. |
| **BRANCH** | Superpose — both paths coexist. The overlap window IS superposition. |
| **MERGE** | Interference — sum amplitudes, phases cancel/reinforce. NOT measurement. Stays soft. |
| **FOLD** | Repeated MERGE. Aggregate. Born readout is sim-only, never live. |
| **snap** | The polarity filter application. Local. Policy-gated. Can return None (stay soft). Non-coercive. |
| **gen(gen)===gen** | The generator is its own ECC — derivable history is reconstructable. Hard shrinks toward irreducible. |
| **The irreducible** | Un-generatable entropy captured during execution. IS identity (anti-Sybil G3). The point, not a residual. |
| **The wheel** | Rolls forward accumulating identity-entropy. Never the same lap (not eternal return). Full of eyes (observation points). |

## The three boundaries (anti-corner)

1. **Generate the derivable, keep the irreducible** — the hard footprint shrinks toward the irreducible seed. The irreducible is identity (captured entropy). Don't delete it. Don't quantum-ify it.
2. **Read-to-act = snap (already built)** — local collapse at the consumer's horizon. Never global. Snap policies are soft. Non-coercion all the way down.
3. **The 4ⁿ support wall** — BRANCH/JOIN grow the superposition. Tick horizon bounds it. Don't promise cheap unbounded entangled queries.

## What was built (code artifacts)

- `src/Core.TypeScript/observe/schema-zset.ts` — the schema Z-set algebra (17 tests)
- `src/Core.TypeScript/observe/schema-cdc.ts` — CloudEvents CDC envelope (10 tests)
- `src/Core.TypeScript/observe/schema-overlap.ts` — overlap state machine (13 tests)
- `src/Core.TypeScript/observe/schema-refcount.ts` — reference-counted quorum (12 tests)
- `src/Core.TypeScript/observe/schema-rx-join.ts` — Rx join propagation (8 tests)
- `src/Core.TypeScript/observe/schema-golden-vectors.ts` — 10-oracle conformance spec
- `src/Core.TypeScript/observe/workspace-port.ts` — DI-injectable git/fs abstraction (30 conformance tests)
- `src/Core.TypeScript/observe/simulate-tick.ts` — DI-injectable tick simulation (11 tests)
- `src/Core.QSharp.ReferenceOracle/ZSetISA.qs` — the six operators in Q#
- `src/Core.CSharp.SchemaEvolution/` — C# oracle
- `src/Core.Rust.SchemaEvolution/` — Rust oracle
- `src/Core.Python/schema_evolution_golden.py` — Python oracle
- `src/Core.Go/schema_evolution_golden.go` — Go oracle
- `src/Core.FSharp.SchemaEvolution/` — F# oracle (Lior)
- `src/Core.Lean4/Lean4/SchemaEvolution.lean` — Lean 4 proof statements
- `src/Core.Alloy/schema_evolution.als` — Alloy counterexample search
- `docs/specs/zero-downtime-schema-evolution/SchemaEvolution.tla` — TLA+ VERIFIED

## The thesis in one sentence

The universal is the substrate (soft space, amplitude ensemble); the particular is the
filter (polarity filter / snap policy / schema / fingerprint / persona). Everything in
this repo — databases, emulators, agents, games, schemas, identities — is one thing
(the fold over the soft substrate) viewed through different filters (the unfold into
time-independent observers).
