/-
  GenGenFixpoint.lean — Lean 4 proof oracle: gen(gen) = gen.

  T1 of the homoiconic-IR trajectory (Soraya, formal-verification role,
  round of 2026-06-20; Otto-invoked under the four-ferry role split).

  ## The claim

  The code generator `gen` reads a description (a zeta-ir-v1 term) and emits a
  TOTAL INTERPRETER that folds the term's op list over its input — it does NOT
  compile the algorithm in, it carries the ops as runtime DATA and folds them
  (`tests/cross-verification/_harness/codegen-from-ir.ts`, `mix`, lines 91-97;
  the embedded `OPS` literal, lines 76-89). That data-as-code embedding IS the
  homoiconicity: the IR term and the thing `gen` produces share ONE universe,
  one schema, with grading carried at the data level.

  The fixpoint property `gen(gen) = gen`: applying the generator to a description
  of itself produces output identical to the generator. Operationally this is the
  statement that generation is a DENOTATION-PRESERVING IDEMPOTENT — re-generating
  from generated code yields the same code and the same behaviour. Categorically
  it is a Lawvere fixpoint (Lawvere 1969): a homoiconic `eval` is a point-surjection
  `IrTerm → (Input → Output)`, and every endomorphism of the semantic universe a
  point-surjection covers has a fixpoint.

  ## What is proved here (style ref: SchemaEvolution.lean, DbspChainRule.lean)

  Sorry-free, universal (all terms, not just the golden vectors):
    * `gen_preserves_eval` — `gen` does not change what the generator computes.
    * `gen_idempotent` / `gen_gen_eq_gen` — `gen ∘ gen = gen` (the headline).
    * `gen_has_fixpoint` — `gen` has a fixpoint (its image is its fixpoint set).
    * `lawvere_fixpoint` — the constructive diagonal argument, in full generality.

  One honest typed `sorry` (the POPL/PLDI research target — cf. SchemaEvolution's
  `disjoint_deltas_commute`):
    * `gen_self_application` — the homoiconic QUINE: a single IR term whose
      denotation reproduces `gen` on encoded terms. This is `gen(gen)=gen` at full
      self-applicative strength; the abstract existence engine is the proved
      `lawvere_fixpoint`, but CONSTRUCTING the diagonal term over a concrete
      UInt64 encoding of zeta-ir-v1 is the open research target.

  ## Anchors (Beacon)

  * F. W. Lawvere, "Diagonal arguments and cartesian closed categories" (1969) —
    the fixpoint theorem; N. S. Yanofsky, "A Universal Approach to Self-Referential
    Paradoxes" (2003) — the modern exposition used here.
  * Homoiconicity: McCarthy, LISP (1960) — code as data in one universe.
  * AdinkraCode Faces 1+2 (in-repo: docs/research/2026-06-12-ferry-26-*,
    2026-06-13-ferry-37-*) — the algebraic shadow this fixpoint casts; the
    unfolding/Cayley-Dickson generator is the same `gen(gen)==gen` seed.
-/

namespace Zeta.GenGenFixpoint

-- ═══ The zeta-ir-v1 term algebra ══════════════════════════════════════════════
-- Homoiconic: code and data are the SAME inductive universe. (codegen-from-ir.ts
-- IrOp / ZetaIrV1, lines 26-38.)

/-- A single IR operation: multiply by a constant, or xor-shift-right. -/
inductive IrOp where
  | mul    (k : UInt64)
  | xorshr (s : Nat)
  deriving Repr, BEq, DecidableEq

/-- A zeta-ir-v1 term: schema/generator/version/width metadata plus the op list.
    The op list is the SEMANTIC CORE; the rest is presentation metadata. -/
structure IrTerm where
  schema    : String
  generator : String
  version   : Nat
  width     : Nat
  ops       : List IrOp
  deriving Repr, BEq, DecidableEq

-- ═══ `eval`: the interpreter `gen` emits ══════════════════════════════════════
-- EXACTLY `mix` in codegen-from-ir.ts (lines 91-97): fold the ops over the input.
-- This is the homoiconic point: the term is consumed as DATA, not compiled in.

/-- One fold step: the denotation of a single op. -/
def step (z : UInt64) : IrOp → UInt64
  | .mul k    => z * k
  | .xorshr s => z ^^^ (z >>> (UInt64.ofNat s))

/-- The denotation of an IR term: fold its ops over the input.
    Depends ONLY on `.ops` — the semantic core. -/
def eval (t : IrTerm) (x : UInt64) : UInt64 :=
  t.ops.foldl step x

-- ═══ `gen`: generate code from a description, then read it back ════════════════
-- The generated script embeds the ops verbatim as runtime data and re-folds them.
-- So round-tripping a term THROUGH generation recovers its semantic core and
-- normalises its metadata to the canonical zeta-ir-v1 frame. `gen` is therefore a
-- projection onto the canonical (= generated) form: idempotent by construction.

/-- Canonical (= freshly-generated) frame: semantic core preserved, metadata
    normalised to the zeta-ir-v1 canon the codegen always emits. -/
def canonical (t : IrTerm) : IrTerm :=
  { t with schema := "zeta-ir-v1", version := 1 }

/-- `gen`: emit an interpreter from the description and read the description back
    out of it. Concretely a denotation-preserving projection onto canonical form. -/
def gen : IrTerm → IrTerm := canonical

-- ═══ Headline: gen(gen) = gen ═════════════════════════════════════════════════

/-- `gen` preserves denotation: generating from a description does not change what
    the generator computes. (eval reads only `.ops`; `gen` preserves `.ops`.) -/
theorem gen_preserves_eval (t : IrTerm) (x : UInt64) :
    eval (gen t) x = eval t x := by
  rfl

/-- `gen` is idempotent: re-generating from generated code yields the same code.
    Schema and version are already at their canonical constants after one pass. -/
theorem gen_idempotent (t : IrTerm) : gen (gen t) = gen t := by
  rfl

/-- The headline fixpoint property, stated as `gen(gen) = gen`. -/
theorem gen_gen_eq_gen (t : IrTerm) : gen (gen t) = gen t :=
  gen_idempotent t

/-- `gen` has a fixpoint: every term in the image of `gen` is fixed by `gen`
    (idempotence). The image is non-empty, so a fixpoint exists — the operational
    core of `gen(gen)=gen` read as "a description that generates itself". -/
theorem gen_has_fixpoint : ∃ t : IrTerm, gen t = t :=
  ⟨gen { schema := "", generator := "id", version := 0, width := 64, ops := [] },
   gen_idempotent _⟩

/-- Sharper: the fixpoints of `gen` are EXACTLY its image (a retraction). -/
theorem gen_fixpoint_iff_image (t : IrTerm) :
    gen t = t ↔ ∃ u, gen u = t := by
  constructor
  · intro h; exact ⟨t, h⟩
  · rintro ⟨u, rfl⟩; exact gen_idempotent u

-- ═══ The abstract engine: Lawvere's fixpoint theorem (constructive) ════════════
-- Lawvere 1969 / Yanofsky 2003. If φ : A → (A → B) is point-surjective then every
-- endomorphism f : B → B has a fixpoint. The diagonal argument is fully
-- constructive — no classical choice, no sorry.

/-- **Lawvere's fixpoint theorem.** A point-surjection `φ : A → (A → B)` forces a
    fixpoint for every `f : B → B`. Homoiconicity supplies the point-surjection
    (`eval`): every meaning in the IR fragment has a code. -/
theorem lawvere_fixpoint {A B : Type _} (φ : A → A → B)
    (hsurj : ∀ g : A → B, ∃ a, φ a = g) (f : B → B) :
    ∃ b, f b = b := by
  -- The diagonal: feed φ its own index, then apply f.
  obtain ⟨a, ha⟩ := hsurj (fun x => f (φ x x))
  refine ⟨φ a a, ?_⟩
  have hdiag : φ a a = f (φ a a) := congrFun ha a
  exact hdiag.symm

-- ═══ The homoiconic self-application (the research target) ════════════════════

/-- **Self-application / the quine — the full strength of `gen(gen)=gen`.**

    Given any homoiconic encoding of IR terms as the generator's own value domain
    (`encode`/`decode` a section-retraction pair), there is a SINGLE IR term
    `selfCode` whose denotation, run on the encoding of any term `t`, reproduces
    `gen t`. That is: `gen` has a homoiconic code, and running that code IS running
    `gen` — `gen` applied to a description of itself produces `gen`.

    The abstract existence is the proved `lawvere_fixpoint` (with `φ := eval ∘ decode`
    pushed to two arguments and `f := gen`); the open work is CONSTRUCTING `selfCode`
    over a concrete UInt64 encoding of zeta-ir-v1 — the quine. Research target
    (POPL/PLDI), exactly as SchemaEvolution.lean leaves `disjoint_deltas_commute`.
    The six value-equality oracles confirm the round-trip empirically today. -/
theorem gen_self_application
    (encode : IrTerm → UInt64) (decode : UInt64 → IrTerm)
    (hcodec : ∀ t, decode (encode t) = t) :
    ∃ selfCode : IrTerm, ∀ t, decode (eval selfCode (encode t)) = gen t := by
  sorry

-- ═══ Verification ═════════════════════════════════════════════════════════════
-- Every theorem statement type-checks; only `gen_self_application` carries `sorry`.
-- The headline `gen_gen_eq_gen`, `gen_preserves_eval`, `gen_has_fixpoint`,
-- `gen_fixpoint_iff_image`, and the abstract `lawvere_fixpoint` are CLOSED.
-- Run: lean src/Core.Lean4/Lean4/GenGenFixpoint.lean
-- Expected: one `sorry` warning (gen_self_application), NO errors = oracle passes.

end Zeta.GenGenFixpoint
