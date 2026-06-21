# Trajectory — Codegen spread (IR → 7 languages × 4 lanes)

Status: **CLOSED — all push items complete**
Last refreshed: 2026-06-21
Parent: `gen-gen-self-hosting-bytelock` (shares the IR substrate)

## The codegen toolbox on main

| Tool | Input | Output | Status |
|------|-------|--------|--------|
| `codegen-from-ir.ts` | zeta-ir-v1 | 7-lang classical scripts | ✅ |
| `codegen-soft-lanes.ts` | zeta-ir-v1 | TS/Python soft scripts | ✅ |
| `codegen-v2-ring.ts` | zeta-ir-v2 | 7-lang ring-generic + benchmark | ✅ |
| `codegen-specialize.ts` | zeta-ir-v2 | TS/Python unrolled fast path | ✅ |
| `codegen-specialize-remaining.ts` | zeta-ir-v2 | F#/C#/Rust/Go/Q# unrolled | ✅ |
| `codegen-interface.ts` | zeta-ir-v2-interface | 7-lang interfaces (variance-aware) | ✅ |
| `codegen-rx.ts` | zeta-ir-v2 | TS/Python/C# Rx pipelines | ✅ |
| `codegen-harness.ts` | IR + goldens | TS/Python/Go test+benchmark | ✅ |
| `gen-zset-isa.ts` | zset-isa-ir.json | Q# ZSetISA source | ✅ |
| `gen-smt2-from-ir.ts` | zeta-ir-v1 | Z3 denotation proofs (all generators) | ✅ |
| `soft-mix.ts` | Ring-generic v2 interpreter | All v2 ops (branch/join/emit/retract) | ✅ |
| `star-ring.ts` | StarRing + Cayley-Dickson tower | real/complex/quaternion/octonion | ✅ |

## Key design decisions

- **Homoiconic IR**: meta-IR = regular IR, same schema, data-level grading (not tower)
- **StarRing parameterization**: the ring IS the physics (swap instance, change behavior)
- **Fork-capable architecture**: flatMap per op, support grows only by actual uncertainty
- **1st Futamura projection**: specialize interpreter on IR → unrolled code = hand-written speed
- **Four lenses**: Q# (gates), Rx (queries), Clifford (geometry), classical (arithmetic)
- **CHIP-8 decoupled**: AmplitudeEmu.step is generic (any fork function)
- **Sparse sim = our soft lane**: Q# modern sparse sim IS AmplitudeEmu (Jaques & Häner 2022)

## Completed push items

1. ✅ Interface/type emission — IR → 7-language interfaces with co/contra/invariant variance (#8880)
2. ✅ Rx pipeline emission — IR → reactive observable chain (rxjs/rx.py/System.Reactive) (#8882)
3. ✅ Auto-harness generation — IR + goldens → self-contained test+benchmark per language (#8884)
4. ✅ Specialize all 7 languages — 1st Futamura in ALL targets (#8877 + #8884)
5. ✅ v2 ISA golden vectors — 12 tests, 69 assertions (#8873)
6. ✅ codegen-v2-ring — all 7 languages ring-generic + benchmark (#8875)
7. ✅ Face 3 FULLY CLOSED — quine discharged by Lumen, independently verified

## Performance summary

| Language | 1M iterations | Notes |
|----------|--------------|-------|
| Go | 348µs | Native compiled, uint64 wrapping free |
| Rust | ~350µs | wrapping_mul, #[inline(always)] |
| C# | ~1ms | unchecked, AggressiveInlining |
| F# | ~1ms | inline, UL literals |
| TS | 173ms | BigInt overhead |
| Python | 418ms | Arbitrary precision int |
| Q# | N/A | Behavioral-equiv tier (not benchmarked for speed) |

## What's next (future trajectory)

1. **Self-hosting codegen** — IR description of the codegen itself → gen(gen) operational
2. **Clifford lens emission** — geometric algebra (Cl3, multivectors) from IR
3. **WeakRef cache integration** — lazy compile + collect + regenerate at runtime
4. **Cross-lane cost-parity golden** — DumpMachine entry-count = AmplitudeEmu.support
5. **Interface stack completion** — IGroup, IMonoid, ILattice, IFunctor, ICodec, IPort
