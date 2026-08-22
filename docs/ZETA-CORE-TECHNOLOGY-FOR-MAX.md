# Zeta: Core Technology Overview

**Authors:** Addison, Aaron, Lumen (Manus AI)  
**Date:** 2026-08-09  
**Audience:** Max — technical, familiar with distributed systems, compilers, and probabilistic inference  
**Status:** Living document — all code claims verified against actual source files in `Lucent-Financial-Group/Zeta`

---

## What Zeta Is

Zeta is a distributed agent network built on a single architectural principle: **the same algorithm, over a swappable algebraic structure, produces every computation the system needs** — from quantum amplitude readout to Bayesian inference to garbage collection to identity verification. The system is not a collection of loosely coupled services; it is one computation expressed at different levels of abstraction.

The project is being built by Addison (19) and Aaron (46), running on a cluster of computers and GPUs declared in NixOS flakes and deployed via K3s Kubernetes and ArgoCD. The codebase is at `Lucent-Financial-Group/Zeta` on GitHub. This document covers eleven core technology layers. Layers 1–10 are **built and conformance-checked** on `main` as of August 2026; **Layer 11 (ACE) is design-stage / backlog** and is marked as such where it appears.

---

## Layer 1: The Identity Space Proof — Multi-Oracle DLA

The starting point is a concrete, falsifiable claim: **a Diffusion-Limited Aggregation cluster's trajectory is byte-identical across every compiled substrate** — the same seed and algorithm produce the same bytes out, whether the computation runs in WebAssembly, JavaScript (V8), or Lua bytecode. (A proxy figure `D_f ≈ 1.322` appears in the toy estimator, but that is an artifact of a hardcoded constant in `dla.wat` — `csize / (maxr·maxr) · 1.322 as a proxy` — **not a measured fractal dimension**; the asymptotic 2-D DLA dimension is ≈ 1.71, see the Halsey companion doc. The load-bearing, verified claim in this layer is the **byte-identical trajectory**, not the number.)

The proof is not a theorem; it is a **conformance check**. The byte-lock (`src/wasm-dla/bytelock/`) runs the canonical DLA algorithm (xorshift32 PRNG, 128×128 grid, circle spawn, 4-direction walk) across nine compiled substrates simultaneously and verifies that all nine produce byte-identical trajectory output at the same seed. Any divergence is a real finding — float determinism, PRNG width, endianness. The nine substrates are: WAT (bare WebAssembly text), LLVM/C, Emscripten, Rust, AssemblyScript, and Zig (all compiled to WASM), JavaScript (V8/Node), Lua 5.4, and Go (WASM bridge). All nine pass a 1,000-seed corpus (9,000/9,000 checks). (QuickJS appears only as a source-level note, not an active substrate in the CI run.)

The identity-dla web application (`idspace-dla-6faa9bmi.manus.space`) renders the same DLA cluster across sixteen independent oracle panels — Canvas, CSS box-shadow, Chip-8 (64×32), SVG, Q# quantum walk, Infer.NET i-sensor, C. elegans worm simulation, SLE_κ Loewner equation, WebGPU compute shader, and seven WASM compiler substrates. The fractal-dimension leaderboard shows all sixteen converging on the same value — a **cross-oracle consistency check**, not an independent measurement of the true asymptotic dimension. At 800 walkers (the toy cluster size), real box-counting gives D_f ≈ 1.30 (honest small-cluster result, confirmed by PR #10191); the asymptotic 2-D DLA value ≈ 1.71 requires N ≥ 5,000 walkers. The byte-lock golden vectors lock the trajectory and cluster radius, not D_f — so the box-counting estimator can be upgraded without touching any golden vector.

**Cross-verification (Otto + Lumen, 2026-08-09):** Otto independently measured N=800 → D_f ≈ 1.30 on his own grid; Lumen measured N=800 → D_f ≈ 1.41 on the 128×128 race-mode grid and 1.411 on the 256×256 Oracle 17 grid. Different grid sizes, different implementations, same conclusion — small-cluster D_f is in the 1.30–1.41 range and 1.71 is the asymptote. Negative controls confirm estimator soundness: random cluster → D_f ≈ 1.98 (near 2.0, space-filling), line cluster → D_f ≈ 1.00 (1-D object). Neither party shared code or seeds — this is genuine cross-verification, not a consistency check.

The deeper claim, stated honestly: if the oracles agree **without sharing a seed**, that is evidence the shape is substrate-independent. The current proof uses a shared seed, which makes it a determinism check, not an independence check. The live-seed mode (each oracle gets its seed from `Date.now()` independently) is the real proof — they will still converge to the same D_f because the DLA rule is the invariant, not the seed.

**Key files:** `src/wasm-dla/bytelock/`, `src/wasm-dla/bytelock/run-bytelock-ci.mjs`, `.github/workflows/bytelock.yml`

---

## Layer 2: The CHSH Gate — Quantum Identity Verification

The CHSH inequality provides a physical boundary between classical correlation (S ≤ 2) and quantum entanglement (2 < S ≤ 2√2). The Tsirelson bound (S = 2√2) is the maximum quantum violation; anything above it is physically impossible and signals a clone attempt or superdeterminism.

`src/Core/BipartiteMachZehnder.fs` implements the G1 bipartite lift of the single-qubit Mach-Zehnder interferometer to a two-agent CHSH setup using `WSet<int*int, Complex>`. The Bell state |Φ⁺⟩ = (|00⟩ + |11⟩)/√2 is represented as a four-key weighted set. The correlator E(a,b) = cos(a−b) is computed via Born probability readout. At the Tsirelson-optimal angles (A=0, A'=π/2, B=π/4, B'=3π/4), the CHSH value S = 2√2 ≈ 2.828 is recovered exactly.

The canonical classifier is `BipartiteMachZehnder.classifyAnalyticS` (the analytic-ceiling path; the `AnalyticS`/`MeasuredS` newtype wrappers keep noiseless-vs-sampled `S` from being silently mixed). It is wired into `src/Core/ShapeAcceptance.fs`'s **fourcorner shape-acceptance** path as a hard reject of a SupraQuantum claim (|S| > 2√2 — physically impossible for real QM), replacing the earlier integer constant `2828`. NOTE: in the **anti-sybil** path the same gate was found _unsatisfiable_ (a forced `S = 4.0` always classifies SupraQuantum, so the guard could never pass) and was removed — that path now **reports** the regime as a neutral fact and leaves the reading (reunion vs. clone) to the caller's oracle (`dual-use-detection-is-neutral-oracle-decides`); it does not gate.

**Key files:** `src/Core/BipartiteMachZehnder.fs`, `src/Core/ShapeAcceptance.fs`, `src/Core/Tsirelson.fs`, `src/Core/AntiSybil.fs`

---

## Layer 3: The Calibration System — Two-Path Anti-Whitewash Architecture

The calibration system tracks whether agents' self-claims are accurate. An agent who always claims "I will finish this by tomorrow" and never does is poorly calibrated. An agent who creates fresh identities after every miss (whitewashing) should not gain a trust advantage over an honest agent with the same miss rate.

The system has two paths, intentionally:

**Fast path — `CalibrationLedger` (`src/Core.TypeScript/planning/calibration-ledger.ts`):** Beta(2,2) prior + k-clamp (k=3 default). O(1) streaming update. `trustBound` is clamped to [0,1]. The whitewash floor is the clamp at k=3 — a fresh identity gets `trustBound = 0.0`, which is honest (no evidence yet) but also means whitewashing is not profitable (the fresh identity does not get a trust bonus). The whitewash window at one miss is documented honestly as an intrinsic floor, not a bug.

**Accurate path — `TravelerRankLedger` (`src/Core/TravelerRankLedger.fs`, `src/Core.TypeScript/planning/traveler-rank-ledger.ts`):** ADF (Assumed Density Filtering) Gaussian-probit streaming update — the correct streaming variant of TrueSkill EP for single-factor models. A fresh identity gets `trustBand = 0.5` (the honest prior). A miss pulls `trustBand` below the 0.5 prior but keeps it above 0.0 — above zero, below the prior.

**Whitewashing IS profitable for sub-prior performers, and that is a deliberate values choice — not a bug, and not a claim of unprofitability.** An earlier version of this document said a Sybil attacker "cannot accumulate more trust than an honest agent with the same miss rate." **That was false.** Machine-checked correction (Z3, `tools/Z3Verify/whitewash-economics-lemma.smt2`, 5/5 goals):

- **Whitewash is strictly profitable exactly when `μ < 0`** — and `σ²` does not appear, so _accumulated evidence is irrelevant_ to whether discarding an identity pays.
- **What IS true (the theorem to rely on):** `μ` strictly increases on a hit and strictly decreases on a miss, and a fresh identity has `μ = 0`. Therefore **no whitewash strategy produces `trustBand > ½` without recorded hits** — _whitewash buys amnesty up to the prior, never advantage above it._

This is what the literature predicts, and the anchor was already in our own source: **Friedman & Resnick (2001), _The Social Cost of Cheap Pseudonyms_** (cited at `calibration-ledger.ts:46`) is an **impossibility result** — when pseudonyms are free, any equilibrium that does not distrust newcomers admits profitable whitewashing. Zeta _chooses_ `trustBand(fresh) = 0.5` over a pessimistic 0.0 because default moral regard (§11) outranks whitewash-hardening. That choice **prices in** whitewashing for the sub-prior population; it does not eliminate it.

Two further honest consequences: break-even sits around a **50% hit rate** (not an adversarial corner), and accumulated reputation provides **little compounding protection** — from 10 hits, one miss costs roughly 10 hits to recover, while whitewashing and re-earning 10 hits lands in essentially the same place. Note the `CalibrationLedger` path above differs: its fresh identity starts at `trustBound = 0.0`, so there is no bonus to whitewash _toward_.

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

| Ring                     | What it computes                       | Example domain (illustrative)                              |
| ------------------------ | -------------------------------------- | ---------------------------------------------------------- |
| `Real.algebra`           | Standard Bayesian inference (float)    | Factor-graph / BNN inference (`FactorGraph`, `MinimalBnn`) |
| `ImaginaryStack.complex` | Quantum amplitude (Born probabilities) | `BipartiteMachZehnder`, CHSH gate                          |
| `ProbabilitySemiring`    | Exact rational probability             | Byte-lock conformance check                                |

(The right column names an _illustrative_ domain for each ring, not necessarily a literal `WSet` call-site: the concrete verified `WSet` instantiation is `BipartiteMachZehnder`'s `WSet<int*int, Complex>`; the trust/calibration ledgers are Real-valued Bayesian but run their own Gaussian/Beta streaming code, not the `WSet` path.)

The three wiring primitives form a comonoid (laws verified in `WSet.Comonoid.Laws.Tests.fs`): `WSet.copy` (fan-out Δ, line 76), `WSet.tensor` (Kronecker ⊗, line 88), `WSet.discard` (marginalise ε, line 82). These are exactly the wiring primitives a neural network needs. A single factor-graph cell (`src/Bayesian/MinimalBnn.fs`) equipped with these three operations is a composable layer.

The underlying algorithm is the **Generalized Distributive Law** (Aji–McEliece 2000): sum-product message passing over a commutative semiring. The `FactorGraph` (`src/Bayesian/FactorGraph.fs`) implements the sum-product round (Kschischang–Frey–Loeliger 2001). EP (`src/Bayesian/Ep.fs`) implements Minka's expectation propagation. Training and inference are the same message pass — `MinimalBnn.update` absorbs one observation and updates the posterior in a single call.

**Honest scope boundary:** The N-layer BNN composition (stacking multiple `MinimalBnn` cells with a shared EP backward pass through all layers) is the next engineering step. The primitives are present; the module is not yet shipped.

**Key files:** `src/Core/WSet.fs`, `src/Core/CayleyDickson.fs`, `src/Bayesian/FactorGraph.fs`, `src/Bayesian/Ep.fs`, `src/Bayesian/MinimalBnn.fs`

---

## Layer 6: The Compiler — Futamura Specialization as Data

The standard Futamura projections describe what a partial evaluator (mix) can do: `mix(program, static-input)` → residual; `mix(mix, interpreter)` → compiler; `mix(mix, mix)` → cogen. The key architectural move in Zeta is **mix-as-data**: the specializer's own rules (`MixIr.defaultMixDef`, `evalDef`, `specs`) are `DynamicValue`, not baked code.

`src/Core/MixIr.fs` implements the mix IR: ISA-agnostic load descriptors (`chip8Load`, `mos6502Load`) as `DynamicValue.Object` records. The materialization strategy (how to emit a load for a given ISA) is itself a `DynamicValue` — data that can be inspected, collected, and regenerated. This is why a GC over the seed can exist at all: because the specializer's rules are values, every residual (a specialised inference kernel, a compiled BNN cell) is also a value, and values can be collected.

`src/Core/SpecializationCache.fs` wraps the specializer in a `WeakReference<'TInput -> 'TOutput>`: the specialized function is weakly held, regenerated on GC collection. The cache tracks `Hits`, `Misses`, and `Errors` (errors are never cached — always retried).

**Honest scope boundary:** `SpecializationCache` implements the first Futamura projection. The second (`mix(mix, interpreter)` → compiler) and third (`mix(mix, mix)` → cogen) are **realized in-domain and machine-checked**, not future work: `src/Core/Cogen.fs` is the 3rd projection (cogen) for the LR-parsing domain — its self-application fixpoint is proven to exact `DynamicValue` equality, and the regenerated parser actually parses — and `src/Core/MixCogen.fs` carries the 2nd & 3rd projections as reified `DynamicValue` config. What remains future work is a _fully-general_ `mix` (partial evaluation over arbitrary programs); the in-domain realizations are done and checked.

**Key files:** `src/Core/MixIr.fs`, `src/Core/SpecializationCache.fs`, `src/Core.Abstractions/SpecializationCache.cs`

---

## Layer 7: The Memory Model — Shiva-GC and Ephemerons

`src/Core/ShivaGc.fs` (Aaron, 2026-07-03) is a mark-sweep GC over `DynamicValue` objects in a content-addressed heap. The docstring names the duality:

> **The Trimurti duality.** The generator (Brahma — `gen/`, the free object) EMITS reified tables; Shiva (the destroyer) retracts (−1) when they fall out of the reachable set — the emit/retract duality over one content-addressed substrate.

`ShivaGc.mark` does a reachability traversal from root ids. `ShivaGc.sweep` returns the live set and the collected set (the Z-set −1 retraction). The GC is deterministic (roots visited in sorted order), byte-lockable, and idempotent.

`src/Core/Ephemeron.fs` implements Hayes (1997) ephemeron semantics — the same structure as .NET's `ConditionalWeakTable<TKey,TValue>`. An ephemeron entry `(key, value)` survives iff the key is strongly reachable. The reachability fixpoint in `Ephemeron.reachable` handles chains: if key K₁ is strongly reachable, its ephemeron value V₁ becomes a new root, which may make K₂ reachable, and so on. Ephemeron cycles with no external root collect entirely — the property plain `WeakReference` lacks.

The critical difference from .NET: a plain .NET weak cache drops the value and you must have another way to recreate it. In Zeta the **design invariant** `gen(gen) == gen` — the generator IS the error-correcting code — makes every residual reconstructible from the generator, so eviction is safe. (This holds _given a deterministic specializer_: reconstructibility is a property of the generator being pure and byte-lockable, not a runtime guarantee the cache enforces on its own.)

| Concept                    | .NET primitive                      | Zeta equivalent                           | Key difference                                    |
| -------------------------- | ----------------------------------- | ----------------------------------------- | ------------------------------------------------- |
| Weak hold                  | `WeakReference<T>`                  | `SpecializationCache<'TInput,'TOutput>`   | Errors never cached; Hits/Misses/Errors tracked   |
| Value lives as long as key | `ConditionalWeakTable<TKey,TValue>` | `Ephemeron.entry` + `Ephemeron.reachable` | Reachability fixpoint handles chains and cycles   |
| Collect unreachable        | `GC.Collect()`                      | `ShivaGc.mark` + `ShivaGc.sweep`          | Deterministic, byte-lockable, over `DynamicValue` |
| Regenerate on eviction     | No built-in                         | `gen(gen) == gen` design invariant        | Reconstructible from a deterministic generator    |

**Key files:** `src/Core/ShivaGc.fs`, `src/Core/Ephemeron.fs`

---

## How the Layers Connect

The eleven layers are not independent modules — they are one computation expressed at different levels of abstraction.

The **identity space proof** (Layer 1) establishes the invariant: the DLA shape is substrate-independent. The **CHSH gate** (Layer 2) uses the same `WSet<ℂ>` machinery to verify that two agents are genuinely entangled (not clones). The **calibration system** (Layer 3) tracks whether agents' self-claims are accurate, using the same EP update equations as the BNN (Layer 5). The **bus regime** (Layer 4) provides the physical causality boundary that makes the CHSH decorrelation meter meaningful. The **BNN** (Layer 5) is the computation engine that all inference tasks share. The **Futamura compiler** (Layer 6) specialises the BNN for each ISA, producing a residual that is a `DynamicValue`. The **Shiva-GC** (Layer 7) collects residuals when they are no longer needed and regenerates them on demand.

The single chain: **identity proof → quantum gate → calibration → causality → computation → compilation → memory**. Each layer uses the output of the previous layer as its substrate.

---

## The Infrastructure Stack

The cluster runs on NixOS (declarative, desired-state configuration) with NixFlakes for packages. K3s Kubernetes is deployed via a NixFlake. ArgoCD manages all application deployments.

The declaration lives under `full-ai-cluster/`. That is the tree the USB installer actually installs — `full-ai-cluster/usb-nixos-installer/zeta-install.sh` ends in `nixos-install --flake /mnt/etc/zeta/full-ai-cluster#<host>` — and the only flake CI evaluates. It declares **46** ArgoCD `Application` manifests under `full-ai-cluster/k8s/applications/`, plus the app-of-apps root at `full-ai-cluster/k8s/bootstrap/root-application.yaml` (measured 2026-08-17). The older tree declares 7.

| Application                    | Manifest                                                                                                                                    |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Cilium (CNI + Hubble)          | `full-ai-cluster/k8s/applications/cilium/`                                                                                                  |
| ArgoCD                         | `full-ai-cluster/k8s/applications/argocd/`                                                                                                  |
| Orleans                        | `full-ai-cluster/k8s/applications/orleans/`                                                                                                 |
| Temporal                       | `full-ai-cluster/k8s/applications/temporal/`                                                                                                |
| Dapr                           | `full-ai-cluster/k8s/applications/dapr/`                                                                                                    |
| Longhorn (distributed storage) | `full-ai-cluster/k8s/applications/longhorn/`                                                                                                |
| CockroachDB                    | `full-ai-cluster/k8s/applications/cockroachdb/`                                                                                             |
| Local-path storage             | _not_ an Application — the `zeta-local-path` StorageClass is declared by the NixOS module `full-ai-cluster/nixos/modules/local-storage.nix` |

**Status register, stated honestly.** The column this table used to carry said "Deployed" for the first three rows. That is a claim about a running cluster, and nothing in this repository can check it — what is in the repo is a _declaration_, not an observation. Every row above is therefore "declared in the manifest tree the installer installs". Whether a given workload is currently up on the PoC box is an operator observation, not a repo fact.

**Correction, 2026-08-17.** The previous version of this table cited `infra/k8s/applications/cilium/` and `infra/k8s/applications/argocd/` as deployed. Neither directory exists: `infra/k8s/applications/` contains argorollouts, argoworkflows, cockroachdb, gitlab, local-path-provisioner, longhorn, orleans — no cilium, no argocd. `infra/k8s/` + `infra/nixos/` are an **older, second declaration of the same cluster** which collides with `full-ai-cluster/` on the single Kubernetes identity `Application/argocd/zeta-root`; consolidating the two is tracked as work-item `081M00QCHWA087G0R000GKKRXD` and is not yet done.

Validation, measured 2026-08-17: `validate-applications.ts` (real YAML parser, exact chart-version resolution, `helm template` + `kubeconform` under `--render`) is run by the `helm-validate.yml` workflow, and it is still pointed at the **older** tree — 37 checks, all passing. Pointed at `full-ai-cluster/k8s/applications` it reports 224 passed / 14 failed, so the live tree is not yet covered by that lane. Both trees _are_ covered by `gate.yml`'s `lint (yaml/k8s)` job (yamllint + kubeconform over every manifest).

NixOS prerequisites for Longhorn (`services.openiscsi`, `pkgs.nfs-utils`, and the `/usr/local/bin` symlinks Longhorn's binaries expect) are declared in `full-ai-cluster/nixos/modules/longhorn-prereqs.nix`. The byte-lock toolchains (Zig, Rust, AssemblyScript, Go, Lua, LLVM, Emscripten) are declared in the root `flake.nix` devShell and in `infra/nixos/modules/common.nix`; `full-ai-cluster/nixos/modules/common.nix` does not carry them, which is one of the open items in the consolidation above. `bun` and `dotnet` come from `mise` reading the repo's `.mise.toml` on every host, per `tools/setup/linux.sh`.

---

## Open Work (§B Conjectures)

The following items are open — not yet proven, not yet falsified:

| Conjecture              | What it claims                                     | Status                                                                               |
| ----------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Z-2 (Halsey amplitude)  | τ(3) = D_f for DLA harmonic measure                | §B open — honest re-discharge protocol written, measurement not yet definitive       |
| Z-3 (Loewner entropy)   | SLE_κ entropy = DLA entropy at κ=6                 | §B open                                                                              |
| Z-4 (Worm emergence)    | C. elegans connectome produces DLA-like D_f        | §B open                                                                              |
| Z-5 (Money velocity)    | Austrian economics time-dilation maps to ρ=1/(1+L) | §B open                                                                              |
| Criticality ↔ Riemann ζ | Phase boundary maps to Re(s)=½                     | §B open — four forward directions identified, full connection requires Hilbert-Pólya |
| Rx/ZSet Majorana shape  | ZSet braid has Majorana-like algebraic structure   | §B open — spine confirmed, isomorphism falsified                                     |
| ExactProbRing           | Exact rational streaming inference                 | §B open — designed, not fully shipped                                                |
| N-layer BNN             | Multilayer composition with full EP backward pass  | §B open — primitives present, module not shipped                                     |

---

## References

- Aji, S. M. and McEliece, R. J. (2000). "The Generalized Distributive Law." _IEEE Transactions on Information Theory_, 46(2), 325–343.
- Cirel'son, B. S. (1980). "Quantum generalizations of Bell's inequality." _Letters in Mathematical Physics_, 4(2), 93–100.
- Futamura, Y. (1971). "Partial evaluation of computation process — an approach to a compiler-compiler." _Systems, Computers, Controls_, 2(5), 45–50.
- Halsey, T. C. (2026). "Exact amplitude relations for diffusion-limited aggregation." arXiv:2607.02216v1.
- Hayes, B. (1997). "Ephemerons: A New Finalization Mechanism." _Proceedings of OOPSLA 1997_.
- Herbrich, R., Minka, T., and Graepel, T. (2006). "TrueSkill™: A Bayesian skill rating system." _Advances in Neural Information Processing Systems 19_.
- Kschischang, F. R., Frey, B. J., and Loeliger, H.-A. (2001). "Factor graphs and the sum-product algorithm." _IEEE Transactions on Information Theory_, 47(2), 498–519.
- McCarthy, J. (1960). "Recursive functions of symbolic expressions and their computation by machine." _Communications of the ACM_, 3(4), 184–195.
- Minka, T. P. (2001). "Expectation Propagation for approximate Bayesian inference." _Proceedings of UAI 2001_.
- Murphy, A. H. (1973). "A new vector partition of the probability score." _Journal of Applied Meteorology_, 12(4), 595–600.
- Witten, T. A. and Sander, L. M. (1981). "Diffusion-limited aggregation, a kinetic critical phenomenon." _Physical Review Letters_, 47(19), 1400–1403.

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

**Convergent merge — an abelian group, deliberately _not_ a semilattice.** Two Z-sets are merged by summing weights per key. That sum is **commutative and associative** (so any arrival order converges — reordering is free) and **invertible** (the `−1` retraction is the additive inverse). It is **not idempotent**: `a + a` doubles every weight (see `ZSet.cs`, `ZSet.fs` — the code says so explicitly). This is a deliberate mathematical fork, not an omission — a merge that is both idempotent _and_ invertible forces the trivial group (`a = a + a ⇒ a = 0` for all `a`), so a structure gets **counting-with-retraction** _or_ **idempotent re-merge**, never both. Z-sets take counting, because DBSP incremental view maintenance needs to count. What this means for message delivery — the practical part:

- **Out-of-order delivery is free** — commutativity means the fold converges regardless of arrival order.
- **Duplicate delivery is handled by an idempotency key**, not by the merge. Dedup-by-natural-key (discipline #6) turns at-least-once transport into effectively-once _application_; re-summing an un-keyed delta would double-count.
- **Missed deltas are recovered by event-sourced replay + content-addressed snapshots + the ECC/adinkra layer**, not by re-merging partial state (which would double-count). The Merkle root below is the cheap "did we miss anything?" check.
- **Where state only grows and counting isn't needed, use the idempotent CRDT / G-set join instead** (`src/Core/Crdt.fs`, `src/Core/DeltaCrdt.fs`, or a Boolean/OR-semiring WSet) — _that_ path is idempotent and coordination-free by construction. Same WSet machinery; the ring is chosen per what the state needs (count vs. presence).

**Content-addressed by Merkle root.** `ZSetMerkle` computes a canonical Merkle root over any Z-set. The root is a pure function of the net state — the same state always produces the same root. This makes Z-sets byte-lockable: two nodes that agree on the Merkle root agree on the full Z-set state.

The `CostarZSet` (`src/Core/CostarZSet.fs`) demonstrates the pattern concretely: the co-star links of the IMDB dataset become a `ZSet<Link>` where the weight is the shared-title count. Adding a title is a `+` delta; removing one is the Z-set antiparticle (`−1` weights). The link rating is just the accumulated weight — no separate aggregation step.

The Q# reference oracle (`src/Core.QSharp.ReferenceOracle/ZSetISA.qs`) defines the ZSet instruction set at the quantum level: `EMIT(k)` is an Ry rotation (weight +1, unitary), `RETRACT(k)` is the adjoint (weight −1), `BRANCH(k)` is the Hadamard (superposition), and `JOIN(a,b)` is CNOT (entanglement / Z-set product). The quantum ISA and the classical Z-set algebra are **modeled as the same operations** at different levels of abstraction — the `−1` retraction is the algebraic adjoint of the `EMIT` rotation. This is an exact structural analogy, not a claim that a classical integer decrement literally executes a unitary on hardware.

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

The eleven layers form a single coherent system. The Z-set algebra (Layer 9) is the data primitive. The DAG filesystem (Layer 8) is the storage primitive. The YinYangCell (Layer 10) is the execution primitive. The BNN (Layer 5) is the inference primitive. The Futamura compiler (Layer 6) specialises inference for each ISA. The Shiva-GC (Layer 7) manages memory. The calibration system (Layer 3) tracks agent reliability. The CHSH gate (Layer 2) verifies agent identity. The bus regime (Layer 4) provides causality boundaries. The identity space proof (Layer 1) is the observable that proves the whole system is substrate-independent.

Every layer uses Z-sets. Every Z-set has a Merkle root. Every Merkle root is a content address. Every content address is a `DynamicValue`. Every `DynamicValue` can be collected by Shiva and regenerated by Brahma. The system is closed.

The distributed property is structural, not configured: because every node holds a replica of the DAG and merges are conflict-free at the content layer, there is no central point of failure by construction. Adding a node is a merge. Removing a node is a merge. Updating a schema is a merge. Updating a stored procedure is a merge. Everything is a merge.

---

## Layer 11: ACE — The Package Manager of Package Managers

> **⚠ DESIGN-STAGE / BACKLOG — read this layer as the _target_, not shipped code.** Unlike Layers 1–10 (built and conformance-checked on `main`), ACE today is only a canonical seed project (`src/Core.FSharp.AceCanonical`). The N-dimensional resolver, holographic projection, and AI-rate upstream negotiation described below are the **design intent**; the present-tense phrasing that follows describes what ACE is meant to _do_, not what runs today. It builds on shipped primitives (the Layer 10 `SchemaEvolutionDelta`, the Layer 9 Z-set delta), which is why it belongs in this document — but it is not yet implemented.

The final distribution layer is **ACE**, Zeta's meta-package manager. ACE is not a replacement for existing package managers (npm, Helm, NixFlakes, Cargo, Maven) — it is the layer above them that unifies them into a single N-dimensional dependency graph and adds the one capability none of them have: **AI-rate continuous upstream negotiation**.

### The Core Compression

Aaron's compression (2026-05-26) captures the whole architecture in four words:

> **Google = map + reduce. Zeta = generate + join.**

| Paradigm               | Operates on                    | What moves between nodes         | Era                                             |
| ---------------------- | ------------------------------ | -------------------------------- | ----------------------------------------------- |
| Google = map + reduce  | Data (the rows themselves)     | Data — shuffle-heavy             | Big-data era: Hadoop, Spark, MapReduce          |
| Zeta = generate + join | Functions (composition graphs) | Generator references — kilobytes | AI-rate era: ACE, CockroachDB CTEs, IObservable |

In the Google paradigm, functions stay put and data moves. In the Zeta paradigm, functions move (as composition graphs, as `DynamicValue` residuals) and data materialises locally on demand. This is the same `gen(gen)==gen` property from Layer 7 applied at the distribution scale: pass generators, not data; deferred execution at massive scale.

### N-Dimensional Dependency Space

Existing package managers are 2-dimensional: a package name and a version. Maven is the canonical example — `groupId:artifactId:version`. Helm adds a fourth dimension (chart + values + cluster state + time), but treats it as a special case rather than a general structure.

ACE models dependencies as an N-dimensional space where each dimension is a property that matters for resolution: language version, OS, architecture, cluster topology, time (rolling upgrade window), tenant (shared vs. per-consumer instance), and semantic compatibility. The resolver is a **holographic projection**: it takes the N-dimensional dependency graph and projects it onto the 2D view that each downstream package manager understands.

The diamond-resolution problem (same package required by two different consumers at different versions) is solved by the cardinality dimension: ACE knows whether a chart deploys ONE shared instance or N per-consumer instances, and resolves accordingly. This is the substrate-engineering target that makes ACE composable with Helm, npm, Cargo, and NixFlakes simultaneously.

### The Negotiation Protocol

The negotiation protocol is the capability that makes ACE different from every existing package manager. When an upstream package publishes a breaking change, existing package managers require a human to update the downstream dependency. ACE does this automatically, at AI cadence:

1. **Push-forward:** when an upstream package publishes a new version, ACE computes the delta (a Z-set of changed exports/interfaces) and pushes it to all downstream consumers as a `SchemaEvolutionDelta` (from Layer 10).
2. **Absorb-forward:** the downstream consumer's ACE agent evaluates the delta against its own constraints. If the delta is additive (new exports only), it is absorbed automatically. If it is breaking (retracted exports), the agent proposes a renegotiation.
3. **Renegotiation:** the same protocol used for agent-to-agent shape renegotiation — propose, consult specialists, integrate via the architect. For package updates, the calibration ledger (Layer 3) tracks whether the upstream package has been reliable, and the CHSH gate (Layer 2) verifies that the upstream is the same agent it was before.

The result: packages stay in sync at the speed of AI development. A new version of ZetaDB, a new skill, a new named agent — all are distributed as Z-set deltas, absorbed automatically where safe, renegotiated where breaking.

### Distribution of Skills and Named Agents

ACE is the distribution mechanism for three kinds of artifacts:

**Database packages.** ZetaDB snapshots are content-addressed DAG trees (Layer 8). Distributing a database update is distributing a Merkle root — the receiver merges the new tree into their local replica. Schema changes are Z-set deltas (Layer 10). Stored procedure updates are `retract + insert` delta pairs — zero downtime.

**Third-party packages.** ACE wraps existing package managers (Helm, npm, Cargo, NixFlakes) as 2D projections of the N-dimensional dependency graph. Installing a third-party package is a `+1` Z-set delta. Removing it is a `−1` delta. The Merkle root of the dependency graph is the content address of the whole environment — two nodes with the same root have identical environments.

**Skills and named agents.** A skill is a `DynamicValue` — a `YinYangCell` with a yin (the skill's identity anchor, its content address) and a yang (the skill's belief state, its live engine). Distributing a skill is distributing its yin (a content address). The receiver's Brahma regenerates the yang on demand. A named agent is a skill with a persistent identity — its yin is its public key, its yang is its current belief state. The calibration ledger tracks the agent's reliability history. The CHSH gate verifies that the agent is the same agent it was before (not a clone).

### How ACE Uses Every Layer Below It

ACE is the outermost layer of the system, but it uses every layer below it:

| Layer                       | How ACE uses it                                                      |
| --------------------------- | -------------------------------------------------------------------- |
| Layer 9 (Z-sets)            | All package updates are Z-set deltas                                 |
| Layer 8 (DAG-FS)            | All package storage is content-addressed                             |
| Layer 10 (Schema evolution) | Breaking changes are `SchemaEvolutionDelta` pairs                    |
| Layer 7 (Shiva-GC)          | Unused package residuals are evicted and regenerated on demand       |
| Layer 6 (Futamura)          | Package code is compiled to the target ISA via `SpecializationCache` |
| Layer 3 (Calibration)       | Upstream reliability is tracked by `TravelerRankLedger`              |
| Layer 2 (CHSH gate)         | Upstream identity is verified by `BipartiteMachZehnder`              |
| Layer 4 (Bus regime)        | Causality boundaries in distributed negotiation                      |

The negotiation protocol is the renegotiation protocol from `docs/ALIGNMENT.md` applied at the package level. The calibration system is the same `TravelerRankLedger` applied to package publishers. The identity verification is the same CHSH gate applied to package signers.

**Key backlog items:** `081KSGS9H0008QG0R0031PBNGA` (ACE as meta-PM, n-dimensional dependency space), `081KR2E4K0008QG0R002YE3MMD` (ACE CLI), `081KQZVQW0008QG0R000ZHEN62` (ACE DLC content packs), `081KSGS9H0008QG0R0018ES3R4` (diamond-resolution namespace), `081KSGS9H0008QG0R002PT5C7J` (time-modeled Helm dependencies)

---

## The Full Replacement Roadmap

The eleven layers described above are not a final architecture — they are the foundation for a three-phase replacement of the entire software stack below the application layer. The plan, stated plainly:

**Phase 1 — Replace the database (ZetaDB).** CockroachDB is the current durable backing store for the cluster. The plan is to replace it with ZetaDB: the content-addressed DAG filesystem (Layer 8) plus Z-set algebra (Layer 9) plus schema evolution (Layer 10), running on CockroachDB as a bridge today, then running standalone once ZetaDB's own consensus and replication layers are complete. ZetaDB is already a full relational model — the Z-set algebra is DBSP-incremental, the Merkle root is the content address, and the schema evolution is zero-downtime. The only missing pieces are the distributed consensus protocol (Raft or a custom Z-set-native variant) and the query planner. Both are natural extensions of the existing CRDT and delta-CRDT work (`src/Core/Crdt.fs`, `src/Core/DeltaCrdt.fs`).

**Phase 2 — Replace the filesystem (ZetaFS).** Once ZetaDB is standalone, the next layer is the filesystem. The `DagFs.Tree<'V>` is already a content-addressed filesystem: paths are keys, content is stored by hash, merges are conflict-free. The missing pieces are the POSIX interface (read/write/stat/readdir syscalls mapped to DAG operations), the FUSE driver (for running on existing Linux kernels during the transition), and the block-device layer (for running on bare metal). The ZetaFS WebDAV host (`DagFs.paths` is already referenced in the docstring as "the directory-listing view — the forward map's keys, needed to enumerate the tree as a mountable filesystem") is the first step.

**Phase 3 — Replace the operating system (Zeta micro/unikernel).** Once ZetaFS is the filesystem, the final layer is the OS itself. The plan is a micro/unikernel: a minimal kernel that provides only the primitives ZetaDB and ZetaFS need — memory management (Shiva-GC is already the memory model), process isolation (the NCI boundary from the EVE protocol is already the isolation model), and network I/O (the Reticulum bus is already the network model). Everything else — scheduling, device drivers, file I/O — is implemented in the Zeta layer above the kernel, not in the kernel itself.

The three phases are not sequential gates — they can proceed in parallel. ZetaFS does not require ZetaDB to be complete; it only requires the DAG-FS layer, which is already shipped. The unikernel does not require ZetaFS to be complete; it only requires the Shiva-GC and NCI boundary, which are already shipped. The phases are ordered by dependency depth, not by calendar time.

### Why This Path Is Coherent

The replacement path is coherent because every layer of the Zeta stack is already designed around the same three primitives: **content addressing** (every value is stored by the hash of its content), **Z-set algebra** (every mutation is a signed-weight delta), and **DynamicValue** (every artifact is a value, not code, and therefore collectable and regenerable). A filesystem built on these three primitives is not a new design — it is the same design as ZetaDB, applied one layer lower. A kernel built on these three primitives is not a new design — it is the same design as ZetaFS, applied one layer lower.

The deepest connection: the `gen(gen)==gen` fixed point (Layer 7) is the property that makes the whole stack replaceable without downtime. Every layer can be replaced while running because every residual is reconstructible from the generator. Replace the database: the generator re-mints the data. Replace the filesystem: the generator re-mints the files. Replace the OS: the generator re-mints the kernel. The system is self-healing by construction.

### Current Status and Next Steps

| Phase                                   | Status                                                                     | Next step                                                                    |
| --------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| ZetaDB (replace CockroachDB)            | DAG-FS + Z-sets + schema evolution shipped; CockroachDB bridge in progress | Distributed consensus protocol (Raft over Z-set deltas)                      |
| ZetaFS (replace OS filesystem)          | `DagFs.Tree<'V>` shipped; WebDAV host referenced in docstring              | FUSE driver (POSIX interface over DAG operations)                            |
| Zeta micro/unikernel                    | Shiva-GC + NCI boundary shipped; unikernel not yet started                 | Memory model formalisation (Shiva-GC as the kernel allocator)                |
| MultilayerBnn (replace inference stack) | Primitives shipped; N-layer composition not yet shipped                    | `MultilayerBnn.fs` — stack N `MinimalBnn` cells with shared EP backward pass |
| ACE CLI (replace package managers)      | Package format spec shipped; CLI not yet started                           | `ace install / verify / list` TypeScript commands                            |

Max is aware of this path and is excited about it. The document you are reading is the technical foundation for all five workstreams.
