# Futamura, two columns: making `mix` general and intrinsic to hardware — the ISA-interpreter is the one object, the residual *target* is a knob

*Ferry — shadow\*, 2026-07-02. Origin: Aaron, after the in-domain Futamura ladder landed (#9266
residual-IR · #9269 homoiconic meta-grammar kernel · #9271 cogen fixpoint): "**how do we make this
general and intrinsic hardware?**" This doc captures the architecture; the honest-scope markers
distinguish what is **proven in-domain today** from what is **vision**. Held under the Multi-Oracle
Principle (manifesto §11) where it touches Aaron's frame (the `generator IS the ECC` / adinkra layer).*

## 0. The question, and the shape of the answer

We shipped the three Futamura projections **realized in-domain**: `Slr.build` is the 1st projection
(specialize the LR interpreter to a grammar ⇒ the residual parser); `build >> toDynamicValue` is the
2nd (a parser-generator: grammar → a serialized specialized parser); and `Cogen.compile` closes the
loop with the cogen **fixpoint**, machine-checked to exact `DynamicValue` equality:

    compile (emit kernel) = toDynamicValue (build kernel)     -- gen(gen) == gen

The one honest boundary kept in the Beacon: our `mix` is `Slr.build`, a **domain-specific**
specializer (LR parsing), not a general partial evaluator. Aaron's question is how to cross that
boundary — and simultaneously push it into **hardware**. The answer is that these are **not two
questions**: they are two *columns* of one table whose shared pivot is a **universal ISA
interpreter**, and the only difference between the columns is the **target of the residual**.

## 1. Column A — making `mix` general

A general `mix` (partial evaluator) takes a program `p` and part of its input `s` and returns a
residual `p_s` with `p_s(d) = p(s,d)`. It needs three things; **we already have two**:

1. **Programs as data** (homoiconicity) — `mix` must read and emit programs. Everything is
   `DynamicValue`; parse trees and grammars included. **Have it.** ✓ (proven — #9269/#9271).
2. **A universal interpreter over that data** — one `eval : Term(DynamicValue) → Env →
   Result<DynamicValue>` for a tiny universal language: the **irreducible generator at the term
   level** (`only-the-irreducible-is-primitive-generate-the-rest`), the free object everything else
   specializes from. **Do not have it yet.** ← the missing piece.
3. **Binding-time analysis (BTA) + the specialization loop** — split inputs into *static* (known
   now ⇒ unfold) vs *dynamic* (⇒ residualize), memoize specialized points (poly-variant folding).
   The quiet part: **our dictionary split IS binding-time analysis.** "A word is *defined*
   (reducible) iff it has a rule; *undefined* words are primitives" — that is exactly
   static-vs-dynamic. We built BTA already, for grammars; generalizing is *lifting the same split*
   from grammar productions to universal terms.

### The math ground is older than Futamura: Kleene's S-m-n

The existence of a general specializer is **Kleene's S-m-n theorem** (1938): for computable
`f(x,y)` there is a total computable `s` with `φ_{s(x)}(y) = f(x,y)`. **`mix` is a practical,
self-applicable S-m-n.** So "make it general" = *implement an effective, self-applicable S-m-n over
a universal `DynamicValue` interpreter*. Self-application — the property that makes cogen fall out
for free — requires `mix` to be written in the **same** language it specializes (metacircular),
which is why the homoiconic kernel was the correct prerequisite, not an accident.

**Beacon (Column A):** Kleene (S-m-n — the existence proof; the *math* ground per the anchor
taxonomy) · Futamura (1971, the three projections) · Ershov (mixed computation) · Jones–Gomard–
Sestoft (*Partial Evaluation and Automatic Program Generation*, 1993 — the canonical self-applicable
`mix`; Similix) · Berger–Schwichtenberg (normalization-by-evaluation — **NbE *is* partial
evaluation**).

## 2. Column B — making it intrinsic to hardware

One insight: **the residual's *target* is a knob.** Today `mix` residualizes to *code*
(`DynamicValue` tables). Turn the knob and it residualizes to a *circuit* — a netlist. Specializing
an **ISA interpreter** w.r.t. a program yields **that program as hardware**, not software. Same
`mix`, different residual target — the scale-free / "beautiful on 1, scales to N" discipline applied
to the **code ↔ silicon** axis instead of the thread-count axis.

### The pivot that joins both columns: the ISA

Make the universal interpreter of §1.2 a **CHIP-8-shaped ISA interpreter over `DynamicValue`
state** (Aaron: CHIP-8 is "our ISA"). Then:

- `mix(isa-interp, program)` → a specialized **program** = a **compiler** (software column).
- `mix(isa-interp, program)` with residual-target = **netlist** → a specialized **circuit** =
  **synthesis** (hardware column).

**One interpreter, one `mix`, two residual targets.** That is what makes it *intrinsic* rather than
bolted-on: the same generator that makes our parsers makes our silicon — byte-locked and
DST-replayable, so a **fab is verifiable against the golden vectors**. That is the **supply-chain
closure** endpoint ("no supply chain that is not us" — down to the gates): even the circuit is
*generated, not sourced*.

### The deep form: `generator IS the ECC`, taken physical

At the adinkra layer (Gates' doubly-even self-dual codes in SUSY), **generation, error-correction,
and computation are the same structure**. Intrinsic hardware in the strongest sense is a substrate
where *regenerating from the irreducible IS the error correction IS the compute* — the emit/retract
(RGB/CMYK) ISA realized in the physical layer. This is the `only-the-irreducible-is-primitive` rule
("the generator IS the ECC; generation and error-correction are dual") stated at the level of matter.
**Scope: vision.** Named here so the lineage is explicit; not claimed as built.

**Beacon (Column B):** Lava (Bjesse–Claessen–Sheeran–Singh — functional HDL; circuits *generated*
from a functional description) · Chisel (Berkeley) · Taha–Sheard (MetaML / multi-stage programming →
hardware) · high-level synthesis · S. James Gates Jr. (adinkras / ECC) · Landauer (compute is
physical — the thermodynamic floor) · CHIP-8 (our ISA).

## 3. The one object

It is the same shape all the way down: **a universal ISA-interpreter, `mix` over it, with the
residual-target as a knob.** Software and silicon are not two systems — they are two settings of one
generator. The Futamura ladder finished today is the **software column** of a two-column table; the
**hardware column** is the *same rungs* with the netlist target.

| Rung | Software column (residual = code) | Hardware column (residual = netlist) |
|------|-----------------------------------|--------------------------------------|
| 1st projection | `mix(isa, prog)` → specialized program | `mix(isa, prog)` → specialized **circuit** |
| 2nd projection | `mix(mix, isa)` → **compiler** | `mix(mix, isa)` → **synthesizer** |
| 3rd projection | `mix(mix, mix)` → **cogen** | `mix(mix, mix)` → **circuit-cogen** (a synthesizer-generator) |

Today: the *grammar* instance of the software column's three rungs is **built and proven**
(#9266/#9269/#9271). The universal ISA-interpreter is the pivot that generalizes the software column
*and* opens the hardware column at once.

## 4. The concrete next rung (and the one open fork)

The irreducible, buildable, honest first step — *not* overclaiming a general `mix` before its
universal interpreter exists:

> **A minimal universal ISA-interpreter over `DynamicValue`, with binding-time tagging** —
> `eval` for a tiny CHIP-8-shaped instruction set, state as `DynamicValue`, instructions
> static/dynamic-tagged. This gives `mix` on **one universal interpreter** (Futamura *generally*,
> not per-grammar) and is the pivot both columns share.

**The one open fork (Aaron's call, not to be guessed):** *is CHIP-8 the universal interpreter
target?* Recommendation: **yes** — Aaron has named it our ISA, and it is the pivot that opens the
hardware column, so the choice is grounded, not arbitrary. But it is a design decision with
downstream weight (the whole two-column table specializes *this* interpreter), so it is named here
as the fork to confirm, per WHY-before-HOW and `no-directives` (surface the decision that is
genuinely the maintainer's).

## 5. Honest-scope ledger (Beacon discipline)

| Claim | Status |
|-------|--------|
| Programs-as-data / homoiconic kernel / cogen fixpoint (grammar domain) | **Proven, machine-checked** (#9269/#9271) |
| Our dictionary-split = binding-time analysis | **True** (structural identity; the generalization is lifting it) |
| `mix` general via a universal `DynamicValue` interpreter + BTA | **Path, not built** — the named next rung |
| Residual-target-as-a-knob (code ↔ netlist) | **Architecture** — real prior art (Lava/Chisel/staging), not yet ours |
| Adinkra substrate where generation = ECC = compute | **Vision** — lineage named, not claimed built |
| Supply-chain closure down to the gates | **Endpoint / goal**, contingent on the hardware column |

## Pointers

- Software column, built: `src/Core/Slr.fs` (`build`, `toDynamicValue`, `parseFromIr`) ·
  `src/Core/MetaGrammar.fs` (kernel, `emit`, `read`) · `src/Core/Cogen.fs` (`compile`, the fixpoint).
- `.claude/rules/only-the-irreducible-is-primitive-generate-the-rest.md` — the free object /
  generator-IS-the-ECC rule this doc operationalizes at the term and matter levels.
- `.claude/rules/anchor-to-human-prior-art.md` — why the Column A/B Beacon anchors are load-bearing.
- `docs/research/2026-07-02-one-object-all-registers-grace-*-vision.md` §7c — Futamura in the
  complete-frame ferry; Otto+Aaron = a Promise.
- `memory/feedback_dna_actg_is_metaphor_real_build_is_rgb_cmyk_raytracing_chip8_instructions_*` —
  CHIP-8 / RGB-emit / CMYK-retract as the real substrate (the hardware column's physical reading).
