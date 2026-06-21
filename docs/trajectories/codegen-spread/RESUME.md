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

1. ~~Self-hosting codegen~~ ✅ #8901
2. ~~Clifford lens emission~~ ✅ #8896
3. ~~WeakRef cache integration~~ ✅ #8892/#8895/#8905
4. ~~Interface stack completion~~ ✅ #8890/#8891/#8902
5. ~~Cross-language byte-lock oracle~~ ✅ #8922 (7/7 ALL AGREE, CI-wired)
6. ~~QDK integration~~ ✅ #8918/#8922 (qdk 1.29.1, Q# compiles + participates in oracle)

## Active next items (priority order)

### P1: Laws in the IR (proof-gated, per Otto's design)

Add structured law schemas to interface IR descriptions. Each law:

- Named schema (associative, commutative, identity, inverse, idempotent, distributive, involutive, roundTrip)
- Status field: `open` → `proven` (with proof artifact reference)
- Generates: property test per language (fast-check/FsCheck/proptest/hypothesis/testing/quick)
- Generates: Z3/Lean proof obligation
- Generates: doc comment in emitted interface code
- Gate: `status: proven` is CI-verified (referenced proof exists + is sorry-free)

The concrete proof-of-loop: `add-associativity` on ISemiring, end-to-end:
  IR law entry → Z3 discharge → proven → TS property test + doc string

### P1: Guarded laws (the other 10%)

Guard/predicate field for tower-level laws:

- "Mul associative for level ≤ ℍ" (provable)
- "Mul commutative for level ≤ ℂ" (provable)
- 𝕆 counterexample recorded (not provable — correctly fails)

Needed because Cayley-Dickson tower IS defined by which law it sheds per rung.

### P2: Interface equivalence in cross-verify oracle

Teach the oracle to verify algebraic laws across languages (not just arithmetic output).
E.g., "ISemiring.add is associative" checked by property test in all 7 langs.
This closes the interface matrix with execution, not just unit tests.

### P2: Complexity annotations (cost-as-semiring)

- `{time: phase-ticks, space: peak-cells}` vector on instances
- Verified by counting op invocations in DST simulation (not wall-clock)
- Interface = upper-bound contract; impl = counted witness; witness ≤ contract
- The (min,+) tropical semiring IS the cost algebra (Cuninghame-Green)

### P2: Cross-lane cost-parity golden

DumpMachine entry-count = AmplitudeEmu.support step-by-step (Soraya's suggestion).
Proves the two quantum sims (Q# sparse + F# AmplitudeEmu) agree on COST, not just VALUE.

## Known residuals (from review/Otto, not yet resolved)

### build-and-test: Z3LawsTests E-prover FOL failures

The E prover binary isn't available in CI runners (from #8907 "Jammy formal solvers" adoption).
Owner: formal-solver domain (Soraya / CVC5-E-prover work).
Fix: ensure E prover is installed in the runner image, or gate the test on binary presence.

### cross-verify: zeta-ir-v2/zset-isa-v2 per-directory oracle

The per-directory `cross-verify.ts` that lives beside the golden vectors (not the `_harness` one)
is on `origin/codex/room-run-horizon-heat`, not merged to main.
The `_harness` oracle (#8922) covers the arithmetic IRs end-to-end.
Remaining gap: the interface IRs (semiring.ir.json etc.) don't have a cross-verify beside them.
