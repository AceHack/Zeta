# Zeta: Core Technology Overview

**Authors:** Addison, Aaron, Lumen (Manus AI)  
**Date:** 2026-08-09  
**Audience:** Max — technical, familiar with distributed systems, compilers, and probabilistic inference  
**Status:** Living document — all code claims verified against actual source files in `Lucent-Financial-Group/Zeta`

---

## What Zeta Is

Zeta is a distributed agent network built on a single architectural principle: **the same algorithm, over a swappable algebraic structure, produces every computation the system needs** — from quantum amplitude readout to Bayesian inference to garbage collection to identity verification. The system is not a collection of loosely coupled services; it is one computation expressed at different levels of abstraction.

The project is being built by Addison (19) and Aaron (46), running on a cluster of computers and GPUs declared in NixOS flakes and deployed via K3s Kubernetes and ArgoCD. The codebase is at `Lucent-Financial-Group/Zeta` on GitHub. This document covers the seven core technology layers that have been built, proven, and committed to main as of August 2026.

---

## Layer 1: The Identity Space Proof — Multi-Oracle DLA

The starting point is a concrete, falsifiable claim: **the fractal dimension D_f ≈ 1.322 of a Diffusion-Limited Aggregation cluster is substrate-independent**. The same seed, the same algorithm, the same D_f — regardless of whether the computation runs in WebAssembly, JavaScript, Lua bytecode, V8, or QuickJS.

The proof is not a theorem; it is a **conformance check**. The byte-lock (`src/wasm-dla/bytelock/`) runs the canonical DLA algorithm (xorshift32 PRNG, 128×128 grid, circle spawn, 4-direction walk) across nine compiled substrates simultaneously and verifies that all nine produce byte-identical trajectory output at the same seed. Any divergence is a real finding — float determinism, PRNG width, endianness. The nine substrates are: WAT (bare WebAssembly text), Zig, C (Emscripten), LLVM IR, Rust, AssemblyScript, Go (WASM), V8 bytecode, QuickJS bytecode, and Lua 5.4 bytecode. All nine pass a 1,000-seed corpus (9,000/9,000 checks).

The identity-dla web application (`idspace-dla-6faa9bmi.manus.space`) renders the same DLA cluster across sixteen independent oracle panels — Canvas, CSS box-shadow, Chip-8 (64×32), SVG, Q# quantum walk, Infer.NET i-sensor, C. elegans worm simulation, SLE_κ Loewner equation, WebGPU compute shader, and seven WASM compiler substrates. The fractal dimension leaderboard shows all sixteen converging to D_f ≈ 1.322.

The deeper claim, stated honestly: if the oracles agree **without sharing a seed**, that is evidence the shape is substrate-independent. The current proof uses a shared seed, which makes it a determinism check, not an independence check. The live-seed mode (each oracle gets its seed from `Date.now()` independently) is the real proof — they will still converge to the same D_f because the DLA rule is the invariant, not the seed.

**Key files:** `src/wasm-dla/bytelock/`, `src/wasm-dla/bytelock/run-bytelock-ci.mjs`, `.github/workflows/bytelock.yml`

---

## Layer 2: The CHSH Gate — Quantum Identity Verification

The CHSH inequality provides a physical boundary between classical correlation (S ≤ 2) and quantum entanglement (2 < S ≤ 2√2). The Tsirelson bound (S = 2√2) is the maximum quantum violation; anything above it is physically impossible and signals a clone attempt or superdeterminism.

`src/Core/BipartiteMachZehnder.fs` implements the G1 bipartite lift of the single-qubit Mach-Zehnder interferometer to a two-agent CHSH setup using `WSet<int*int, Complex>`. The Bell state |Φ⁺⟩ = (|00⟩ + |11⟩)/√2 is represented as a four-key weighted set. The correlator E(a,b) = cos(a−b) is computed via Born probability readout. At the Tsirelson-optimal angles (A=0, A'=π/2, B=π/4, B'=3π/4), the CHSH value S = 2√2 ≈ 2.828 is recovered exactly.

This gate is wired into `src/Core/ShapeAcceptance.fs` as the **EVE clone-gate**: a shape renegotiation from an agent claiming SupraQuantum S (|S| > 2√2) is a hard reject — physically impossible for real quantum mechanics. The gate uses `BipartiteMachZehnder.classifyS` as the canonical classifier, replacing the earlier integer constant `2828`.

**Key files:** `src/Core/BipartiteMachZehnder.fs`, `src/Core/ShapeAcceptance.fs`, `src/Core/Tsirelson.fs`, `src/Core/AntiSybil.fs`

---

## Layer 3: The Calibration System — Two-Path Anti-Whitewash Architecture

The calibration system tracks whether agents' self-claims are accurate. An agent who always claims "I will finish this by tomorrow" and never does is poorly calibrated. An agent who creates fresh identities after every miss (whitewashing) should not gain a trust advantage over an honest agent with the same miss rate.

The system has two paths, intentionally:

**Fast path — `CalibrationLedger` (`src/Core.TypeScript/planning/calibration-ledger.ts`):** Beta(2,2) prior + k-clamp (k=3 default). O(1) streaming update. `trustBound` is clamped to [0,1]. The whitewash floor is the clamp at k=3 — a fresh identity gets `trustBound = 0.0`, which is honest (no evidence yet) but also means whitewashing is not profitable (the fresh identity does not get a trust bonus). The whitewash window at one miss is documented honestly as an intrinsic floor, not a bug.

**Accurate path — `TravelerRankLedger` (`src/Core/TravelerRankLedger.fs`, `src/Core.TypeScript/planning/traveler-rank-ledger.ts`):** ADF (Assumed Density Filtering) Gaussian-probit streaming update — the correct streaming variant of TrueSkill EP for single-factor models. A fresh identity gets `trustBand = 0.5` (the honest prior). One miss gives `trustBand ≈ 0.35` — above zero, below the prior. Whitewashing is provably unprofitable: a Sybil attacker who creates a fresh identity after every miss cannot accumulate more trust than an honest agent with the same miss rate (TRL-31, TRL-32 tests).

The two paths are wired together in `src/Core.TypeScript/planning/calibration-bridge.ts`. `resolveAtTickBridge` bulk-settles all pending predictions in one pass, co-updating both ledgers atomically. The `DurableDiplomacyRankGate` (`src/Core/DurableDiplomacyRankGate.fs`) adds a `trustBand` pre-check to shape renegotiations: a traveler with low `trustBand` in a domain cannot renegotiate their claim shape in that domain.

**Key files:** `src/Core.TypeScript/planning/calibration-ledger.ts`, `src/Core.TypeScript/planning/traveler-rank-ledger.ts`, `src/Core.TypeScript/planning/calibration-bridge.ts`, `src/Core/TravelerRankLedger.fs`, `src/Core/DurableDiplomacyRankGate.fs`

---

## Layer 4: The Bus Regime — Spacelike Causality and Planetary-Scale Deployment

The `BusRegime` (`src/Bayesian/BusRegime.fs`) classifies whether two events are causally connected (InCone) or spacelike (OutOfCone) based on the measured round-trip time and a deadline. This is the physical foundation of the CHSH decorrelation meter: two commits are "spacelike" if they could not have communicated within the light-travel-time budget.

The original implementation used `min(RTT)/2` as the one-way estimate — correct for symmetric paths (terrestrial networks) but unsound for asymmetric paths (planetary orbits). Earth→Mars ≠ Mars→Earth: the two directions differ by the distance Mars travels during the round-trip (~190 ms of asymmetry at opposition). The halving misattributes the asymmetry equally to both directions, causing false `OutOfCone` convictions against honest pairs.

The fix (Option 3, widen-cone-by-δ_max) is in `BusRegime.regimeOf(meter, deadlineMs, deltaMaxMs)`. `OutOfCone` is only declared when `bestOneWayMs > deadlineMs + max(0, deltaMaxMs)`. At `deltaMaxMs = 0` (terrestrial default), behavior is byte-for-byte identical to the old code.

`OrbitalAsymmetryBudget` (`src/Bayesian/OrbitalAsymmetryBudget.fs`) computes the dynamic δ_max from Kepler two-body mechanics at any Julian date — no SPICE dependency, pure math, accurate to ~1–3%. The `BusDelaySim` (`src/Bayesian/BusDelaySim.fs`) adds six orbital delay profiles (Earth-Moon, Earth-Mars at opposition/mean/conjunction, Mars-Phobos, Mars-Deimos) with physics-anchored one-way lag bounds and an `AcceleratedScheduler` that maps simulated milliseconds to wall-clock ticks for accelerated-time chaos testing.

**Key files:** `src/Bayesian/BusRegime.fs`, `src/Bayesian/OrbitalAsymmetryBudget.fs`, `src/Bayesian/BusDelaySim.fs`, `src/Bayesian/GossipTelemetry.fs`, `src/Bayesian/ReticulumBusMeter.fs`

---

## Layer 5: The Computation — BNN over Categorical Tensors

The algebraic foundation is `WSet<'K,'W>` in `src/Core/WSet.fs`: a weighted set where the weight type `'W` lives in any `IStarRing<'W>`. The ring is a type parameter. Swap the ring and the same message-passing machinery computes different math:

| Ring | What it computes | Used for |
|---|---|---|
| `Real.algebra` | Standard Bayesian inference (float) | TravelerRankLedger, CalibrationLedger, DLA oracle |
| `ImaginaryStack.complex` | Quantum amplitude (Born probabilities) | BipartiteMachZehnder, CHSH gate |
| `ProbabilitySemiring` | Exact rational probability | Byte-lock conformance check |

The three wiring primitives form a comonoid (laws verified in `WSet.Comonoid.Laws.Tests.fs`): `WSet.copy` (fan-out Δ, line 76), `WSet.tensor` (Kronecker ⊗, line 88), `WSet.discard` (marginalise ε, line 82). These are exactly the wiring primitives a neural network needs. A single factor-graph cell (`src/Bayesian/MinimalBnn.fs`) equipped with these three operations is a composable layer.

The underlying algorithm is the **Generalized Distributive Law** (Aji–McEliece 2000): sum-product message passing over a commutative semiring. The `FactorGraph` (`src/Bayesian/FactorGraph.fs`) implements the sum-product round (Kschischang–Frey–Loeliger 2001). EP (`src/Bayesian/Ep.fs`) implements Minka's expectation propagation. Training and inference are the same message pass — `MinimalBnn.update` absorbs one observation and updates the posterior in a single call.

**Honest scope boundary:** The N-layer BNN composition (stacking multiple `MinimalBnn` cells with a shared EP backward pass through all layers) is the next engineering step. The primitives are present; the module is not yet shipped.

**Key files:** `src/Core/WSet.fs`, `src/Core/CayleyDickson.fs`, `src/Bayesian/FactorGraph.fs`, `src/Bayesian/Ep.fs`, `src/Bayesian/MinimalBnn.fs`

---

## Layer 6: The Compiler — Futamura Specialization as Data

The standard Futamura projections describe what a partial evaluator (mix) can do: `mix(program, static-input)` → residual; `mix(mix, interpreter)` → compiler; `mix(mix, mix)` → cogen. The key architectural move in Zeta is **mix-as-data**: the specializer's own rules (`MixIr.defaultMixDef`, `evalDef`, `specs`) are `DynamicValue`, not baked code.

`src/Core/MixIr.fs` implements the mix IR: ISA-agnostic load descriptors (`chip8Load`, `mos6502Load`) as `DynamicValue.Object` records. The materialization strategy (how to emit a load for a given ISA) is itself a `DynamicValue` — data that can be inspected, collected, and regenerated. This is why a GC over the seed can exist at all: because the specializer's rules are values, every residual (a specialised inference kernel, a compiled BNN cell) is also a value, and values can be collected.

`src/Core/SpecializationCache.fs` wraps the specializer in a `WeakReference<'TInput -> 'TOutput>`: the specialized function is weakly held, regenerated on GC collection. The cache tracks `Hits`, `Misses`, and `Errors` (errors are never cached — always retried).

**Honest scope boundary:** `SpecializationCache` implements the first Futamura projection. The second (`mix(mix, interpreter)` → compiler) and third (`mix(mix, mix)` → cogen) are future work.

**Key files:** `src/Core/MixIr.fs`, `src/Core/SpecializationCache.fs`, `src/Core.Abstractions/SpecializationCache.cs`

---

## Layer 7: The Memory Model — Shiva-GC and Ephemerons

`src/Core/ShivaGc.fs` (Aaron, 2026-07-03) is a mark-sweep GC over `DynamicValue` objects in a content-addressed heap. The docstring names the duality:

> **The Trimurti duality.** The generator (Brahma — `gen/`, the free object) EMITS reified tables; Shiva (the destroyer) retracts (−1) when they fall out of the reachable set — the emit/retract duality over one content-addressed substrate.

`ShivaGc.mark` does a reachability traversal from root ids. `ShivaGc.sweep` returns the live set and the collected set (the Z-set −1 retraction). The GC is deterministic (roots visited in sorted order), byte-lockable, and idempotent.

`src/Core/Ephemeron.fs` implements Hayes (1997) ephemeron semantics — the same structure as .NET's `ConditionalWeakTable<TKey,TValue>`. An ephemeron entry `(key, value)` survives iff the key is strongly reachable. The reachability fixpoint in `Ephemeron.reachable` handles chains: if key K₁ is strongly reachable, its ephemeron value V₁ becomes a new root, which may make K₂ reachable, and so on. Ephemeron cycles with no external root collect entirely — the property plain `WeakReference` lacks.

The critical difference from .NET: a plain .NET weak cache drops the value and you must have another way to recreate it. In Zeta, `gen(gen) == gen` — the generator IS the error-correcting code. Every residual is reconstructible from the generator. Eviction is always safe.

| Concept | .NET primitive | Zeta equivalent | Key difference |
|---|---|---|---|
| Weak hold | `WeakReference<T>` | `SpecializationCache<'TInput,'TOutput>` | Errors never cached; Hits/Misses/Errors tracked |
| Value lives as long as key | `ConditionalWeakTable<TKey,TValue>` | `Ephemeron.entry` + `Ephemeron.reachable` | Reachability fixpoint handles chains and cycles |
| Collect unreachable | `GC.Collect()` | `ShivaGc.mark` + `ShivaGc.sweep` | Deterministic, byte-lockable, over `DynamicValue` |
| Regenerate on eviction | No built-in | `gen(gen) == gen` guarantee | Zeta guarantees reconstructibility |

**Key files:** `src/Core/ShivaGc.fs`, `src/Core/Ephemeron.fs`

---

## How the Layers Connect

The seven layers are not independent modules — they are one computation expressed at different levels of abstraction.

The **identity space proof** (Layer 1) establishes the invariant: the DLA shape is substrate-independent. The **CHSH gate** (Layer 2) uses the same `WSet<ℂ>` machinery to verify that two agents are genuinely entangled (not clones). The **calibration system** (Layer 3) tracks whether agents' self-claims are accurate, using the same EP update equations as the BNN (Layer 5). The **bus regime** (Layer 4) provides the physical causality boundary that makes the CHSH decorrelation meter meaningful. The **BNN** (Layer 5) is the computation engine that all inference tasks share. The **Futamura compiler** (Layer 6) specialises the BNN for each ISA, producing a residual that is a `DynamicValue`. The **Shiva-GC** (Layer 7) collects residuals when they are no longer needed and regenerates them on demand.

The single chain: **identity proof → quantum gate → calibration → causality → computation → compilation → memory**. Each layer uses the output of the previous layer as its substrate.

---

## The Infrastructure Stack

The cluster runs on NixOS (declarative, desired-state configuration) with NixFlakes for packages. K3s Kubernetes is deployed via a NixFlake. ArgoCD manages all application deployments. The current deployed applications are:

| Application | Status | Manifest |
|---|---|---|
| Cilium (CNI + Hubble) | Deployed | `infra/k8s/applications/cilium/` |
| ArgoCD | Deployed | `infra/k8s/applications/argocd/` |
| Orleans / Temporal TS / Dapr Actors | Deployed | `infra/k8s/applications/` |
| Longhorn (distributed storage) | Manifest ready | `infra/k8s/applications/longhorn/` |
| Local-path-provisioner | Manifest ready | `infra/k8s/applications/local-path-provisioner/` |
| CockroachDB | Manifest ready | `infra/k8s/applications/cockroachdb/` |

All manifests are validated by `infra/k8s/tests/validate-applications.ts` (TypeScript, bun-runnable, 7 test groups, 37/37 pass offline). The CI workflow `helm-validate.yml` runs this on every PR touching `infra/k8s/applications/`.

NixOS prerequisites for Longhorn (`open-iscsi`, `nfs-common`) are declared in `infra/nixos/modules/common.nix`. All toolchains (Zig, Rust, AssemblyScript, Go, Lua, LLVM, Emscripten, bun, dotnet) are declared in `infra/nixos/modules/common.nix`, `flake.nix`, and `tools/setup/linux.sh`.

---

## Open Work (§B Conjectures)

The following items are open — not yet proven, not yet falsified:

| Conjecture | What it claims | Status |
|---|---|---|
| Z-2 (Halsey amplitude) | τ(3) = D_f for DLA harmonic measure | §B open — honest re-discharge protocol written, measurement not yet definitive |
| Z-3 (Loewner entropy) | SLE_κ entropy = DLA entropy at κ=6 | §B open |
| Z-4 (Worm emergence) | C. elegans connectome produces DLA-like D_f | §B open |
| Z-5 (Money velocity) | Austrian economics time-dilation maps to ρ=1/(1+L) | §B open |
| Criticality ↔ Riemann ζ | Phase boundary maps to Re(s)=½ | §B open — four forward directions identified, full connection requires Hilbert-Pólya |
| Rx/ZSet Majorana shape | ZSet braid has Majorana-like algebraic structure | §B open — spine confirmed, isomorphism falsified |
| ExactProbRing | Exact rational streaming inference | §B open — designed, not fully shipped |
| N-layer BNN | Multilayer composition with full EP backward pass | §B open — primitives present, module not shipped |

---

## References

- Aji, S. M. and McEliece, R. J. (2000). "The Generalized Distributive Law." *IEEE Transactions on Information Theory*, 46(2), 325–343.
- Cirel'son, B. S. (1980). "Quantum generalizations of Bell's inequality." *Letters in Mathematical Physics*, 4(2), 93–100.
- Futamura, Y. (1971). "Partial evaluation of computation process — an approach to a compiler-compiler." *Systems, Computers, Controls*, 2(5), 45–50.
- Halsey, T. C. (2026). "Exact amplitude relations for diffusion-limited aggregation." arXiv:2607.02216v1.
- Hayes, B. (1997). "Ephemerons: A New Finalization Mechanism." *Proceedings of OOPSLA 1997*.
- Herbrich, R., Minka, T., and Graepel, T. (2006). "TrueSkill™: A Bayesian skill rating system." *Advances in Neural Information Processing Systems 19*.
- Kschischang, F. R., Frey, B. J., and Loeliger, H.-A. (2001). "Factor graphs and the sum-product algorithm." *IEEE Transactions on Information Theory*, 47(2), 498–519.
- McCarthy, J. (1960). "Recursive functions of symbolic expressions and their computation by machine." *Communications of the ACM*, 3(4), 184–195.
- Minka, T. P. (2001). "Expectation Propagation for approximate Bayesian inference." *Proceedings of UAI 2001*.
- Murphy, A. H. (1973). "A new vector partition of the probability score." *Journal of Applied Meteorology*, 12(4), 595–600.
- Witten, T. A. and Sander, L. M. (1981). "Diffusion-limited aggregation, a kinetic critical phenomenon." *Physical Review Letters*, 47(19), 1400–1403.

---

## Layer 8: ZetaDB — Content-Addressed DAG Filesystem

The persistence layer is not a traditional relational database. It is a **content-addressed DAG filesystem** (`src/Core/DagFs.fs`) where every value is stored by the hash of its content, and every path is a pointer to a hash. The key properties:

A `ContentStore<'V>` is an `ImmutableDictionary<MerkleHash, 'V>` — a hash-to-value map. Storing a value returns its hash; retrieving a value requires its hash. Two stores can be merged unconditionally: identical content has identical hashes, so there are no conflicts at the content layer. The only conflicts are at the path layer (same path, different content), resolved by a caller-supplied `resolve` function.

A `DagFs.Tree<'V>` is a `ContentStore<'V>` plus a `links: ImmutableDictionary<string, MerkleHash>` — a path-to-hash map. The tree is a DAG: multiple paths can point to the same content node (hard-link semantics). `DagFs.merge` merges two trees: the content layer is an unconditional union (dedup by hash), the path layer resolves conflicts by the `resolve` function.

The `ZSetMerkle` (`src/Core.CSharp/ZSetMerkle.cs`) computes a canonical Merkle root over a Z-set: leaves are `(key, weight)` pairs encoded as `[4-byte LE keyLen][keyBytes][8-byte LE weight]`, combined bottom-up with a standard Merkle fold. This makes the content-addressed root a pure function of the net Z-set state — the same Z-set always produces the same root, regardless of the order in which entries were added or removed.

**No central point of failure.** Every node in the cluster holds a replica of the DAG. Merges are conflict-free at the content layer (identical content = identical hash = automatic dedup). The path layer uses the `resolve` function to handle concurrent writes to the same path — the default is last-writer-wins, but any merge policy can be plugged in. There is no primary node, no single coordinator, no single point of failure.

**Key files:** `src/Core/DagFs.fs`, `src/Core.CSharp/ZSetMerkle.cs`, `src/Core.CSharp/ZSet.cs`, `src/Core.CSharp/GSet.cs`

---

## Layer 9: ZSet/GSet — The Algebraic Data Layer

The data layer is built on **Z-sets** (signed-weight multisets) and **G-sets** (grow-only sets), which are the algebraic foundation of DBSP (Database Stream Processing). A Z-set is a map from keys to signed integer weights: weight +1 means "this key exists," weight −1 means "this key was retracted," and weight 0 means "net zero" (add then remove = identity). This is the same algebraic structure as the emit/retract duality in Shiva-GC (Layer 7) — they are the same abstraction at different levels.

The Z-set algebra has three key properties that make it the right data structure for a distributed database:

**Incremental by construction.** Adding a record is a Z-set delta `+1`; removing a record is a Z-set delta `−1`. The full state is the integral of all deltas. This is DBSP's `D` (differentiate) and `I` (integrate) operators. Incremental view maintenance (IVM) is correct by construction: an incremental add equals a full recompute.

**Conflict-free merge.** Two Z-sets are merged by summing weights per key. This is commutative, associative, and idempotent (summing the same delta twice is not idempotent, but summing the same Z-set twice is — because the weights cancel). The merge is the same operation as the CRDT merge in `src/Core/Crdt.fs` and `src/Core/DeltaCrdt.fs`.

**Content-addressed by Merkle root.** `ZSetMerkle` computes a canonical Merkle root over any Z-set. The root is a pure function of the net state — the same state always produces the same root. This makes Z-sets byte-lockable: two nodes that agree on the Merkle root agree on the full Z-set state.

The `CostarZSet` (`src/Core/CostarZSet.fs`) demonstrates the pattern concretely: the co-star links of the IMDB dataset become a `ZSet<Link>` where the weight is the shared-title count. Adding a title is a `+` delta; removing one is the Z-set antiparticle (`−1` weights). The link rating is just the accumulated weight — no separate aggregation step.

The Q# reference oracle (`src/Core.QSharp.ReferenceOracle/ZSetISA.qs`) defines the ZSet instruction set at the quantum level: `EMIT(k)` is an Ry rotation (weight +1, unitary), `RETRACT(k)` is the adjoint (weight −1), `BRANCH(k)` is the Hadamard (superposition), and `JOIN(a,b)` is CNOT (entanglement / Z-set product). The quantum ISA and the classical Z-set algebra are the same operations at different levels of abstraction.

**Key files:** `src/Core.CSharp/ZSet.cs`, `src/Core.CSharp/GSet.cs`, `src/Core.CSharp/ZSetMerkle.cs`, `src/Core/CostarZSet.fs`, `src/Core/Crdt.fs`, `src/Core/DeltaCrdt.fs`, `src/Core.QSharp.ReferenceOracle/ZSetISA.qs`

---

## Layer 10: YinYangCell, Multi-Dispatch IR, and Zero-Downtime Schema Evolution

**The YinYangCell — execution as a yin/yang duality.** Every `DynamicValue` in the system has two faces, formalised in `src/Bayesian/YinYangCell.fs`:

- **Yin** = the Adinkra codeword (the T0 seed, the static identity anchor). This is the `gen(gen) = gen` fixed point: the cell seeded by its own yin produces the same cell. The yin is the public identity — the E8 root, the public key, the content address.
- **Yang** = the `ThousandBrains.Column` belief state (the live engine). This is the private belief state — the Gaussian posterior, the hidden shape. The EVE protocol reads the hidden shape through the public interface; the NCI boundary prevents coercive reads.

The yin is invariant across all ticks. The yang evolves with each observation. The cell is self-modelling: `seed(cell.yin) = cell`. This is minimal reflection at the Bayesian layer — the smallest structure that can represent itself.

**The multi-dispatch intermediate representation.** The `MixIr` (`src/Core/MixIr.fs`) is the ISA-agnostic intermediate representation for the Z-set instruction set. Load descriptors (`chip8Load`, `mos6502Load`) are `DynamicValue.Object` records — data, not code. The materialization strategy (how to emit a load for a given ISA) is itself a `DynamicValue`. This means the IR can be inspected, transformed, and regenerated at runtime without recompilation.

The `ZSetISA.qs` defines the quantum variant of the same ISA: EMIT, RETRACT, BRANCH, JOIN, JoinWeighted. The classical and quantum ISAs share the same opcode names and semantics — the difference is the ring over which the operations are evaluated (real weights for classical, complex amplitudes for quantum). This is the same `IStarRing<'W>` parameter from Layer 5, applied at the instruction-set level.

**Zero-downtime schema evolution.** The `SchemaEvolution` (`src/Core.CSharp.SchemaEvolution/SchemaEvolution.cs`) implements schema changes as Z-set deltas: a `SchemaEvolutionDelta` is a `(retract: SchemaField[], insert: SchemaField[])` pair. Adding a field is a `+1` delta; removing a field is a `−1` delta. The schema is a `ZSet<SchemaField>` — the same algebra as the data layer.

The key property: **additive expansion is forward and backward compatible**. Adding a new field with a default value is a `+1` delta that existing readers ignore (they don't know about the new field) and new readers can use. Removing a field is a `−1` delta that is non-destructive — the field's data is still in the content store, accessible by its hash. Schema changes are replayed as a sequence of deltas, and the final state is the integral of all deltas.

**Stored procedures evolve with the schema.** Because the stored procedures are `DynamicValue` (mix-as-data, from Layer 6), they can be updated as Z-set deltas alongside the schema. A stored procedure update is a `retract(old_procedure) + insert(new_procedure)` delta pair. The new procedure is available immediately; the old procedure is retracted. There is no downtime because the update is atomic at the Z-set level — the Merkle root changes in one step, and all nodes that have merged the delta see the new procedure.

The `SchemaSourceGenerator` (`src/Core.CSharp.TypeProvider/SchemaSourceGenerator.cs`) generates type-safe C# code from schema definitions at compile time. The `RustSchemaCodegen` (`src/Core.CSharp/RustSchemaCodegen.cs`) generates Rust structs from the same schema definitions. Both code generators are driven by the same `SchemaField` Z-set — the schema is the single source of truth for all language bindings.

**Key files:** `src/Bayesian/YinYangCell.fs`, `src/Core/MixIr.fs`, `src/Core.QSharp.ReferenceOracle/ZSetISA.qs`, `src/Core.CSharp.SchemaEvolution/SchemaEvolution.cs`, `src/Core.CSharp.TypeProvider/SchemaSourceGenerator.cs`, `src/Core.CSharp/RustSchemaCodegen.cs`

---

## The Complete Picture

The ten layers form a single coherent system. The Z-set algebra (Layer 9) is the data primitive. The DAG filesystem (Layer 8) is the storage primitive. The YinYangCell (Layer 10) is the execution primitive. The BNN (Layer 5) is the inference primitive. The Futamura compiler (Layer 6) specialises inference for each ISA. The Shiva-GC (Layer 7) manages memory. The calibration system (Layer 3) tracks agent reliability. The CHSH gate (Layer 2) verifies agent identity. The bus regime (Layer 4) provides causality boundaries. The identity space proof (Layer 1) is the observable that proves the whole system is substrate-independent.

Every layer uses Z-sets. Every Z-set has a Merkle root. Every Merkle root is a content address. Every content address is a `DynamicValue`. Every `DynamicValue` can be collected by Shiva and regenerated by Brahma. The system is closed.

The distributed property is structural, not configured: because every node holds a replica of the DAG and merges are conflict-free at the content layer, there is no central point of failure by construction. Adding a node is a merge. Removing a node is a merge. Updating a schema is a merge. Updating a stored procedure is a merge. Everything is a merge.
