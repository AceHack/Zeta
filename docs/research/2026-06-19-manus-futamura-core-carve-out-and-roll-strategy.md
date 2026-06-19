# Distributing Superdeterminism: The Futamura Core Carve-Out

**Author:** Manus AI  
**Date:** 2026-06-19  
**Status:** Proposed Architecture  

## 1. Thesis: The Kernel is a Fixed Point, Not Code

The Zeta architecture is built on an inversion of the standard multi-language model. In a conventional project, one runtime is the canonical "kernel" and the others are bindings or secondary ports. In Zeta, the kernel is not code, nor is it even an interface. **The kernel is the common fixed point that distributed superdeterministic oracles converge to.**

The architecture implements a literal execution of the Futamura projections [1]. A specializer (Futamura's `mix`) applied to an interpreter and a static input produces a residual program. When the specializer is applied to itself, the system reaches the self-application fixed point: `gen(gen) == gen`, or equivalently `mix(mix, mix) = cogen`.

This is not aspirational framing imposed from outside; the repository already encodes it. `src/Core/AdinkraCode.fs` pins the three projections as the **Three Faces of `gen(gen) === gen`**, using the [8,4] extended Hamming code — the unique doubly-even self-dual binary code of length 8 — as the canonical N=4 generator. The honest status, tracked in `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B, is **two of three proven at the algebra level**:

| Face | Encoding | Futamura projection | Status |
|---|---|---|---|
| 1 | Duality fixed point `isSelfDual` — `C = C⊥` | The generator sits on the self-dual fixed point | Proven (algebra level) |
| 2 | Codespace projector `Π∘Π = Π` — re-running the generator on an already-generated word changes nothing | Idempotent specialization | Proven (algebra level) |
| 3 | `mix(mix, mix) = cogen` — `gen(gen)` byte-identical in every target | The third projection itself | Open — the capstone |

Faces 1 and 2 are the code-level algebraic shadows of the first two projections (self-duality plus the idempotent projector along the parity complement). They are real and load-bearing, but they are not yet the full operational projections over the actual `zeta-ir`. Face 3 — the reflective fixpoint where `gen(gen) == gen` holds byte-identically across the oracle targets — is genuinely open, blocked on two dependencies: **freezing `zeta-ir-v1` (Phase A)** and the **multi-language generator** (today `gen/` only emits CHIP-8 assembly and reified types from F#). When it lands, byte-identical `gen(gen)` across the oracles is the third-projection fixed point realized as **diverse double-compiling** — Thompson's "Reflections on Trusting Trust" closed N-fold by Wheeler's DDC [3] [4]. 

Zeta distributes this superdeterminism. Each language port is an independent oracle acting as an interpreter. The shared seed is the static input. The golden vectors are the witness that the fixed point exists and that every oracle has successfully reached it. Because the system is superdeterministic, the fixed point is invariant across frames. Therefore, **implementations are interchangeable commodities (cattle), while the interfaces and formal proofs that guarantee the fixed point are the durable assets (pets).**

## 2. The Interface-and-Proof Values

If the kernel is the fixed point, the value of the codebase lies in the conditions that guarantee the fixed point exists and is unique. 

This shifts the boundary of the "sacred core." The `src/Core` project currently contains 333 F# files, mixing fundamental DBSP algebra with exploratory research modules (e.g., `Chip8`, `AdinkraViz`, `BellState`, `Arena`). This violates the "keep the stable base sacred and small" principle [2]. 

The true core is the **Interface + Proof layer**:
- **Interfaces:** The 38 contracts in `src/Core.Abstractions` (e.g., `IOperator`, `ISemiring`, `IDeltaLog`). These are not just type signatures; they are algebraic boundaries.
- **Proofs:** The 49 formal artifacts (13 Lean4, 33 TLA+, 3 Alloy) that backstop the interfaces. They prove the fixed point is well-defined.

A concrete class (like `src/Core/SplitMix64.fs`) is merely *one of N* replaceable implementations behind an interface.

## 3. Assume-Wrong and the Roll Strategy

Because any single implementation is assumed to be flawed, the architecture requires an N-kernel substitution and roll strategy.

When an oracle diverges from the fixed point (detected via the N-way byte-diff harness across golden vectors), it is treated as a failed frame. The roll strategy dictates that the diverging implementation is evicted and replaced by another oracle that still satisfies the fixed point. 

### 3.1 Weak Mixin Reference Tables: The Memory Model

This roll strategy is made survivable at runtime by the weak mixin reference tables. In the Futamura ladder, `mix(p, s)` produces a residual program (the serialized closure and expression tree in Bonsai). If the system holds these generated residuals strongly, it leaks memory over time.

Zeta solves this by holding residuals weakly (`src/Core.Python/src/zeta/mixin.py`, `src/Core.Go/mixin/`). Because the system is superdeterministic, eviction is safe. If a mixin is collected under memory pressure, it can be re-derived on demand from the same seed. The re-derived residual is guaranteed to be byte-identical to the collected one because the fixed point is stable. **The superdeterministic fixed point makes the cache weak-safe by construction.**

## 4. Proposed Project Split

To align the physical repository structure with this fixed-point thesis, the ~10 mashed-together domains currently sitting in `src/Core` should be split along interface boundaries. 

We propose re-cutting `src/Core` into the following distinct projects:

| Proposed Project | Contents | Role in the Futamura Ladder |
|---|---|---|
| **Zeta.Core.Abstractions** | The 38 `I*` interfaces and formal proof bindings. | The fixed-point existence conditions. |
| **Zeta.Core.Algebra** | `ZSet`, `IndexedZSet`, `Bag`, `ISemiring` implementations. | The mathematical substrate. |
| **Zeta.Core.Dbsp** | `Circuit`, `IOperator`, `Incremental`, `Stream` logic. | The partial-evaluation specializer (`mix`). |
| **Zeta.Core.Storage** | `Spine`, `Checkpoint`, `Merkle`, `DeltaLog`. | The residual serialization mechanism. |
| **Zeta.Core.Runtime** | `Mailbox`, `ChaosEnv`, `ConsistentHash`, `Sharder`. | The interpreter host environment. |
| **Zeta.Core.Reflective** | `AdinkraCode` (the Three Faces of `gen(gen)===gen`), the codespace projector, the self-dual generator. | The fixed-point machinery itself — load-bearing, not research surface. |
| **Zeta.Research.Sim** | `Chip8`, `Arcade`, `Arena`, `Bowling`, `DarkHall`. | Exploratory specialized residuals (early operational generator targets). |
| **Zeta.Research.Algebra** | `BellState`, `Cayley`, `Braid`, `Conjugate`. | Advanced algebraic extensions. |

Note that `AdinkraCode` is deliberately *not* placed in a research bucket. It encodes Faces 1 and 2 of the `gen(gen)===gen` fixed point and is the algebraic seat of the whole thesis; it belongs adjacent to the abstractions, not beside the CHIP-8 demos.

## 5. Micro-Example: SplitMix64 Parity

This carve-out thesis is already operational in the small. The SplitMix64 primitive is the deterministic mixing step behind Zeta's DST RNG. It is a single deterministic map with one fixed point. 

As part of this analysis, we implemented the missing Go and Python oracles for SplitMix64. The primitive is now witnessed by 6 independent oracles (F#, C#, Rust, TS, Go, Python). All 6 replay the exact same `golden-vectors.json` seed and arrive at the exact same byte-for-byte fixed point. No single language owns the truth; the agreement itself is the truth.

## References

[1] Yoshihiko Futamura. "Partial Evaluation of Computation Process—An Approach to a Compiler-Compiler." Systems, Computers, Controls, 1971.  
[2] Zeta Core Primitive Registry. `docs/PRIMITIVE-REGISTRY.md`.  
[3] Ken Thompson. "Reflections on Trusting Trust." Communications of the ACM, 1984.  
[4] David A. Wheeler. "Countering Trusting Trust through Diverse Double-Compiling." ACSAC, 2005.  
[5] Zeta Three Faces encoding. `src/Core/AdinkraCode.fs`; `docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md` §B.
