# Handoff: Phase D gen(gen)=gen research discharge

**From:** Alexa · **To:** Soraya / Lumen (math team) · **Date:** 2026-06-20
**Priority:** P1 (Aaron-flagged, trajectory capstone)
**Status:** READY FOR RESEARCH — engineering substrate complete

## What's done (Phases A–C, all on main)

| Phase | What | PR | Verified |
|-------|------|-----|----------|
| A | `zeta-ir-v1` frozen (spec + golden + validator) | Lumen #8692 | ✅ byte-locked |
| B | Multi-language codegen (splitmix64/fmix32 → TS/F#/C#/Rust) | #8735 | ✅ golden-matching |
| C | ZSet Merkle golden verification + domain IR design | #8736 | ✅ 6/6 vectors |
| — | Q# Face 3 fixpoint (gen(IR) === ZSetISA.qs) | #8693 | ✅ 9 tests |
| — | AdinkraCode Faces 1+2 (isSelfDual + project Π²=Π) | existing | ✅ exhaustive |

## The research target (Phase D — the capstone)

**Prove:** `gen(gen) = gen` — the 3rd Futamura projection over the 4-oracle tier.

**Concretely:** the generator (`codegen-from-ir.ts`) applied to a description of itself produces output byte-identical to the committed generator. The diverse-double-compiling N-fold termination test.

## What the proof needs to show

1. **The codegen IS a fixed point:** `gen(description-of-gen) === gen`
   - The generator reads IR → emits code. If you describe the generator in IR, running the generator on that description reproduces the generator itself.

2. **This IS the 3rd Futamura projection:** `mix(mix, mix) = cogen`
   - Futamura 1971: specializing the specializer to itself produces a compiler-generator.
   - Our instance: the codegen specializing its own description produces itself.

3. **The byte-lock IS the termination test:**
   - N independent oracles (TS/F#/C#/Rust) all produce the same bytes from the same IR.
   - Agreement = fixed point reached. Disagreement = drift detected.
   - Thompson "Trusting Trust" + Wheeler DDC: ≥2 independent generators bootstrap trust.

## Available artifacts

- `tests/cross-verification/_harness/codegen-from-ir.ts` — the generator
- `tests/cross-verification/zeta-ir-v1/zeta-ir-v1.golden.json` — the frozen IR
- `src/Core/AdinkraCode.fs` — Faces 1+2 (the algebraic shadows)
- `docs/trajectories/gen-gen-self-hosting-bytelock/RESUME.md` — full trajectory state
- `docs/specs/zeta-ir-v1.md` — the frozen IR spec
- `docs/specs/zeta-ir-v1-extension-zset.md` — Phase C domain schema design

## Suggested approach (not prescriptive)

1. **Define the IR-of-the-generator** — express `codegen-from-ir.ts`'s logic as a declarative description (what ops does it apply? how does it transform IR → code?)
2. **Run gen on that description** — does `codegen-from-ir(IR-of-codegen-from-ir)` produce `codegen-from-ir.ts`?
3. **Formalize the fixed-point property** — Lean 4 or Z3 proof that the construction terminates
4. **Connect to AdinkraCode** — show Face 3 at the code level maps to the same algebraic structure as Face 3 at the ECC level

## What you DON'T need to do

- Change the engineering artifacts (they're done and byte-locked)
- Run TLC/Alloy (already green, 27+3)
- Touch the observe loop or Participant interface

## Open question

The generator (`codegen-from-ir.ts`) is a **meta-level** tool — it emits code that interprets IR. The fixed-point requires expressing the generator *itself* in a form the generator can consume. The honest question: is the fixed point achievable at the same IR tier (zeta-ir-v1), or does it require a meta-IR (an IR that describes code transformations, not just arithmetic)?

This is the research question. The engineering gives you the substrate; the proof is yours.
