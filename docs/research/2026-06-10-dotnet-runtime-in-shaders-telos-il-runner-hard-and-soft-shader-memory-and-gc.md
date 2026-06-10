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
   and is `cut`). Open research — the next small moves.

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
