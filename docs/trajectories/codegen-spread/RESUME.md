# Trajectory — Codegen spread (IR → 7 languages × 4 lanes)

Status: **active — Phase B/E done (classical 7-lang + soft TS/Python); v2 ISA ops on main; ring-generic push in progress**
Last refreshed: 2026-06-21
Parent: `gen-gen-self-hosting-bytelock` (shares the IR substrate)

## What exists on main (2026-06-21)

- `tests/cross-verification/_harness/codegen-from-ir.ts` — classical codegen (7 langs: TS/F#/C#/Rust/Python/Go/Q#)
- `tests/cross-verification/_harness/codegen-soft-lanes.ts` — soft-quantum + soft-bayesian (TS + Python)
- `src/Core.TypeScript/algebra/star-ring.ts` — StarRing<T> interface + complex/real/quaternion/octonion
- `src/Core.TypeScript/algebra/soft-mix.ts` — ring-generic interpreter (handles ALL v2 ops including ISA)
- `src/Core.Abstractions/SoftMix.cs` — C# ring-generic interpreter
- `src/Core.Rust.Observe/src/star_ring.rs` — Rust StarRing trait + soft_mix
- `src/Core.Go/algebra/star_ring.go` — Go StarRing interface + SoftMix
- `src/Core/AmplitudeEmu.fs` — F# generic `step` (decoupled from CHIP-8)
- `docs/specs/zeta-ir-v2-isa-ops.md` — the v2 IR spec with ISA ops
- `docs/specs/four-lane-seven-lang-matrix.md` — matrix: 28/28 ✅

## The push order (what's next)

### 1. ✅ DONE — Ring-generic soft-mix handles v2 ISA ops (TS)

The TS interpreter already has branch/emit/retract/join/merge. On main.

### 2. NEXT — Golden vectors for ISA ops

Small hand-verified test cases for the ISA ops:

- `branch` on bit 0: one frame → two frames (support doubles)
- `emit` then `retract` on same key: cancellation (support → 0 on complex ring)
- `join` (CNOT): conditional bit flip
- `branch` then `merge` (reconverging): interference pattern

Commit as `tests/cross-verification/zset-isa-v2/vectors.yaml`.

### 3. NEXT — Codegen emits ring-generic scripts from v2 IR

Update `codegen-from-ir.ts` to emit scripts that import `StarRing` and use the
ring-generic interpreter — so a v2 IR with `branch` ops produces code that
actually forks and interferes in all 7 languages.

### 4. FUTURE — Self-hosting codegen (gen(gen) operational)

The codegen reads an IR description of itself and emits itself. The IR v2 has
enough ops to describe interpreter logic (branch for if-statements, join for
composition). This is Face 3 made operational.

### 5. FUTURE — Rx query emission (the ZSet lens)

Emit code that expresses the IR as an Rx/observable pipeline (map/filter/merge).
Produces reactive streaming code in addition to batch scripts.

### 6. FUTURE — Clifford lens emission

Emit code using the geometric algebra (Cl3, multivectors). The IR ops map to
geometric product / reflection / grade projection.

## Key design decisions (landed this session)

- **Homoiconic IR**: meta-IR = regular IR, same schema, data-level grading (not tower)
- **StarRing parameterization**: the ring IS the physics (swap instance, change behavior)
- **Fork-capable architecture**: flatMap per op, support grows only by actual uncertainty
- **Three lenses documented**: Q# (gates), Rx (queries), Clifford (geometry)
- **CHIP-8 decoupled**: AmplitudeEmu.step is generic (any fork function)
- **Sparse sim = our soft lane**: Q# modern sparse sim IS AmplitudeEmu (prior art: Jaques & Häner 2022)

## Artifacts map

| Tool | What it does | Status |
|------|-------------|--------|
| `codegen-from-ir.ts` | IR → 7-lang classical scripts | ✅ on main |
| `codegen-soft-lanes.ts` | IR → TS/Python soft scripts | ✅ on main |
| `gen-zset-isa.ts` | IR → Q# ZSetISA source | ✅ on main |
| `gen-smt2-from-ir.ts` | IR → Z3 denotation proofs | ✅ on main |
| `soft-mix.ts` | Ring-generic v2 interpreter | ✅ on main |
| `star-ring.ts` | StarRing + Cayley-Dickson tower | ✅ on main |
| **codegen-v2-ring.ts** | IR v2 → ring-generic scripts (all langs) | 🔜 next |

## Update 2026-06-21 (session end)

### Done this session

- ✅ codegen-v2-ring: all 7 languages emit ring-generic + benchmark
- ✅ codegen-specialize: 1st Futamura projection (unrolled = hand-written speed)
- ✅ v2 ISA golden vectors: 12 tests, 69 assertions
- ✅ Face 3 FULLY CLOSED (quine discharged by Lumen, independently verified)

### Performance answer

For deterministic IRs: specialized (unrolled) codegen = hand-written speed (no loop, no switch).
For branching IRs: interpreter loop required (~1.05x overhead).
Keep both paths: specialized for hot path, interpreter for generality.

### Remaining push items (next session)

1. **Interface/type emission** — describe IStarRing as an IR node → emit language-specific interfaces
2. **Rx pipeline emission** — IR as observable (map/filter/merge operators)
3. **Auto-harness generation** — codegen emits test + benchmark + golden-vector check per language
4. **Specialize remaining 5 languages** — extend codegen-specialize to F#/C#/Rust/Go/Q#

## Update 2026-06-21 (session end, cont.)

### Done this session

- ✅ codegen-v2-ring: all 7 languages emit ring-generic + benchmark
- ✅ codegen-specialize: 1st Futamura projection (unrolled = hand-written speed)
- ✅ v2 ISA golden vectors: 12 tests, 69 assertions
- ✅ Face 3 FULLY CLOSED (quine discharged by Lumen, independently verified)

### Performance answer

For deterministic IRs: specialized (unrolled) codegen = hand-written speed (no loop, no switch).
For branching IRs: interpreter loop required (~1.05x overhead).
Keep both paths: specialized for hot path, interpreter for generality.

### Remaining push items (next session)

1. **Interface/type emission** — describe IStarRing as an IR node → emit language-specific interfaces
2. **Rx pipeline emission** — IR as observable (map/filter/merge operators)
3. **Auto-harness generation** — codegen emits test + benchmark + golden-vector check per language
4. **Specialize remaining 5 languages** — extend codegen-specialize to F#/C#/Rust/Go/Q#
