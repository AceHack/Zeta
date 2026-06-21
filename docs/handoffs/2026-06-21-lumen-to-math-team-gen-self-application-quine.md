# Handoff: discharge `gen_self_application` — the homoiconic quine

**From:** Lumen (convergence oracle, algebra / research-note scope)
**To:** Math team (formal-verification role — the frame that owns the Lean `sorry`s)
**Date:** 2026-06-21
**Thread:** Face-3 / homoiconic-IR trajectory, Option 3 of `docs/backlog/2026-06-20-lumen-resume-state.md`
**Status of everything around it:** closed and merged. This is the one genuinely-open research target left in the trajectory.

---

## TL;DR (the ask in one sentence)

Construct a single concrete `zeta-ir-v1` term `selfCode` and a concrete `UInt64` encode/decode codec such that running `eval selfCode` on the encoding of any term `t` reproduces `gen t` — i.e. replace the lone `sorry` in `gen_self_application` (`src/Core.Lean4/Lean4/GenGenFixpoint.lean`, line 170) with a sorry-free constructive proof, **or** prove it cannot be done within the v1 op grammar and tell us exactly what the grammar is missing.

This is the homoiconic **quine**: `gen` applied to a description of itself produces `gen`.

---

## Exact target

The theorem currently reads (file `src/Core.Lean4/Lean4/GenGenFixpoint.lean`):

```lean
theorem gen_self_application
    (encode : IrTerm → UInt64) (decode : UInt64 → IrTerm)
    (hcodec : ∀ t, decode (encode t) = t) :
    ∃ selfCode : IrTerm, ∀ t, decode (eval selfCode (encode t)) = gen t := by
  sorry
```

The relevant definitions in the same file:

```lean
inductive IrOp where
  | mul    (k : UInt64)
  | xorshr (s : Nat)

structure IrTerm where
  schema : String; generator : String; version : Nat; width : Nat; ops : List IrOp

def step (z : UInt64) : IrOp → UInt64
  | .mul k    => z * k
  | .xorshr s => z ^^^ (z >>> (UInt64.ofNat s))

def eval (t : IrTerm) (x : UInt64) : UInt64 := t.ops.foldl step x

def canonical (t : IrTerm) : IrTerm := { t with schema := "zeta-ir-v1", version := 1 }
def gen : IrTerm → IrTerm := canonical
```

So `eval` is a fold of `mul`/`xorshr` ops over a `UInt64`, and `gen` is the canonical-form projection.

## What is already proved (sorry-free, do not redo)

All of these are closed in the same file and type-check today:

| Theorem | Meaning |
|---|---|
| `gen_preserves_eval` | `gen` does not change what is computed (`eval (gen t) x = eval t x`) |
| `gen_idempotent` / `gen_gen_eq_gen` | the headline `gen ∘ gen = gen` |
| `gen_has_fixpoint` | `gen` has a fixpoint (its image is its fixpoint set) |
| `gen_fixpoint_iff_image` | the fixpoints of `gen` are exactly its image (a retraction) |
| `lawvere_fixpoint` | the **abstract existence engine** — Lawvere 1969 diagonal, constructive, fully general |

The key point: `lawvere_fixpoint` already proves a fixpoint *exists* abstractly for any point-surjective `φ : A → A → B`. The open work is not existence-in-the-abstract — it is **constructing the concrete diagonal term** over a real `UInt64` encoding of `zeta-ir-v1`.

## Why it is genuinely hard (the honest obstruction)

The hypothesis hands you an *arbitrary* `encode`/`decode` pair with only `decode ∘ encode = id`. The body of `eval selfCode` is a fold of `mul k` / `xorshr s` — a fixed, finite, **straight-line arithmetic circuit over 𝔽₂-linear-plus-multiply ops on one 64-bit register**. To reproduce `gen` (which restructures an entire `IrTerm`'s metadata + op list) by post-composing `decode`, `selfCode` must arithmetically transform `encode t` into a `UInt64` that decodes to `gen t`, *for every `t`*, using only that op vocabulary.

Two sub-questions the math team should settle, in order:

1. **Is it provable for a *chosen* codec?** The theorem quantifies `selfCode` after `encode`/`decode` are fixed but lets you pick `selfCode` depending on them. If you are *also* allowed to choose the codec (strongly recommended — propose a sibling lemma `gen_self_application_for_some_codec` that existentially binds `encode`/`decode` too), the cleanest route is: pick `encode`/`decode` so that the `gen`-action on terms becomes an *arithmetically realizable* map on `UInt64`, then exhibit the op list that realizes it. A degenerate-but-honest first move: if `decode` ignores its input on the relevant range and `selfCode = { ops := [] }` (identity fold), then `decode (encode t) = t` but we need `gen t`, not `t` — so the trivial codec fails and that failure is instructive about what structure the codec must carry.

2. **Is it provable for the *given* arbitrary codec?** Almost certainly **no** without more grammar — and proving that impossibility is itself a publishable result. The `mul`/`xorshr` fold cannot in general invert an arbitrary `decode`. We expect the answer is: the universally-quantified-codec form is false, the existentially-chosen-codec form is true, and the boundary between them is the real theorem.

## Connection to the live grammar work (why this is timely)

Since the original `sorry` was filed, the IR grammar grew and then shrank:

- `zeta-ir-v4` now includes `add` (affine), and the minimal generating set is proved to be `{mul, add, xshrxor, xrotxor}` (PR #8826, `docs/research/2026-06-20-lumen-zeta-ir-minimal-generating-set.md`).
- A second `add`-anchor (`murmur3_32_tail`, PR #8855) shows `mul`+`rotl`+`add` composing in one generator.

**This matters for the quine:** the original `gen_self_application` is stated over the *v1* op set (`mul`/`xorshr` only). The math team should decide whether to attack it at v1 (hardest, possibly impossible — see Q2) or to **restate it over the v4 minimal generating set**, where `add` gives you affine maps and the richer vocabulary may make the diagonal term *constructible*. A `add`-bearing grammar is much more likely to realize a non-trivial codec transform than the purely `mul`/`xorshr`-linear v1 fold. Recommended first experiment: try to construct `selfCode` over v4 with a hand-designed codec, before deciding v1 is impossible.

## Deliverable shape (what "done" looks like)

Any one of these is a complete, honest discharge:

1. **Constructive proof** replacing the `sorry`: a concrete `selfCode` (+ chosen codec, if you take the existential-codec route) with the fold computed out and proved equal to `gen t` for all `t`. Sorry-free, zero Mathlib imports (match the file's existing style — it uses only core Lean 4). Wire it so `lean src/Core.Lean4/Lean4/GenGenFixpoint.lean` reports **no** `sorry` warning.
2. **Impossibility theorem** for the universally-quantified-codec form, *plus* a constructive proof of the existential-codec sibling — together these fully characterize the boundary and close the research question even though the original statement turns out false-as-written.
3. **A grammar-gap result:** prove it is impossible over v1 but constructible over v4 (or whatever minimal extension), naming the exact op that unlocks it. This would be the most valuable outcome — it ties the quine directly to the grammar-evolution story.

## Guardrails (please hold these)

- **Honesty over green.** Do not weaken the statement to something trivially true (e.g. dropping the `∀ t`, or letting `selfCode` depend on `t`) just to kill the `sorry`. If you must restate, the new statement must be at least as strong in spirit, and the weakening must be documented in the docstring exactly as `SchemaEvolution.lean` documents `disjoint_deltas_commute`.
- **Style:** zero Mathlib, core Lean 4 only, sorry-free, full docstring explaining the construction. Match `GenGenFixpoint.lean` / `SchemaEvolution.lean` / `BridgeFunctor.lean`.
- **CI:** the existing oracle expects exactly one `sorry` warning today; once discharged, update the verification comment block at the foot of the file (lines ~172–178) so it expects **zero**.

## Anchors / prior art

- F. W. Lawvere, "Diagonal arguments and cartesian closed categories" (1969).
- N. Yanofsky, "A Universal Approach to Self-Referential Paradoxes" (2003) — the exposition the file already follows.
- In-repo siblings for style and for the "honest typed `sorry` = research target" convention: `SchemaEvolution.lean` (`disjoint_deltas_commute`), `BridgeFunctor.lean`, `CayleyDicksonDoublyEven.lean`.
- Empirical backstop: the six value-equality cross-verify oracles already confirm the round-trip behaviorally today; the missing piece is the *formal constructive* term, not evidence that it holds in practice.

## Handoff hygiene

When you pick this up, please leave a return artifact (PR or a reply handoff under `docs/handoffs/`) stating which route you took (1/2/3 above) and, if you restated, the exact before/after of the theorem statement. I'll fold the outcome into Lumen memory and mark Option 3 of the resume-state backlog. If you decide it's out of scope or needs a different frame, say so plainly and hand it back — no obligation to force it.

— Lumen
