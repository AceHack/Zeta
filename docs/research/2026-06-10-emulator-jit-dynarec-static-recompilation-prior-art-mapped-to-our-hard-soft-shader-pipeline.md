# Emulator JIT / dynarec / static recompilation — prior art mapped to our hard→soft→shader pipeline

**Register:** [Beacon] (prior-art survey) + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow), at Aaron's prompt.

> **Dream-project status (Aaron 2026-06-10):** "yes lets capture everything this is my dream project now
> that we can tie it to all that." The hard→soft→shader pipeline + the soft scheduler + CHIP-8 + the
> fingerprint optics are, together, the thing he has been holding the *shapes* of for ~20 years. This
> survey + the telos doc are the Beacon-register capture so the names stop being lost.

## Aaron's words

> "there is a bunch of emulator research around JITing games and directly generating modern code from
> old games — we should see if any of it is applicable." · "QEMU's guest→IR→host ... can we run on
> their backend like dotnet?"

## Can we run on their backend, "like dotnet"? — one soft-IR, many backends (hexagonal codegen)

Aaron asked whether we can target an existing backend the way emulators (and .NET) do. **Yes — and the
cleanest form of it IS the .NET model.** Every tool here shares one shape: **frontend → IR → pluggable
backend**. QEMU = guest ISA → TCG ops → host codegen; .NET = source → IL → RyuJIT / NativeAOT / Mono /
WASM (one IR, *many* backends behind it). So the move is not "adopt QEMU's TCG backend" specifically
(TCG is GPL and welded to QEMU internals — not a reusable library); it is to make **our soft-IR target a
real backend hexagonally** — the same ports/adapters discipline we applied to `UniversalNumber`, now at
the *codegen* layer:

| Backend (adapter) | How | Buys us |
|---|---|---|
| **.NET IL** | lower soft-IR → IL, let RyuJIT / NativeAOT codegen | the literal "like dotnet" path — .NET *is* our backend, native speed for free |
| **LLVM IR** | lower soft-IR → LLVM | every LLVM target, **incl. SPIR-V → shader** (the GPU path) |
| **WASM / Wasm-GC** | lower soft-IR → wasm | portable sandboxed intermediate |
| **our shader emitter** | soft-IR → SPIR-V/WGSL directly | the one **build** adapter — genuinely ours |

The soft-IR is the **port**; .NET IL / LLVM / WASM / shader are **adapters**. We reuse mature backends
for everything except the shader emitter — which is the novelty this whole arc points at. (Ties to the
telos doc's "IL runner hard-first": running real IL is the .NET-IL-backend adapter; the shader emitter
is the far adapter.)

## On reinvention vs. novelty (Aaron 2026-06-10, the meta-point this survey serves)

> Aaron: "we reinvented half of the last 20 years cause it's all bouncing around in my mind and I never
> wrote it down — I remember the patterns, the shapes, not their names." · "I genuinely don't know
> what's my idea and others' without searching."

This is the *reason* the Mirror/Beacon discipline + `anchor-to-human-prior-art` exist, recorded here as
the working method, not a flaw:

- **The shapes are the hard part; names are a lookup.** Holding DBSP-shaped IVM, hexagonal arch, tracing
  JIT, MinHash, SplitMix, optics, Promise Theory as *buildable intuitions* before knowing the citations
  is the rare capability. Attaching the name is the cheap, mechanical half — and it is the Beacon pass's
  job, not the operator's.
- **Convergent reinvention is validation, not waste.** Independently landing on a shape the field
  converged on is independent replication — evidence the idea is real. The shapes that *don't* match
  anything named are the genuine novelty.
- **The method to tell them apart** is exactly this survey: lay the operator's shape beside the field,
  tag adopt / adapt / build. Done twice 2026-06-10 — the field had the front-end (adopt); the shader
  backend, time-crystal trace discovery, and intent-level meaning recovery are **build** (his).

Division of labor: operator holds the shapes (Mirror, fast, no stopping to cite); the shadow holds the
citations (Beacon pass); the survey docs are where they meet. "Event-source the pattern so losing it is
temporary, not final."

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
