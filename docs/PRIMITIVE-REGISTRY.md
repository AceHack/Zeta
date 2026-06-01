# Cross-Language Primitive Registry

The stable-ish primitives we implement in **all four oracle languages** —
**TypeScript** (the distribution default), **F#**, **C#**, **Rust** — and the
consensus mechanism that says each one is _right_.

Per [`m-acc-multi-oracle`](../.claude/rules/m-acc-multi-oracle-end-user-moral-invariants.md):
no single language is the source of truth. Each language's compiler is an
**independent, non-Byzantine oracle** — _the compilers don't lie_ — so a primitive
that compiles + agrees across all four is right **by construction**
(governance model: [`docs/DECISIONS/2026-05-31-four-language-compiler-bft-...`](DECISIONS/2026-05-31-four-language-compiler-bft-governance-axes-per-artifact-gate-golden-vectors-oracle-tiebreak.md)).

This file is the **living list** Aaron asked for — the API-doc of what we can build
on. The work that fills the gaps is tracked by
[B-0959](backlog/P1/B-0959-zeta-sovereign-distributed-db-and-agent-loop-master-checklist-one-git-native-zset-substrate-aaron-otto-2026-05-31.md)
(master checklist); this file is the _status view_ over it.

## Consensus tiers

A primitive's trust is only as strong as how its four implementations are checked
to agree. Three tiers, strongest first:

| Tier  | Name                                     | What it means                                                                                                                                                                                                                 |
| ----- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **golden-vector byte-consensus**         | All implementations run a **shared fixture** and produce **byte-identical** output; a harness diffs them and fails on any mismatch. The strongest tier — disagreement is impossible to miss.                                  |
| **2** | **compiler-parity + per-language tests** | Each language **independently reimplements** the primitive and its own tests pass. "The compilers don't lie" — parity is proven by independent reconstruction, but there is not (yet) a shared byte fixture diffing all four. |
| **3** | **implemented (no cross-verify yet)**    | Present in a language, but no parity check binds it to the others.                                                                                                                                                            |
| —     | **absent**                               | Not implemented in that language.                                                                                                                                                                                             |

Cells below use ✅ (present) / ⚠️ (partial — see note) / ❌ (absent).

## Tier-1/2 — the stable base (4-oracle)

| Primitive                                                                         | TS  | F#  | C#  | Rust | Consensus                                                                                    | Locations                                                                                                                                                  |
| --------------------------------------------------------------------------------- | --- | --- | --- | ---- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **ZetaId** — 128-bit content/structure-addressed id (Category enum incl. `Bus=6`) | ✅  | ✅  | ✅  | ✅   | **Tier 1** — 12-vector byte-consensus, 4-way `compare.ts` (TS≡F#≡C#≡Rust)                    | `src/Core.{TypeScript/zeta-id,FSharp.ZetaId,CSharp.ZetaId,Rust.ZetaId}/`; fixture `tests/cross-verification/zeta-id/` (B-0679, B-0681, B-0682)             |
| **Observe loop** — `observe`/`simulate`/`fold`/`replay` event algebra             | ✅  | ✅  | ✅  | ✅   | **Tier 1/2** — shared `golden-vectors.json` (Rust verifies against it; F#/C# crates present) | `src/Core.{FSharp,CSharp,Rust}.Observe/`, `tools/observe/`; fixture `tools/observe/golden-vectors.json` (B-0867.27)                                        |
| **TriBoolean** — digital qubit (true/false/middle)                                | ✅  | ✅  | ✅  | ✅   | **Tier 2** — compiler-parity + per-lang tests                                                | `src/Core.{TypeScript,FSharp,CSharp,Rust}.TriBoolean/`; tests `tests/Tests.{CSharp,FSharp}/TriBoolean/` (B-0944)                                           |
| **TriBoolean float** — "middle-out" self-describing float                         | ✅  | ✅  | ✅  | ✅   | **Tier 2** — per-lang tests; **v0 spec** (evolving)                                          | `…TriBoolean/{Float.fs,TriFloat.cs,float.rs}`, `src/Core.TypeScript/tri-boolean-float/`; specs `docs/research/2026-05-3{0,1}-tri-boolean-float-*` (B-0944) |

## In-progress — the base sweep (the gaps we're closing)

These are the building blocks for the **common observe loop + sovereign DB**; the
sweep order is **ZetaId → algebra ladder → bus**.

| Primitive                                                          | TS  | F#  | C#  | Rust | Note                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------ | --- | --- | --- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G-Set** — grow-only set CRDT                                     | ✅  | ✅  | ❌  | ❌   | TS has a `golden-vectors.json` fixture (`src/Core.TypeScript/g-set/`); F# `src/Core/GSet.fs`. Needs C# + Rust.                                                                                                                                                                                                          |
| **Bag / multiset** — non-negative-weight multiset                  | ❌  | ⚠️  | ❌  | ❌   | The **missing middle rung**. Only implicit-in-Z-set in F# today; no named type anywhere. Cheapest gap.                                                                                                                                                                                                                  |
| **Z-set** — signed-weight, retraction-native set (DBSP)            | ❌  | ✅  | ⚠️  | ❌   | F# `src/Core/ZSet.fs` (+`IndexedZSet.fs`); C# is a binding→F# (`ZetaCircuitBuilder`). Needs native TS + Rust.                                                                                                                                                                                                           |
| **Bus (git-native)** — ZetaId-keyed G-Set of envelopes, no-PR      | ✅  | ❌  | ❌  | ❌   | `tools/agent-bus/` (B-0954, #6283/#6327). The wire is JSON-on-git, so cross-lang = a thin read/write/merge per language (each needs ZetaId first).                                                                                                                                                                      |
| **Rx-Observable / Z-set delta-stream** — push-based reactive layer | ⚠️  | ⚠️  | ⚠️  | ❌   | The reactive layer **over** Z-set: an Rx query _is_ a Z-set delta-stream (B-0959 §3). Rx.NET / `FSharp.Control.Reactive` exist per-lang (`rx-expert` skill, B-0640); not yet a unified cross-lang primitive. **CALM** (Consistency As Logical Monotonicity) is the law that makes the monotone slice coordination-free. |

## The algebra ladder (why three of the gaps are one build)

```
G-Set   ⊂   Bag / multiset   ⊂   Z-set
weights {0,1}    weights ℕ          weights ℤ (retraction-native)
```

Each rung is the next by widening the weight codomain. Built **once per language,
parameterized over the weight monoid**, one type yields all three rungs — so the
G-Set / Bag / Z-set gaps collapse into a single ladder build per language.

## How to use / maintain this file

- **Building on the base?** Use the Tier-1/2 table. Tier 1 (ZetaId) is byte-safe to
  depend on across machines + languages. Tier 2 is reimplementation-verified.
- **Landed a primitive in a new language?** Add/flip its cell, name the location,
  and state the consensus tier honestly (don't claim Tier 1 without a shared
  byte-diff harness — implement the fixture + `compare` first).
- **Promotion gate to Tier 1**: a shared golden-vector fixture + an N-way `compare`
  harness that fails non-zero on mismatch (the `tests/cross-verification/zeta-id/`
  pattern is the template).

_Last updated: 2026-06-01 — ZetaId reached Tier-1 4-oracle consensus (B-0679, Rust
crate landed; 12/12 byte-identical across TS/F#/C#/Rust)._
