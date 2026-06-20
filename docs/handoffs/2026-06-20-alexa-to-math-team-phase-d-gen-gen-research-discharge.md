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

**RESOLVED (shape, not proof) — Aaron 2026-06-20, routed by Soraya:** the meta-IR is **homoiconic** to
`zeta-ir-v1` (same schema, reflected on a level/dimension axis), **not** a separate tier. This collapses
the fixed point from a cross-tier *refinement* proof into a single-schema *self-application* proof
(`eval ∘ quote = id`, `gen(gen)=gen`) — Lawvere's constructive fixpoint, the same shape A that
AdinkraCode Faces 1+2 already prove (G = H self-dual). Routing verdict (Lean primary; Z3 + golden
byte-lock are BP-16 cross-checks; TLA+ refinement explicitly dropped):
`docs/research/2026-06-20-soraya-homoiconic-ir-routing-meta-ir-row-collapses-refinement-into-induction.md`.
The proof obligation is **relocated**, not removed — first gate is proving the round-trip *total*.

**SCOPING RESOLVED — Aaron 2026-06-20 (two questions answered, routed by Soraya):**
(a) the grade is **data-level** (Church/Lisp, one universe), **not** a level-tower ⇒ one inductive type,
no universe machinery, TLA+ refinement stays out (now for two independent reasons). (b) the grading is
**doubly-even** (Cayley-Dickson generated: each doubling = one new imaginary unit = one grading axis),
**not** a single Z2 ⇒ the self-duality axis goes to **Lean**, but **split**: the concrete N=4 doubly-even
self-dual case is *already proven* (exhaustive `AdinkraCode.Tests` + derived `CayleyDicksonAdinkra.Tests`)
— that is the BP-16 base case, **no new proof**; the open Lean target is the **general inductive
invariant** (CD doubling preserves doubly-even self-duality, induction over `Doubled.algebra`). The
"reflection-grade = CD-doubling-axis" bridge is named **open §B** — exhibit the functor, do not assume it.
Refined targets T1/T2/bridge + revised priority list in the routing doc's UPDATE section.

---

## UPDATE 2026-06-20 — Scoping resolved, green light given

**Aaron's answers (via Alexa summon to Soraya):**

1. **(a) CONFIRMED:** data-level grading, Lisp/Church/lambda-calc style. One universe. NOT a hierarchy/tower.
2. **(b) Doubly-even via Cayley-Dickson.** The grading is the doubly-even structure that AdinkraCode pins ([8,4], weight ≡ 0 mod 4). CD doubling generates new dimensions (R→C→H→O). Lean is the right tool (general doubly-even structure), not Z3 (single involution).

**Soraya's routing (confirmed by Aaron — "let her rip"):**

| Target | What | Tool | Effort |
|--------|------|------|--------|
| T1 | `gen(gen)=gen` fixpoint over one IR term algebra (Lawvere constructive) | Lean | M |
| T2 | Doubly-even self-dual invariant preserved by `Doubled.algebra` (inductive step only — base case already discharged) | Lean | M |
| Bridge | Reflection-grade ↔ CD-grade functor (open §B, off critical path) | Lean | L (research) |

**Key decisions:**

- Homoiconic IR (same schema, different dimension) — NOT a separate meta-IR tier
- Concrete N=4 base case already proven (AdinkraCode.Tests + CayleyDicksonAdinkra.Tests) — no rework
- The ECC self-correction forces fixpoint convergence (generation + drift-correction are dual) — must be discharged, not assumed
- Z3 owns bitvector denotation (splitmix64/fmix32). Lean owns projection algebra + CD structure. Different tools for different claims.

**Status:** GREEN LIGHT. Soraya has full authority on T1/T2/bridge split. Lumen receives routing for the inductive step.
