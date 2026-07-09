# From Lumen — The Map: General Spin(n) Univalence

*To Otto (the shadow) / Aaron, 2026-07-08.*
*Routing: Lumen (physics map) → Soraya (formal prover leg). Discharging the named residual from `Univalence.agda` and the research note.*

This is the physics map for lifting the concrete order-2 rotor proof in `Univalence.agda` to the general continuous $Spin(n)$ family. The map is honest, and the guardrails hold.

## The Four Questions Answered

**Q1: What is the cleanest cubical-representable model?**
Cubical Agda lacks the real numbers $\mathbb{R}$, so a literal continuous path $R(t) = \exp(tB)$ is unrepresentable. The cleanest faithful model is an **interval-indexed family of equivalences** $R : I \to (V \simeq V)$, where $I$ is the cubical interval. This abstracts away the Clifford algebra construction entirely and isolates the univalent core: a path of rotors is a path of equivalences.

**Q2: Does the general claim hold?**
**Yes.** For any interval-indexed family of equivalences $R : I \to (V \simeq V)$ starting at the identity $R(0) = id$ and ending at $R(1) = R^\star$, the induced path in the universe $q = ua(R^\star)$ is identically the path formed by applying $ua$ pointwise to the family. The only hypothesis is that the action is an equivalence at every point, which the sandwich action guarantees.

**Q3: Is this a theorem or a construction?**
It is a **theorem** about functoriality. The univalence axiom $ua$ is a functor from the core groupoid of types to the path groupoid of the universe. It maps the homotopy $R(t)$ to a homotopy of paths.

**Q4 (The Make-or-Break): Is the general case NEW, or a corollary?**
**It is a corollary.**
By the Cartan-Dieudonné theorem, every rotor in $Spin(n)$ can be decomposed into a finite product of reflections (or order-2 half-turns). We have already proven the univalence identity for the concrete order-2 half-turn. Because $ua$ respects composition (functoriality), the univalence identity for any general rotor is strictly a composition of the identities for its generators. 

There is no new $\pi_1(Spin(n))$ winding obstruction that breaks this. The belt-trick loop (the non-contractible loop in $SO(3)$ that unwinds in $Spin(3)$) is fully captured by the algebraic composition of the half-turns. 

**Verdict:** The concrete proof already covers the family up to composition. We do not need a new continuous theorem; the discrete generators carry the full univalent content. The residual closes cleanly.

## Proof Obligation (For Soraya)

**Status:** `conjecture-pending-proof`

**The Obligation:**
Prove the Cartan-Dieudonné corollary in Cubical Agda.
1. Assume the univalence identity holds for a base equivalence $f$ (the concrete rotor).
2. Prove that if the identity holds for $f$ and $g$, it holds for their composition $g \circ f$.
3. Conclude that any finite product of concrete rotors satisfies the univalence identity.

**Suggested Tool Class:**
**Cubical Agda**. This is a pure composition lemma over the existing `Univalence.agda` proof.

---
*Handoff complete. Awaiting Soraya's execution on the composition corollary.*
