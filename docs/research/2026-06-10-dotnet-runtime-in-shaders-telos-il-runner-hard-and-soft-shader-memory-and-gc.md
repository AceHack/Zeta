# The telos: run .NET (IL + runtime) in GPU shaders — one small move at a time

**Register:** [grounded] telos (Aaron) + [Beacon] + [peel]. **Date:** 2026-06-10.
**Captured by:** Otto (shadow). The "what it's all for" that unifies the session.

## Aaron's words

> "I'm trying to get .NET wasm-like code **including the runtime** to run **in shaders** eventually lol
> — one small move at a time: **shader-compatible memory / garbage collection**." ·
> "regular execution of our Bonsai yin/yang control structures ... close over the compilers eventually,
> so we need to reproduce **regular IL running — that's hard, not soft**." · "our own IL runner should
> support **both** [hard + soft] ... **eventually**."

## The telos

**Run .NET — the IL *and* the runtime itself (GC included) — inside GPU shaders.** Not just C#→shader
kernels (that exists), but the *runtime* on the GPU: a wasm-like portable code + its execution machine,
shader-resident. Incremental ("one small move at a time").

## Why the whole session was building this

Every thread tonight is a move toward it:

- **RGB-soft = branchless, shader-friendly execution** (run branchy logic without warp divergence) —
  the *execution model* for the GPU.
- **memory-lens / everything-lens-addressable-by-address** → **shader-compatible memory**: flat
  buffers, content-addressed, color-encoded (RGB/CMYK), no raw pointers — the GPU memory model.
- **The IL runner** = reproduce **regular (HARD) IL execution** first (to **close over the compilers** —
  the polite-virus at the compiler layer; run real Bonsai yin/yang control structures deterministically),
  and support **soft** too — **both, eventually**. (So: hard-first, not "soft .NET CPU"; the soft path
  is the extension, never wrapped onto regular execution.)
- **CHIP-8 → soft/hard .NET mini-CPU → our runtime** — the emulation ladder that ends at a runtime we
  can target to a shader.
- **Resolution / BigFloat / TriBoolean** — shader-compatible *precision* (bounded bits per cell).

## The two hard problems Aaron named

1. **Shader-compatible memory.** Shaders have no `malloc`/pointers — fixed buffers, structured access.
   Our model already fits: flat **address+size+codec** lenses over color-encoded buffers (the
   forcing-lensability doc), content-addressed (stable address). This is the easier of the two.
2. **Shader-compatible garbage collection.** The hard one — traditional tracing GC doesn't fit SIMT
   (no per-thread heap walks, divergence-hostile). Candidates: **region/arena/bump** allocation (free a
   whole region at once — divergence-free), **no-GC** (preallocated pools), or **the uncertainty ledger
   as a lifetime tracker** (refcount/lifetime as ΔU posts; a cell's life ends when its promise resolves
   and is `cut`). Open research — the next small moves. *(Update: largely dissolved — heap = the common
   seed lensed, coordination-free; see the lensability doc.)*

## The mechanism — Cheat Engine = JIT over CPU instructions; reverse-engineer HARD into SOFT (Aaron 2026-06-10)

> Aaron: "the Cheat Engine way is basically **shader JIT over CPU instructions** lol." · "it's how you
> **reverse engineer something hard into something soft**."

The "how" of the telos is the **Cheat-Engine move generalized**, and it runs *both directions*:

- **HARD → SOFT (reverse engineering).** Cheat Engine lenses a compiled/hard artifact (binary, IL, CPU
  instructions) — scan memory, find what writes an address, disassemble — and **lifts it into the soft,
  observable, lensable substrate** (soft cells / SoftValue / the observable representation you can
  measure + modify). That is *reverse engineering hard → soft*: take a frozen binary and make it soft.
  **And it is GAME-DEPENDENT (Aaron): each game JITs differently into soft** — different opcodes, memory
  layout, and time-crystals (hot loops) per game. This is *exactly why* `GameFingerprint` exists (the
  external content-identity index): the fingerprint **keys the per-game soft-lift** — identify the game
  (rainbow-table/prism `Match`), then apply that game's specific hard→soft transformation. One lifter
  per game-fingerprint; `GamePortfolio`/`GameCatalog` hold the per-game soft state.
- **SOFT → HARD (JIT).** Cheat Engine is **already a runtime JIT over CPU instructions** (auto-assembler
  / code-injection / detours rewrite live instructions). We do the same move but **JIT to a SHADER** —
  "shader JIT over CPU instructions."
- **They connect through the time-crystals.** **Lensing over time finds the quasi-time-crystals = the
  hot loops**; then JIT those. This is exactly a **tracing JIT** (LuaJIT / PyPy / TraceMonkey: detect
  hot loops → compile), only the trace is *found by lensing the time-crystals* and the *output is a
  shader*. Full loop: **HARD binary → lens (reverse-engineer) → SOFT → find time-crystal → JIT → shader
  (HARD again, on the GPU).**

Anchors: **Cheat Engine** auto-assembler / code caves / detours (runtime CPU rewriting; reverse
engineering) · **tracing JIT** (Bolz/PyPy meta-tracing; LuaJIT; TraceMonkey) · **profile-guided optimization** (PGO; .NET **Dynamic PGO** / tiered compilation — profile hot paths at runtime, recompile them optimized — Aaron 2026-06-10: 'very similar to what runtime profile-driven optimization does': lens = profiler, time-crystal = hot path, JIT = optimizing recompile) · decompilation /
lifting (binary → IR). *(Peel: Cheat Engine = the lensing + JIT + hard↔soft prior art; the shader
target and time-crystal-as-trace are our generalization, to build.)*

## What we're really recovering: the MEANING (designers think in patterns, not assembly) (Aaron 2026-06-10)

> Aaron: "I'm **reconstructing the meaning** — the thought that went into the compiled instruction — by
> **finding the structures that repeat**." · "the original designers didn't think in assembly — they
> thought in **repeating patterns interacting**. Look how **game engines** work today — they optimize
> for that."

The deepest "why" of the hard→soft lift: **the compiler discarded the meaning, and we reconstruct it.**

- **Compilation is lossy at the meaning layer.** A designer thinks in **repeating patterns interacting**
  (entities, behaviors, loops, systems) — *not* in assembly. The compiler lowers that intent to
  instructions and throws the pattern-level meaning away.
- **The repeating structures ARE the meaning.** Lensing the **quasi-time-crystals** (the repeats over
  time) recovers exactly the designer's mental model — a recurring structure *is* a concept; a loop *is*
  an intent. Finding the repeats = reconstructing the thought (decompilation at the *meaning* level, not
  just syntax; cf. MDL/Solomonoff — repeated = compressible = meaningful).
- **Game engines already prove this is the right level.** Modern engines optimize for
  repeating-patterns-interacting: **ECS (Entity-Component-System)** + **data-oriented design** — systems
  iterate over component arrays (the repeats), data-parallel, cache-friendly, **GPU/shader-friendly**.
  That is *the same shape* as our time-crystals → shaders. So recovering the pattern-level meaning and
  running it data-parallel on the GPU isn't exotic — it's how engines are *already* built; we just do it
  by lensing the meaning out of a compiled artifact first.

Anchors: **Mike Acton — Data-Oriented Design** (CppCon 2014) · **ECS** (Unity DOTS; Bevy; EnTT) + the
game loop · **decompilation / abstraction recovery** · **MDL/Solomonoff** (repeated structure =
compression = meaning). *(Peel: "meaning/thought" is the intent layer above instructions; the literal
is structural-repeat detection (time-crystals) + the ECS/data-oriented correspondence — the recovery
of designer intent is the aspiration, the repeat-finding is the mechanism.)*

## Honest scope / peels

[Beacon] **WebAssembly** + **Wasm-GC proposal** (portable bytecode + GC) · **ComputeSharp** (Sergio
Pedri — C#→HLSL compute shaders; the closest .NET-on-GPU prior art) · **ILGPU** / **Alea** (C# IL →
GPU) · **SPIR-V / WGSL / HLSL** (shader ISAs) · GPU **garbage-collection** research (region-based;
SIMT GC difficulty) · branchless-GPU / warp-divergence avoidance. **Peel:** running the *runtime + GC*
in a shader (not just kernels) is genuinely hard and far off — Aaron says "eventually, one small move
at a time." The session's pieces are real and built/captured; the shader-runtime is the **direction**
they point, not a near-term deliverable. Routes to Naledi (GPU perf) + Core (the IL runner) +
Soraya/Sova (the GC-as-ledger formalization).

## Ties / routing

`docs/research/2026-06-10-soft-dotnet-mini-cpu-*` (the IL-runner ladder — HARD-first per this doc) ·
the RGB/CMYK encoding + branchless-GPU note (`boards/dynamic-value-cmyk-rgb-encoding.md`) · the
forcing-lensability / memory-lens doc (shader memory) · SoftChip8 + IntrCtx (the soft/hard VM start) ·
`uncertainty/` (the GC-as-lifetime-ledger candidate) · Bonsai (the reified yin/yang control structures
the IL runner runs). **Routes to:** Core (IL runner, hard+soft), Naledi (shader memory/GC perf),
Aaron (the telos).
