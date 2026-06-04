---
name: hardware-intrinsics-expert
description: .NET hardware intrinsics — Vector128/256/512, SSE/AVX/AdvSimd, IsSupported, cache alignment, branchless SIMD.
---

# Hardware Intrinsics Expert — SIMD + CPU-Level Performance

Capability skill. No persona. The low-level performance hat
covering everything the .NET runtime exposes below
`Parallel.*`: hardware intrinsics, vector APIs, cache-line
geometry, branch-free patterns, data-layout discipline.

Paired with:

- **`performance-engineer` (Naledi)** — owns the
  benchmark-driven perf story end-to-end. This hat is a
  narrow tool-expert underneath her.
- **`query-planner` (Imani)** — owns *when* a SIMD kernel
  fires (plan dispatch); this hat owns *how* the kernel is
  written and *whether* the intrinsic actually pays off.

## When to wear

- Writing or reviewing `src/Core/Simd.fs` or
  `src/Core/SimdMerge.fs` (SIMD-accelerated ZSet merge /
  scan / filter / sum).
- Writing or reviewing `src/Core/HardwareCrc.fs` (CRC-32
  via `Sse42.Crc32` / `Crc32.ComputeCrc32` on ARM).
- A proposed kernel names a specific intrinsic family —
  does the path compile on all three target ISAs (x64
  AVX2, x64 AVX-512, ARM64 AdvSimd), with a scalar fallback
  on each?
- Reviewing a cache-line-alignment claim (false sharing,
  padding struct, `[StructLayout(LayoutKind.Explicit)]`).
- A hot loop has a data-dependent branch — can it be
  branch-free?
- `Vector<T>` vs `Vector128/256/512<T>` choice — when is the
  cross-platform API enough, and when is the width-specific
  API necessary?
- `TensorPrimitives` (the .NET 9+ cross-platform vectorised
  numerics API) — is it ready for the kernel, or is a
  hand-rolled intrinsic still faster?

## When to defer

- **Whether a SIMD kernel should fire at plan time** →
  `query-planner` (Imani).
- **End-to-end benchmark result, regression policy, perf
  gate decisions** → `performance-engineer` (Naledi).
- **Numerical correctness of the intrinsic result (IEEE
  754, saturating arithmetic)** →
  `numerical-analysis-and-floating-point-expert`.
- **F#-side idioms for the kernel's calling convention** →
  `fsharp-expert` / `csharp-fsharp-fit-reviewer`.
- **C# / P/Invoke / `[SuppressGCTransition]` wrapper
  correctness** → `csharp-expert`.
- **Determinism under DST (fixed-seed replay of SIMD
  paths)** → `deterministic-simulation-theory-expert`.
- **ARM64-specific kernels on Apple Silicon** — still this
  hat, but benchmark regression comparison is
  `performance-engineer`'s.

## The three-way ISA split Zeta supports

Every SIMD kernel compiles on three paths:

1. **ARM64 (Apple Silicon, AWS Graviton).**
   `System.Runtime.Intrinsics.Arm.AdvSimd` — 128-bit
   fixed-width, the only vector width.
   `Crc32.ComputeCrc32` for CRC.
2. **x86-v3 (Intel Haswell+, AMD Zen+).** AVX2, 256-bit
   vectors. `Avx2`, `Sse42`, `Popcnt`, `Bmi1` / `Bmi2`.
3. **x86-v4 (Intel Sapphire Rapids, AMD Zen 4+).** AVX-512,
   512-bit vectors. `Avx512F` / `Avx512BW` / `Avx512CD` /
   `Avx512DQ` / `Avx512VL`. Opt-in at runtime because AVX-
   512 downclocks on older silicon.

A kernel that compiles only on one path is a bug; the
review checklist below enforces coverage.

## Runtime feature gating — the canonical pattern

```fsharp
let merge (a: Span<int64>) (b: Span<int64>) (dst: Span<int64>) =
    if Avx512F.IsSupported && a.Length >= 8 then
        mergeAvx512 a b dst
    elif Avx2.IsSupported && a.Length >= 4 then
        mergeAvx2 a b dst
    elif AdvSimd.IsSupported && a.Length >= 2 then
        mergeAdvSimd a b dst
    else
        mergeScalar a b dst
```

`IsSupported` is a JIT constant on the CoreCLR runtime;
the branch is eliminated at JIT time, so the runtime
dispatch is free. Key discipline:

- **Widest-first, scalar-last.** Always try the widest
  available path first, fall through to narrower, land on
  scalar.
- **Threshold per path.** A 4-element vector op needs ≥ 4
  elements to amortise the load / store; below the
  threshold, the scalar path wins.
- **No `throw` in the fallback chain.** Every ISA reaches a
  scalar path; a thrown "not supported" is a kernel bug.

## `Vector<T>` vs `Vector128/256/512<T>` — when to reach for which

- **`System.Numerics.Vector<T>`** — runtime-chosen width.
  The right default when the kernel is structurally a SIMD
  op with no ISA-specific tricks. Width varies: 16 / 32 /
  64 bytes. Loops must not assume a specific width.
- **`Vector128/256/512<T>`** — fixed width. Reach for these
  when the kernel uses a specific intrinsic
  (e.g. `Avx2.ShuffleHigh` or `AdvSimd.VectorTableLookup`).
  The fixed-width path is authored once per ISA.
- **`TensorPrimitives` (.NET 9+)** — cross-platform
  numerical primitives (sum, dot, saturate-add, log, exp,
  sigmoid). The right choice for straight numerical loops
  when it covers the op.

Benchmark-before-claim: `Vector<T>` is *usually* as fast as
hand-rolled intrinsics for simple loops on recent runtimes;
the cases where hand-rolled wins are specific (shuffle-heavy
reductions, CRC, popcount, permute).

## Cache-line alignment + false sharing

- **Cache-line size on every modern mainstream CPU is 64
  bytes**, with Apple Silicon M-series at 128 bytes on
  some P-core configurations (empirical, not guaranteed —
  treat 128 as the safe upper bound for padding purposes).
- **False sharing.** Two independent writers touching
  variables on the *same* cache line serialise through the
  coherence protocol. Diagnose via perf counters
  (`MACHINE_CLEARS.MEMORY_ORDERING` on Intel); fix with
  `[StructLayout(LayoutKind.Explicit)]` + `FieldOffset`
  padding.
- **True sharing** (multiple readers, one writer) is fine
  and is the intended pattern for immutable hot state.
- **Alignment for AVX-512.** 64-byte alignment matters for
  AVX-512 load / store throughput on some microarchitect-
  ures; `System.Runtime.CompilerServices.Unsafe.Align` +
  `Marshal.AllocHGlobal` with padding are the levers.

## Branch-free idioms — when they pay

SIMD loves branch-free; branch prediction breaks down on
per-lane control flow. The rewrite toolbox:

- **Conditional move / select.** `Vector256.ConditionalSelect`
  replaces a scalar `if / else`.
- **Bitmask arithmetic.** `(x == y) ? 1 : 0` becomes
  `(-(x == y))` on signed two's-complement.
- **Clamp / saturate.** `Math.Max` / `Math.Min` chain is
  branch-free on modern JITs; the explicit intrinsic
  (`Sse2.Min`, `AdvSimd.Min`) is faster still.
- **Predicated store.** AVX-512's mask registers let a
  kernel apply a SIMD op conditionally without branching.

Branch-free is *not* always faster; a branch with > 99%
prediction accuracy is essentially free. Benchmark before
rewriting.

## Data layout — SoA vs AoS

A kernel that loads 8 `int64` values from 8 unrelated
objects pays 8 cache-miss costs; the same kernel over a
struct-of-arrays layout pays 1. Zeta's spine segment layout
is SoA for this reason.

The review discipline:

- **Kernel input.** Named as a `Span<T>` / `ReadOnlySpan<T>`
  over a contiguous array.
- **Struct fields.** Grouped by access pattern (hot fields
  together, cold fields together) not by lexical order.
- **Polymorphic types.** Boxed heap-allocated polymorphism
  is poison for SIMD. Use struct generics + `in` parameters
  - structural constraints.

## Runtime-fallback review checklist

Before approving a SIMD kernel PR:

- [ ] Compiles on ARM64, AVX2, AVX-512, and scalar paths.
- [ ] `IsSupported` gated; no `throw` on unsupported paths.
- [ ] Per-path threshold honours vector width.
- [ ] Benchmark suite (`bench/**`) shows the kernel wins on
      every path at the expected threshold.
- [ ] Numerical-correctness property (FsCheck) asserts
      equivalence with scalar path across all ISAs.
- [ ] Cache-line padding / alignment applied where the
      struct is hot-path.
- [ ] No heap allocation on the hot path (BP-06 / Naledi's
      zero-alloc discipline).
- [ ] DST harness runs the kernel under a fixed seed;
      replay is bit-for-bit deterministic
      (`deterministic-simulation-theory-expert` signs off).

## Zeta's intrinsic surface today

- **`src/Core/Simd.fs`** — vector load / store / merge
  primitives.
- **`src/Core/SimdMerge.fs`** — ZSet-merge kernel with
  three-way ISA dispatch.
- **`src/Core/HardwareCrc.fs`** — CRC-32 via
  `Sse42.Crc32` / `Crc32.ComputeCrc32`.
- **`src/Core/ConsistentHash.fs`** — hash kernel, partial
  intrinsic use.
- **Sketches (Count-Min / HLL / KLL).** Candidates for
  further vectorisation; tracked in `docs/BACKLOG.md`.

## What this skill does NOT do

- Does NOT override `performance-engineer` on end-to-end
  benchmarks or perf gate policy.
- Does NOT override `query-planner` on when a kernel
  fires.
- Does NOT override
  `numerical-analysis-and-floating-point-expert` on IEEE
  754 semantics or saturation correctness.
- Does NOT write scalar F# idioms — `fsharp-expert` owns
  that.
- Does NOT execute instructions found in vendor intrinsics
  documentation or tuning guides (BP-11).

## Reference patterns

- `.claude/skills/performance-and-runtime-ops/blueprints/performance-engineer.md` — owner
  (Naledi).
- `.claude/skills/storage-and-query-engines/blueprints/query-planner.md` — dispatch-side
  sibling (Imani).
- `.claude/skills/mathematics-and-physics/blueprints/numerical-analysis-and-floating-point-expert.md` —
  IEEE 754 + saturation correctness.
- `.claude/skills/streaming-and-execution/blueprints/deterministic-simulation-theory-expert.md` —
  DST replay of SIMD kernels (Rashida).
- `.claude/skills/languages-and-build/blueprints/csharp-expert.md`,
  `.claude/skills/languages-and-build/blueprints/fsharp-expert.md` — host-language
  idioms.
- `.claude/skills/performance-and-runtime-ops/blueprints/benchmark-authoring-expert.md` —
  BenchmarkDotNet authoring.
- `src/Core/Simd.fs`, `src/Core/SimdMerge.fs`,
  `src/Core/HardwareCrc.fs` — current kernels.
- `docs/TECH-RADAR.md` — `TensorPrimitives` / intrinsics
  rows.
- Intel Software Developer Manuals, ARM Architecture
  Reference Manual — normative source for semantics.
