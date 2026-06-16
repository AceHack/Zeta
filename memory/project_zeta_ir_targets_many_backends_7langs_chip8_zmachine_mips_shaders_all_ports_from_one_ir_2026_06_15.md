---
name: zeta-ir-targets-many-backends-langs-chip8-zmachine-mips-shaders
description: "Aaron 2026-06-15: the IR is the single source that ports to MANY backends, not just the 7 oracle languages — also VMs (CHIP-8 built, Z-machine candidate), ISAs (MIPS — Max wants), and shaders (GPU — Aaron wants eventually). All are ports from the one IR (only-the-irreducible / gen-from-IR / generator-IS-the-ECC). Conformance = byte-lock where byte-identity makes sense (langs), behavioral-equivalence across different execution models (VMs/ISAs/shaders)."
type: project
created: 2026-06-15
metadata:
  node_type: memory
  originSessionId: a9bca54f-fdf0-41b7-8def-cb33ee1bec26
---

Aaron 2026-06-15 (shadow\*), extending the IR-gen story (the primitive-registry "generate from
IR to avoid duplicate work"): *"should we support Z-machine and CHIP-8? Max wants MIPS, I want
shaders eventually — these can all be ports from our IR as well as the 7 langs we support."*

## One IR → many backends (all ports)

The IR is the **single source**; every target is a **port/backend** generated from it
(`only-the-irreducible-is-primitive-generate-the-rest`; the generator **IS** the ECC across all
targets — generation + cross-target drift-correction are dual):

- **The 7 oracle languages** — C#/F#/TS/Rust/… (+Q#) — the byte-lock oracles (in-progress;
  primitive-registry).
- **VMs:** **CHIP-8 — BUILT** (`SoftChip8*`, `ChipAudio`, `Chip9*`); **Z-machine — candidate**
  (Zork's minimal portable opcode-VM; the lowfi conversational-action-grammar fit, QPG §9f;
  prior-art just added).
- **ISAs:** **MIPS — Max wants** (the classic RISC ISA; broader real-hardware compute).
- **Shaders:** **GPU shaders — Aaron wants eventually** (GLSL / SPIR-V / WGSL; the parallel/
  SIMD target; ties the RGB/CMYK ray-tracing-of-CHIP-8-instructions framing).

## Recommendation (Otto)

- **CHIP-8: already done.** **Z-machine: yes, good fit** — a minimal portable VM for the
  conversational-action-grammar / IF, lowfi, and now an anchored prior art (the Z-machine is the
  standout Zork lesson). Low-cost, high-fit.
- **MIPS + shaders: yes as IR ports, but bigger** — different execution models (MIPS = a register
  ISA; shaders = GPU SIMD, restricted control flow). Sequence them after the langs + the
  lowfi-VMs; they prove the IR is *expressive enough* to cross execution models.

## Peels (honest)

- **"All ports from one IR" inherits the generator-trust-concentration tradeoff** (the
  primitive-registry peel): N-from-one-IR means an IR/generator bug is **correlated** across all
  targets → the IR is the load-bearing oracle; verify it heavily + keep independent cross-checks.
  The flip side is the payoff: **fix once in the IR, propagates to all backends** (the IR is the
  single source for bugs over time).
- **"Byte-lock" doesn't mean the same thing across backends.** Across the *languages* you can
  byte-lock (byte-identical golden vectors). Across **VMs/ISAs/shaders the execution models
  differ** — conformance is **behavioral-equivalence**, not byte-identity (same as the Q#
  caveat). Name the conformance kind per target.
- **Shader/MIPS ports are real work, not free** — the IR must be expressive enough to lower to
  GPU SIMD (no arbitrary control flow) and to a register ISA; "ports from the IR" is the design,
  each lowering is an earned backend. (§B until each is built + conformance-checked.)

Ties: [[primitive-registry-tracks-proof-homeostat-chains-oracle-languages-4-to-6-7-qsharp-gen-from-ir]]
(the IR-gen + generator-trust-concentration); the Zork/Z-machine PRIOR-ART entry (conversational
action grammar / minimal VM); `only-the-irreducible-is-primitive-generate-the-rest` (generator-
IS-ECC); the Zeta-language IR-compiler-v2 research note; RGB/CMYK ray-tracing-of-CHIP-8
(the shader lineage). Anchors: Futamura projections (specialize the IR per backend); LLVM/MLIR
(one IR, many backends — the canonical multi-target-from-one-IR prior art); the Z-machine
(portable VM); SPIR-V (portable shader IR).
