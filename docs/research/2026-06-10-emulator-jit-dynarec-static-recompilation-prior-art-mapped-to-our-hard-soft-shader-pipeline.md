# Emulator JIT / dynarec / static recompilation — prior art mapped to our hard→soft→shader pipeline

**Register:** [Beacon] (prior-art survey) + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow), at Aaron's prompt.

## Aaron's words

> "there is a bunch of emulator research around JITing games and directly generating modern code from
> old games — we should see if any of it is applicable."

## Why this matters

The session's telos (`...dotnet-runtime-in-shaders-telos-...md`) frames the mechanism as the
**Cheat-Engine move generalized**: lens a hard artifact → soft → find the time-crystal (hot loop) →
JIT → shader. That is *exactly* the problem emulator authors have solved for decades — minus the shader
target. So most of the **front-end is free prior art**; our genuine novelty is narrow and identifiable.
Per `anchor-to-human-prior-art`: name the field, adopt what exists, mark what's actually ours.

## The landscape, mapped to our pipeline

Our pipeline: **HARD binary → lens (reverse-engineer) → SOFT/IR → find time-crystal → JIT → SHADER**.
Each row below is tagged **adopt** (reuse the field), **adapt** (reshape to our framing), or **build**
(genuinely ours).

| Field / artifact | What it does | Our stage | Verdict |
|---|---|---|---|
| **QEMU TCG** (Tiny Code Generator) | guest ISA → small IR → host code, at runtime | lens → SOFT/IR → JIT | **adopt** — TCG's guest→IR→host *is* our hard→soft(IR)→hard, different backend |
| **Dolphin / PCSX2 / RPCS3 dynarec** | runtime JIT of guest CPU blocks to host x86/ARM | JIT (block-level) | **adopt** the block-JIT discipline (register allocation, block linking, invalidation) |
| **Bochs → QEMU lineage** | interpreter → dynamic recompilation evolution | the whole soft→hard ladder | **adopt** as the canonical maturation path (interpret first, JIT the hot parts) |
| **N64Recomp / "Zelda 64: Recompiled"** | STATIC-recompiles an N64 binary → portable **C** → recompile native | lens → SOFT (readable code) | **adopt** — proves "generate modern code from old games" is real and shippable |
| **RetDec · Ghidra decompiler · IDA Hex-Rays** | binary → C-like IR (decompilation / abstraction recovery) | lens (meaning recovery) | **adopt** for the lifting front-end; meaning-recovery is decompilation at the *syntax* level |
| **Trace JIT** — LuaJIT, PyPy meta-tracing, TraceMonkey | detect hot loops at runtime, compile the trace | find time-crystal → JIT | **adapt** — our trace is *found by lensing time-crystals over time*, not by a counter |
| **.NET Dynamic PGO / tiered compilation** | profile hot paths, recompile optimized | find time-crystal → JIT | **adapt** — Aaron 2026-06-10: "very similar to runtime profile-driven optimization"; lens=profiler |
| **LLVM-based lifters** (McSema, RetDec→LLVM, remill) | binary → LLVM IR → re-optimize / re-target | SOFT/IR → re-target | **adapt** — LLVM IR is a candidate soft-IR; our backend is a shader, not native |
| **ComputeSharp · ILGPU · Alea** | C#/IL → HLSL/PTX compute shaders | JIT → SHADER (backend) | **adapt** — closest .NET-on-GPU; they compile *kernels*, not a recompiled-guest trace |
| **GPU SIMT execution of irregular code** | warp-divergence avoidance, branchless reformulation | JIT → SHADER | **build** — running *recompiled game traces* on SIMT is unsolved here |
| **Time-crystal / quasi-crystal trace detection** | lens memory+code over time → repeating structures = meaning | find time-crystal | **build** — our framing (Wilczek×Shechtman); the meaning-recovery layer *above* decompilation |

## What is genuinely OURS (the peel — the narrow novelty)

The field hands us the front-end almost entirely. Three things remain **build**, and they are where Zeta
research actually lives:

1. **The shader/SIMT backend.** Every dynarec above targets x86/ARM/native or (for the GPU tools)
   hand-written kernels. Recompiling an emulated guest's *hot trace to a shader* is, as far as this
   survey found, not done. This is the hard, novel target.
2. **Trace discovery by lensing time-crystals.** Trace JITs and PGO find hot paths with *counters*. We
   find them by **lensing memory+code regions over time and detecting the repeating structures**
   (quasi-time-crystals). Same goal (find the hot loop), different and more general mechanism — and it
   recovers structure a counter never sees.
3. **Meaning recovery above syntax.** Decompilers (RetDec/Ghidra) recover *syntax* (a C-like AST).
   Aaron's claim is recovering the **designer's intent** — "repeating patterns interacting" (ECS /
   data-oriented design), the level *above* instructions. The repeat-detection is the mechanism;
   intent-recovery is the aspiration. (cf. MDL/Solomonoff: repeated = compressible = meaningful.)

## Concrete adoptions to consider (next moves, not commitments)

- **Lift via an existing IR** rather than inventing one: QEMU TCG ops or LLVM IR as the SOFT layer, so
  the soft cells / SoftValue lensing sits on a proven lifting front-end.
- **Interpret-then-JIT maturation** (Bochs→QEMU lesson): SoftChip8 already interprets; the soft
  `IScheduler` (#7529) is the loop; the JIT-the-hot-trace step is the *next* rung, not a rewrite.
- **N64Recomp as the existence proof** for static "old game → modern portable code"; study its
  symbol/relocation handling for our per-game GameFingerprint-keyed lift.

## Honest scope / peels

[Beacon] QEMU TCG · Dolphin/PCSX2/RPCS3 dynarec · N64Recomp (Wiseguy) · RetDec/Ghidra/Hex-Rays ·
LuaJIT (Mike Pall) / PyPy meta-tracing (Bolz et al.) / TraceMonkey · .NET Dynamic PGO · McSema/remill ·
ComputeSharp (Sergio Pedri) / ILGPU. **Peel:** the field is the front-end (lift, IR, hotspot, native
JIT) — mature and reusable. The shader backend, time-crystal trace discovery, and intent-level meaning
recovery are the **build** items — our actual research surface, not yet demonstrated. This doc is a
survey to *prevent reinventing the front-end*, not a claim we have the backend.

## Ties / routing

`...dotnet-runtime-in-shaders-telos-...md` (the telos this serves) · `...forcing-lensability-chip8-...md`
(lensing → time-crystals) · `src/Core/SoftScheduler.fs` (#7529, the loop) · `src/Core/SoftChip8.fs`
(the interpreter to JIT from) · `src/Core/FingerprintPrism.fs` (#7527, per-game keying). **Routes to:**
Core (IR/lift choice + the JIT rung), Naledi (shader/SIMT backend perf), Aaron (the telos + the novelty
calls).
