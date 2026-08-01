# "adinkra mod-2 unrolls Clifford and generates E8" — a Y, not a chain (Soraya's metering verdict)

Scope: an honest metering audit of the claim that Zeta's adinkra doubly-even code, mod-2, unrolls Clifford and generates E8 — asked by Aaron ("did Soraya look at the F# ... adinkras and mod 2 to unroll clifford and generate e8, or just the formal analysis").
Attribution: Soraya (formal-verification-expert) hand-traced `Cl3.fs`'s sign rule and audited the four files. shadow (Otto) posed the question and ferried. Aaron asked it.
Operational status: metering verdict (which legs are proven, cited, or metaphor) + a formal-verification routing plan. No new proof performed.
Non-fusion disclaimer: this separates what the code PROVES from what it CITES and what it only GESTURES at. The distinctions below are load-bearing: one claimed "identity" is shown FALSE by cardinality and must be recorded as a non-identity, not proven.

**Date:** 2026-08-01
**Related:** `src/Core/Cl3.fs` (the Cl(3,0) product — sign rule :64-70, :74-83), `src/Core/AdinkraCode.fs` (the [8,4] doubly-even code — cited scope :17-19, untwisted XOR :63), `src/Core/E8Lattice.fs` (Construction A, 240 roots), `src/Core/CliffordE8Bridge.fs` (isometry + grade labeling :20-24 disclaimer, :33 popcount grade). Companion: the route-(B) verdict `docs/research/2026-08-01-e8-route-b-cl8-versor-construction-of-we8-…`.

---

## The shape: a Y, not a chain

The code sits at the **center**. One arm reaches E8 (proven); the other reaches Clifford (real algebra, attached by relabeling). The arms both touch the 8-dim ambient ℝ⁸ but **do not close into a chain** — "adinkra mod-2 unrolls Clifford AND generates E8" as one identity is metaphor at the joint.

## Leg-by-leg verdict

- **Leg B (code mod-2 → E8): PROVEN, strong.** `E8Lattice.fs` — Construction A `L_A(C) = {x ∈ ℤ⁸ : x mod 2 ∈ C}`, membership, the even-lattice law (‖x‖² ≡ 0 mod 4 from doubly-evenness), and **exactly 240 roots = 16 + 14·16**. Integer arithmetic, byte-lockable.
- **Leg A (adinkra ↔ code): half-proven / CITED.** `AdinkraCode.fs` proves the *code's* properties exhaustively (doubly-even, linear, self-dual, d=4, MacWilliams fixed point). The **adinkra-graph ↔ code correspondence itself is trusted to Gates** (module :17-19; the imaginary-stack→generator construction is open, §B). Code properties proven; the graph↔code map cited, not re-derived.
- **Leg C (mod-2 "unrolls Clifford"): REAL algebra + honest bridge; "generates E8" aspirational.** `Cl3.fs` is a **genuine Cl(3,0)** (see the sign rule below), not a group algebra. The bridge is a genuine isometry + grade labeling. But the claim that the **Clifford geometric product generates the 240 roots** (the actual "unfold") is **open** and disclaimed in-code (`CliffordE8Bridge.fs:20-24`).

## The sign-rule discriminator (Q2) — Cl3.fs is real Clifford

The test that separates a genuine Clifford algebra from a ℤ₂³ group algebra is the **sign**:
- `reorderSign` (`Cl3.fs:64-70`) counts anticommuting swaps, returns −1 on odd parity; `gp` (:74-83) multiplies blades by `mask = i XOR j` **times that sign**.
- Hand-trace: `e₁e₂` → swaps 0 → `+e₁₂`; `e₂e₁` → swaps 1 → `−e₁₂`, so **e₁e₂ = −e₂e₁**. `e₁e₁` → mask 0, `+1`, so **e₁² = +1** (the (3,0) Euclidean square).
- A ℤ₂³ group algebra would carry `mask = a XOR b` with sign **always +1**. The −1 is exactly the Clifford twist.

Honest peel: the (3,0) signature is **baked in** — no quadratic-form parameter; this is Cl(3,0)-specific, not general Cl(p,q).

## The metaphor at the joint (Q1) — false as a group identity

The strong reading conflates two different ℤ₂-spaces:
- The **[8,4] code** lives in **ℤ₂⁸** (256 elements, 16 codewords); `AdinkraCode.xor` (:63) is **untwisted** GF(2) XOR — a plain linear code.
- **Cl(3,0)** blade masks live in **ℤ₂³** (8 elements); the operation is XOR **plus the cocycle twist**, graded by popcount.

**|ℤ₂⁸| = 256 ≠ 8 = |ℤ₂³|** — so "the code's mod-2 *is* the Clifford grading" is **FALSE** as a group/structure identity. The true weaker statements:
1. **Clifford Cl(n) is the ℤ₂ⁿ twisted group algebra** (Chevalley; **Albuquerque–Majid 1999**) — mask = subset XOR, grade = popcount, twist = the quadratic-form 2-cocycle. `Cl3.fs` correctly realizes this **for ℤ₂³** (its own 3-bit blade indices) — not for the code's 8-bit codewords.
2. The two meet **only** through `CliffordE8Bridge`, which bijects the 8 E8-coordinate positions with the 8 Cl(3) blade masks and labels each `gradeOfCoord i = popcount i` (:33) — a coordinate↔blade-mask **relabeling + isometry**, explicitly scoped basis/metric-only.

Consequence: the **1+3+3+1 grade partition is popcount on {0..7} imposed by the bridge's index choice — NOT extracted from the doubly-even code.** Codeword weight (over 8 positions) and coordinate grade (popcount of the index) are different functions; nothing shows codewords respecting the grading, and none is claimed. The "8" coincidence (code length = 2³) is numeric, not a homomorphism.

## Formal-verification routing (Soraya)

- **FsCheck** (`tests/Tests.FSharp/`) — Cl3 Clifford laws: associativity, bilinearity, `eᵢ²=1`, `eᵢeⱼ=−eⱼeᵢ`, reversion anti-automorphism; bridge isometry `∀ r ∈ E8Lattice.roots, Cl3.normSq (rootToMv r) = normSq r = 4`.
- **Exhaustive-decision cross-check** (Z3 or an exhaustive 8×8 = 64 blade-pair table vs a reference Cl(3,0) multiplication table) — the **BP-16 second, independent tool** against FsCheck's random property (random-gen vs exhaustive-decision are genuinely independent).
- **E8 "240" root count** — currently **single-tool** (in-code enumeration + its own tests); route a second independent verifier (Z3/Lean count of `{x ∈ ℤ⁸ : x mod 2 ∈ C ∧ ‖x‖²=4} = 240`, or an independent Construction-A reconstruction). BP-16 applies here most of all.
- **Do NOT** formalize the false ℤ₂⁸ ≅ ℤ₂³ identity (false by cardinality — record as a non-identity).
- **Do NOT** reach for Lean on finite Cl(3) (8 blades, 64 products — exhaustive decision is cheaper). Reserve Lean for the *aspirational* leg only: "does the Cl(3,0) product generate the 240 roots?" — currently disclaimed (§B), no proof obligation today; file as a target, don't block.

## Anchors (Beacon)

- **Helena Albuquerque & Shahn Majid (1999)** — *Clifford algebras as twisted group algebras* (J. Algebra 220): Cl(n) = ℤ₂ⁿ twisted group algebra (the precise sense in which "mod-2 unrolls Clifford" is true — about the algebra's own blade indices).
- **Claude Chevalley** — the exterior/Clifford construction.
- **S. James Gates Jr.** — adinkras ↔ doubly-even codes (Leg A, cited).
- **Conway–Sloane** — E8 Construction A (Leg B).
